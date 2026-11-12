import { create } from 'zustand';
import type { Book, SeedManifest } from '../types';
import { putBook, putBooks, getBook, listBooks, deleteBook, removeAnnotation, listAnnotations } from '../lib/db';
import { accentForTitle } from '../lib/utils';
import { readPdfMeta, closeBookPdf } from '../lib/pdf';
import { seedLibrary } from '../lib/seed';
import { useToast } from './toast';

type LibraryState = {
  books: Book[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  adding: boolean;
  initialize: () => Promise<void>;
  addBook: (file: File) => Promise<Book | null>;
  updateBook: (id: string, patch: Partial<Book>) => Promise<Book | undefined>;
  removeBook: (id: string) => Promise<void>;
  reorderBooks: (rows: string[][]) => Promise<void>;
};

const ROW_CAPACITY = 8;

function fileIdentity(book: Book) {
  if (book.isSample) return undefined;
  return `${book.fileName.toLowerCase()}|${book.size}|${book.pageCount}`;
}

function metaIdentity(book: Book) {
  const title = (book.titleZh || book.title).toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
  return `${title}|${book.size}|${book.pageCount}`;
}

async function hashFile(file: File) {
  if (!globalThis.crypto?.subtle) return undefined;
  try {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return undefined;
  }
}

async function dedupeBooks(books: Book[]) {
  const parent = books.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parent[root] !== root) root = parent[root];
    while (parent[index] !== index) {
      const next = parent[index];
      parent[index] = root;
      index = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };
  const hashKeys = new Map<string, number>();
  const fileKeys = new Map<string, number>();
  const metaKeys = new Map<string, number>();
  books.forEach((book, index) => {
    if (book.fileHash) {
      const key = `hash:${book.fileHash}`;
      const existing = hashKeys.get(key);
      if (existing !== undefined) union(index, existing);
      else hashKeys.set(key, index);
    }
    const fileKey = fileIdentity(book);
    if (fileKey) {
      const existing = fileKeys.get(fileKey);
      if (existing !== undefined) union(index, existing);
      else fileKeys.set(fileKey, index);
    }
    if (!book.fileHash) {
      const metaKey = metaIdentity(book);
      const metaExisting = metaKeys.get(metaKey);
      if (metaExisting !== undefined) union(index, metaExisting);
      else metaKeys.set(metaKey, index);
    }
  });
  const groups = new Map<number, number[]>();
  books.forEach((_, index) => {
    const root = find(index);
    const group = groups.get(root);
    if (group) group.push(index);
    else groups.set(root, [index]);
  });
  const duplicates: Book[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const candidates = group.map((index) => books[index]);
    const keeper = [...candidates].sort(
      (a, b) =>
        (b.percent ?? 0) - (a.percent ?? 0) ||
        (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0) ||
        (a.order ?? 0) - (b.order ?? 0),
    )[0];
    duplicates.push(...candidates.filter((book) => book.id !== keeper.id));
  }
  if (!duplicates.length) return books;
  for (const duplicate of duplicates) {
    await deleteBook(duplicate.id);
    await closeBookPdf(duplicate.id);
  }
  const removed = new Set(duplicates.map((book) => book.id));
  useToast.getState().push(`已清理 ${duplicates.length} 本重复书籍`);
  return books.filter((book) => !removed.has(book.id));
}

async function ensureShelfRows(books: Book[]) {
  if (!books.length) return books;
  if (books.every((book) => Number.isFinite(book.shelfRow))) return books;
  const rows = new Map<number, number>();
  for (const book of books) {
    if (!Number.isFinite(book.shelfRow)) continue;
    rows.set(book.shelfRow!, (rows.get(book.shelfRow!) ?? 0) + 1);
  }
  const missing = books.filter((book) => !Number.isFinite(book.shelfRow));
  if (missing.length === books.length) {
    const rowCount = Math.max(2, Math.ceil(books.length / ROW_CAPACITY));
    const base = Math.floor(books.length / rowCount);
    const extra = books.length % rowCount;
    let offset = 0;
    const next = books.map((book, order) => {
      let row = 0;
      let cursor = 0;
      for (let i = 0; i < rowCount; i++) {
        const count = base + (i < extra ? 1 : 0);
        if (order < cursor + count) {
          row = i;
          break;
        }
        cursor += count;
        row = i + 1;
      }
      return { ...book, shelfRow: row, order };
    });
    await putBooks(next);
    return next;
  }
  const next = books.map((book, order) => {
    if (Number.isFinite(book.shelfRow)) return { ...book, order };
    let row = 0;
    while ((rows.get(row) ?? 0) >= ROW_CAPACITY) row++;
    rows.set(row, (rows.get(row) ?? 0) + 1);
    return { ...book, shelfRow: row, order };
  });
  await putBooks(next);
  return next;
}

