import { create } from 'zustand';
import type { Book, SeedManifest } from '../types';
import { putBook, getBook, listBooks, removeAnnotation, listAnnotations } from '../lib/db';
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
};

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
      const meta = await readPdfMeta(file);
      const id = `book_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const title = meta.title || file.name.replace(/\.pdf$/i, '');
      const book: Book = {
        id,
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
}));

export async function loadManifest(): Promise<SeedManifest> {
  const res = await fetch(new URL('books/manifest.json', document.baseURI));
  if (!res.ok) throw new Error('示例书架清单加载失败');
  return res.json();
}
