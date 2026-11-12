import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Annotation, Book, BookChat, ChatSession, Note } from '../types';

interface PageCatDB extends DBSchema {
  books: {
    key: string;
    value: Book;
    indexes: { 'by-created': number };
  };
  files: {
    key: string;
    value: { id: string; blob: Blob; savedAt: number };
  };
  annotations: {
    key: string;
    value: Annotation;
    indexes: { 'by-book': string };
  };
  notes: {
    key: string;
    value: Note;
    indexes: { 'by-book': string };
  };
  chats: {
    key: string;
    value: BookChat;
  };
  sessions: {
    key: string;
    value: ChatSession;
    indexes: { 'by-book': string };
  };
  meta: {
    key: string;
    value: { key: string; value: unknown };
  };
}

let promise: Promise<IDBPDatabase<PageCatDB>> | null = null;

export function db() {
  if (!promise) {
    promise = openDB<PageCatDB>('pagecat', 2, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('books')) {
          const books = database.createObjectStore('books', { keyPath: 'id' });
          books.createIndex('by-created', 'createdAt');
        }
        if (!database.objectStoreNames.contains('files')) {
          database.createObjectStore('files', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('annotations')) {
          const ann = database.createObjectStore('annotations', { keyPath: 'id' });
          ann.createIndex('by-book', 'bookId');
        }
        if (!database.objectStoreNames.contains('notes')) {
          const notes = database.createObjectStore('notes', { keyPath: 'id' });
          notes.createIndex('by-book', 'bookId');
        }
        if (!database.objectStoreNames.contains('chats')) {
          database.createObjectStore('chats', { keyPath: 'bookId' });
        }
        if (!database.objectStoreNames.contains('meta')) {
          database.createObjectStore('meta', { keyPath: 'key' });
        }
        if (!database.objectStoreNames.contains('sessions')) {
          const sessions = database.createObjectStore('sessions', { keyPath: 'id' });
          sessions.createIndex('by-book', 'bookId');
        }
      },
    });
  }
  return promise;
}

export async function listBooks() {
  const database = await db();
  const books = await database.getAllFromIndex('books', 'by-created');
  const isReading = (book: Book) => Boolean(book.lastOpenedAt || book.percent || book.lastPage);
  return books.sort((a, b) => {
    const aReading = isReading(a);
    const bReading = isReading(b);
    if (aReading !== bReading) return aReading ? -1 : 1;
    if (aReading) return (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0);
    return b.createdAt - a.createdAt;
  });
}

export async function putBook(book: Book) {
  const database = await db();
  await database.put('books', book);
}

export async function getBook(id: string) {
  const database = await db();
  return database.get('books', id);
}

export async function deleteBook(id: string) {
  const database = await db();
  const [anns, notes] = await Promise.all([listAnnotations(id), listNotes(id)]);
  const sessions = await database.getAllFromIndex('sessions', 'by-book', id);
  const tx = database.transaction(['books', 'files', 'annotations', 'notes', 'chats', 'sessions'], 'readwrite');
  tx.objectStore('books').delete(id);
  tx.objectStore('files').delete(id);
  tx.objectStore('chats').delete(id);
  for (const a of anns) tx.objectStore('annotations').delete(a.id);
  for (const n of notes) tx.objectStore('notes').delete(n.id);
  for (const s of sessions) tx.objectStore('sessions').delete(s.id);
  await tx.done;
}

export async function getFile(id: string) {
  const database = await db();
  return (await database.get('files', id))?.blob;
}

export async function putFile(id: string, blob: Blob) {
  const database = await db();
  await database.put('files', { id, blob, savedAt: Date.now() });
}

export async function listAnnotations(bookId: string) {
  const database = await db();
  const rows = await database.getAllFromIndex('annotations', 'by-book', bookId);
  return rows.sort((a, b) => a.page - b.page || a.createdAt - b.createdAt);
}

export async function putAnnotation(annotation: Annotation) {
  const database = await db();
  await database.put('annotations', annotation);
}

export async function removeAnnotation(id: string) {
  const database = await db();
  await database.delete('annotations', id);
}

export async function listNotes(bookId: string) {
  const database = await db();
  const rows = await database.getAllFromIndex('notes', 'by-book', bookId);
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function putNote(note: Note) {
  const database = await db();
  await database.put('notes', note);
}

export async function removeNote(id: string) {
  const database = await db();
  await database.delete('notes', id);
}

export async function getChat(bookId: string) {
  const database = await db();
  return database.get('chats', bookId);
}

export async function putChat(chat: BookChat) {
  const database = await db();
  await database.put('chats', chat);
}

export async function removeChat(bookId: string) {
  const database = await db();
  await database.delete('chats', bookId);
}

export async function listSessions(bookId: string) {
  const database = await db();
  const rows = await database.getAllFromIndex('sessions', 'by-book', bookId);
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getSession(id: string) {
  const database = await db();
  return database.get('sessions', id);
}

export async function putSession(session: ChatSession) {
  const database = await db();
  await database.put('sessions', session);
}

export async function removeSession(id: string) {
  const database = await db();
  await database.delete('sessions', id);
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const database = await db();
  const row = await database.get('meta', key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown) {
  const database = await db();
  await database.put('meta', { key, value });
}

export async function clearEverything() {
  const database = await db();
  const tx = database.transaction(['books', 'files', 'annotations', 'notes', 'chats', 'sessions', 'meta'], 'readwrite');
  await Promise.all([
    tx.objectStore('books').clear(),
    tx.objectStore('files').clear(),
    tx.objectStore('annotations').clear(),
    tx.objectStore('notes').clear(),
    tx.objectStore('chats').clear(),
    tx.objectStore('sessions').clear(),
    tx.objectStore('meta').clear(),
  ]);
  await tx.done;
}
