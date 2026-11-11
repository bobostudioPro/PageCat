import type { Annotation, Book, Note, OutlineItem } from '../../types';

export type AiContext = {
  book: Book;
  page: number;
  pageCount: number;
  currentPageText: string;
  contextPages: { page: number; text: string }[];
  digest: { page: number; text: string }[];
  selection?: string;
  annotations: Annotation[];
  notes: Note[];
  toc: OutlineItem[];
  scope: 'page' | 'book';
};

export type AiReply = {
  content: string;
  mode: 'local' | 'online';
};

export type ChatTurn = { role: 'user' | 'assistant'; content: string };
