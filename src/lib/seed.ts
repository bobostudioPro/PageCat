import type { Book } from '../types';
import { getBook, getMeta, listBooks, putAnnotation, putBook, putNote, setMeta } from './db';
import { uid } from './utils';

export async function loadManifest(): Promise<{ version: number; books: Book[] }> {
  const res = await fetch(new URL('books/manifest.json', document.baseURI));
  if (!res.ok) throw new Error(`示例书架加载失败（${res.status}）`);
  return res.json();
}

async function seedAnnotations(book: Book) {
  if (!book.seedAnnotations?.length) return;
  const flagKey = `annotations-seeded:${book.id}`;
  if (await getMeta<boolean>(flagKey)) return;
  for (const [index, seed] of book.seedAnnotations.entries()) {
    const createdAt = Date.now() - (book.seedAnnotations.length - index) * 60_000;
    const annotationId = uid('ann');
    const noteId = seed.note ? uid('note') : undefined;
    await putAnnotation({
      id: annotationId,
      bookId: book.id,
      page: seed.page,
      color: seed.color,
      style: seed.style ?? 'highlight',
      text: seed.quote,
      quote: seed.quote,
      rects: [],
      favorite: seed.favorite ?? false,
      noteId,
      createdAt,
      updatedAt: createdAt,
      seed: true,
    });
    if (noteId) {
      await putNote({
        id: noteId,
        bookId: book.id,
        page: seed.page,
        text: seed.note!,
        quote: seed.quote,
        annotationId,
        createdAt,
        updatedAt: createdAt,
      });
    }
  }
  await setMeta(flagKey, true);
}

export async function seedLibrary() {
  const version = await getMeta<number>('seed.version');
  if (version) return listBooks();
  const manifest = await loadManifest();
  for (const [index, sample] of manifest.books.entries()) {
    const existing = await getBook(sample.id);
    if (existing) continue;
    const progress = sample.percent ?? sample.seedProgress ?? 0;
    const book: Book = {
      ...sample,
      createdAt: Date.now() - index * 1000,
      percent: progress,
      lastPage: sample.lastPage ?? Math.max(1, Math.round(progress * sample.pageCount)),
      lastOpenedAt: progress ? Date.now() - index * 1000 * 60 * 60 * 4 : undefined,
    };
    await putBook(book);
    await seedAnnotations(book);
  }
  await setMeta('seed.version', manifest.version);
  return listBooks();
}