export const useLibrary = create<LibraryState>((set, get) => ({
  books: [],
  status: 'idle',
  adding: false,
  initialize: async () => {
    if (get().status === 'loading' || get().status === 'ready') return;
    set({ status: 'loading' });
    try {
      let books = await listBooks();
      if (!books.length) {
        books = await seedLibrary();
      }
      books = await dedupeBooks(books);
      books = await ensureShelfRows(books);
      set({ books, status: 'ready' });
    } catch (err) {
      set({ status: 'error', error: (err as Error).message });
    }
  },
  addBook: async (file) => {
    if (get().adding) return null;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      useToast.getState().push('只支持 PDF 文件', 'error');
      return null;
    }
    set({ adding: true });
    try {
      const fileHash = await hashFile(file);
      const currentBooks = get().books;
      const existing = currentBooks.find(
        (book) =>
          (fileHash && book.fileHash === fileHash) ||
          (!book.fileHash &&
            book.fileName.toLowerCase() === file.name.toLowerCase() &&
            book.size === file.size),
      );
      if (existing) {
        useToast.getState().push(`《${existing.titleZh || existing.title}》已经在书架上了`);
        return existing;
      }
      const meta = await readPdfMeta(file);
      const title = meta.title || file.name.replace(/\.pdf$/i, '');
      const titleKey = title.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
      const metaDuplicate = currentBooks.find(
        (book) =>
          !book.fileHash &&
          `${(book.titleZh || book.title).toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim()}|${book.size}|${book.pageCount}` ===
            `${titleKey}|${file.size}|${meta.pageCount}`,
      );
      if (metaDuplicate) {
        useToast.getState().push(`《${metaDuplicate.titleZh || metaDuplicate.title}》已经在书架上了`);
        return metaDuplicate;
      }
      const id = `book_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const rowCounts = new Map<number, number>();
      currentBooks.forEach((book) => {
        const row = book.shelfRow ?? 0;
        rowCounts.set(row, (rowCounts.get(row) ?? 0) + 1);
      });
      let shelfRow = 0;
      while ((rowCounts.get(shelfRow) ?? 0) >= ROW_CAPACITY) shelfRow++;
      const rowBooks = currentBooks.filter((book) => (book.shelfRow ?? 0) === shelfRow);
      const minOrder = rowBooks.reduce((min, book) => Math.min(min, book.order ?? 0), 0);
      const book: Book = {
        id,
        order: minOrder - 1,
        shelfRow,
        fileHash,
        title,
        author: meta.author || '未署名',
        fileName: file.name,
        size: file.size,
        pageCount: meta.pageCount,
        cover: meta.cover,
        accent: accentForTitle(title),
        spineColor: accentForTitle(title),
        createdAt: Date.now(),
        lastPage: 1,
        percent: 0,
        hasFile: true,
      };
      const { putFile } = await import('../lib/db');
      await putFile(id, file);
      await putBook(book);
      set({ books: [book, ...get().books] });
      useToast.getState().push(`《${title}》已放上书架`, 'success');
      return book;
    } catch (err) {
      useToast.getState().push(`打开 PDF 失败：${(err as Error).message}`, 'error');
      return null;
    } finally {
      set({ adding: false });
    }
  },
  updateBook: async (id, patch) => {
    const current = get().books.find((b) => b.id === id) ?? (await getBook(id));
    if (!current) return undefined;
    const next = { ...current, ...patch };
    await putBook(next);
    set({ books: get().books.map((b) => (b.id === id ? next : b)) });
    return next;
  },
  removeBook: async (id) => {
    const book = get().books.find((b) => b.id === id);
    if (!book) return;
    const anns = await listAnnotations(id);
    for (const a of anns) await removeAnnotation(a.id);
    const { deleteBook } = await import('../lib/db');
    await deleteBook(id);
    await closeBookPdf(id);
    set({ books: get().books.filter((b) => b.id !== id) });
    useToast.getState().push(`《${book.title}》已从书架取下`);
  },
  reorderBooks: async (rows) => {
    const current = get().books;
    const byId = new Map(current.map((book) => [book.id, book]));
    const seen = new Set<string>();
    const next: Book[] = [];
    rows.forEach((ids, shelfRow) => {
      ids.forEach((id, order) => {
        const book = byId.get(id);
        if (!book || seen.has(id)) return;
        seen.add(id);
        next.push({ ...book, shelfRow, order });
      });
    });
    for (const book of current) {
      if (!seen.has(book.id)) next.push(book);
    }
    try {
      await putBooks(next);
      set({ books: next });
    } catch (err) {
      useToast.getState().push(`整理书架失败：${(err as Error).message}`, 'error');
    }
  },
}));

export async function loadManifest(): Promise<SeedManifest> {
  const res = await fetch(new URL('books/manifest.json', document.baseURI));
  if (!res.ok) throw new Error('示例书架清单加载失败');
  return res.json();
}
