import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Book, OutlineItem } from '../types';
import { getFile, putFile } from './db';
import { normalizeText } from './utils';

GlobalWorkerOptions.workerSrc = workerUrl;

const base = import.meta.env.BASE_URL;
const documentOptions = {
  cMapUrl: `${base}pdfjs/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${base}pdfjs/standard_fonts/`,
  wasmUrl: `${base}pdfjs/wasm/`,
  iccUrl: `${base}pdfjs/iccs/`,
};

const docCache = new Map<string, Promise<PDFDocumentProxy>>();
const taskCache = new Map<string, { destroy: () => Promise<void> }>();

export function resolveAsset(path: string) {
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  return new URL(path.replace(/^\.\//, ''), document.baseURI).href;
}

async function fileForBook(book: Book) {
  const cached = await getFile(book.id);
  if (cached) return cached;
  if (!book.samplePdf) throw new Error('这本书的 PDF 文件不见了');
  const res = await fetch(resolveAsset(book.samplePdf));
  if (!res.ok) throw new Error(`示例书下载失败（${res.status}）`);
  const blob = await res.blob();
  await putFile(book.id, blob);
  return blob;
}

export async function openBookPdf(book: Book) {
  const existing = docCache.get(book.id);
  if (existing) return existing;
  const task = (async () => {
    const blob = await fileForBook(book);
    const data = new Uint8Array(await blob.arrayBuffer());
    const loadingTask = getDocument({ ...documentOptions, data });
    taskCache.set(book.id, loadingTask);
    return loadingTask.promise;
  })();
  docCache.set(book.id, task);
  try {
    return await task;
  } catch (err) {
    docCache.delete(book.id);
    throw err;
  }
}

export async function closeBookPdf(bookId: string) {
  const cached = docCache.get(bookId);
  docCache.delete(bookId);
  if (cached) {
    try {
      await cached;
      await taskCache.get(bookId)?.destroy();
    } catch {
      // ignore
    }
  }
  taskCache.delete(bookId);
}

export function clearPdfCache() {
  docCache.clear();
}

export async function readPdfMeta(blob: Blob) {
  const data = new Uint8Array(await blob.arrayBuffer());
  const loadingTask = getDocument({ ...documentOptions, data });
  const doc = await loadingTask.promise;
  try {
    const meta = await doc.getMetadata().catch(() => null);
    const info = (meta?.info ?? {}) as Record<string, unknown>;
    const title = typeof info.Title === 'string' ? info.Title.trim() : '';
    const author = typeof info.Author === 'string' ? info.Author.trim() : '';
    const page = await doc.getPage(1);
    const cover = await renderCover(doc, page);
    return { title, author, pageCount: doc.numPages, cover };
  } finally {
    await loadingTask.destroy();
  }
}

async function renderCover(doc: PDFDocumentProxy, page: PDFPageProxy) {
  const baseViewport = page.getViewport({ scale: 1 });
  const targetWidth = 520;
  const scale = targetWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.fillStyle = '#fbf7ef';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, viewport, background: '#fbf7ef' }).promise;
  return canvas.toDataURL('image/jpeg', 0.82);
}

export async function getOutline(doc: PDFDocumentProxy): Promise<OutlineItem[]> {
  const raw = await doc.getOutline().catch(() => null);
  if (!raw?.length) return [];
  const items: OutlineItem[] = [];
  const walk = async (nodes: typeof raw, level: number) => {
    for (const node of nodes) {
      let page = 1;
      try {
        let dest = node.dest;
        if (typeof dest === 'string') dest = await doc.getDestination(dest);
        if (Array.isArray(dest) && dest[0]) {
          const index = await doc.getPageIndex(dest[0] as never);
          page = index + 1;
        }
      } catch {
        page = 1;
      }
      const title = (node.title || '').replace(/\s+/g, ' ').trim();
      if (title) items.push({ title, page, level });
      if (node.items?.length && level < 3) await walk(node.items, level + 1);
    }
  };
  await walk(raw, 0);
  return items.slice(0, 120);
}


export function cleanPageFurniture(text: string) {
  let t = normalizeText(text);
  t = t.replace(/^.*?\bChapter\s+[A-Za-z0-9]+\b[.:]?\s*/i, '');
  t = t.replace(/^.*?\bThe\s+(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth)\s+Book\b\s*/i, '');
  t = t.replace(/^.*?第\s*[一二三四五六七八九十]+\s*章\s*\S{1,14}\s*/, '');
  t = t.replace(/\s*(?:[A-Z]\s*){2,}·\s*P\s*A\s*G\s*E\s*C\s*A\s*T\s*$/i, '');
  t = t.replace(/\s*P\s*A\s*G\s*E\s*C\s*A\s*T\s*$/i, '');
  return t.trim();
}


export type PageParagraph = { index: number; text: string };

export async function getPageParagraphs(doc: PDFDocumentProxy, pageNumber: number): Promise<PageParagraph[]> {
  const page = await doc.getPage(pageNumber);
  try {
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    type Line = { y: number; height: number; items: { x: number; str: string }[] };
    const lines: Line[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const tx = item.transform;
      const y = tx[5];
      if (y > viewport.height * 0.965 || y < viewport.height * 0.025) continue;
      const height = Math.abs(tx[3]) || item.height || 10;
      const line = lines.find((l) => Math.abs(l.y - y) < Math.max(2, height * 0.35));
      if (line) line.items.push({ x: tx[4], str: item.str });
      else lines.push({ y, height, items: [{ x: tx[4], str: item.str }] });
    }
    lines.sort((a, b) => b.y - a.y);
    const visible = lines
      .map((line) => {
        const text = normalizeText(
          line.items
            .sort((a, b) => a.x - b.x)
            .map((i) => i.str)
            .join(' '),
        );
        return { ...line, text };
      })
      .filter((line) => {
        if (line.text.length < 2) return false;
        if (/^(?:[A-Z]\s+){2,}[A-Z]/.test(line.text)) return false;
        if (/P\s*A\s*G\s*E\s*C\s*A\s*T/i.test(line.text)) return false;
        return true;
      });

    const gaps: number[] = [];
    for (let i = 1; i < visible.length; i++) {
      const gap = Math.abs(visible[i - 1].y - visible[i].y);
      if (gap > 1 && gap < 60) gaps.push(gap);
    }
    gaps.sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)] ?? 14;
    const paragraphs: string[][] = [];
    let current: string[] = [];
    for (let i = 0; i < visible.length; i++) {
      const line = visible[i];
      if (i > 0) {
        const gap = Math.abs(visible[i - 1].y - line.y);
        if (gap > median * 1.16) {
          if (current.length) paragraphs.push(current);
          current = [];
        }
      }
      current.push(line.text);
    }
    if (current.length) paragraphs.push(current);

    return paragraphs
      .map((parts) => cleanPageFurniture(parts.join(' ')))
      .filter((text) => text.length >= 60)
      .slice(0, 12)
      .map((text, index) => ({ index, text }));
  } finally {
    page.cleanup();
  }
}

export const textCache = new Map<string, string[]>();

export async function getPageTexts(doc: PDFDocumentProxy, bookId: string) {
  const cached = textCache.get(bookId);
  if (cached) return cached;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      cleanPageFurniture(
        content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' '),
      ),
    );
    page.cleanup();
  }
  textCache.set(bookId, pages);
  return pages;
}

export async function getPageText(doc: PDFDocumentProxy, pageNumber: number) {
  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();
  const text = cleanPageFurniture(
    content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' '),
  );
  page.cleanup();
  return text;
}
