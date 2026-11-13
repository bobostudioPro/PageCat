import { create } from 'zustand';
import type { Annotation, Note, Rect } from '../types';
import {
  listAnnotations,
  listNotes,
  putAnnotation,
  putNote,
  removeAnnotation,
  removeNote,
} from '../lib/db';
import { uid } from '../lib/utils';

type NewAnnotation = {
  bookId: string;
  page: number;
  color: Annotation['color'];
  style: Annotation['style'];
  text: string;
  rects: Rect[];
  favorite?: boolean;
  note?: string;
};

type AnnotationState = {
  byBook: Record<string, Annotation[]>;
  notesByBook: Record<string, Note[]>;
  loading: string | null;
  load: (bookId: string) => Promise<void>;
  add: (input: NewAnnotation) => Promise<Annotation>;
  update: (id: string, patch: Partial<Annotation>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setRects: (id: string, rects: Rect[]) => Promise<void>;
  addNote: (bookId: string, page: number, text: string, opts?: { quote?: string; annotationId?: string }) => Promise<Note>;
  updateNote: (id: string, text: string) => Promise<void>;
  removeNote: (id: string) => Promise<void>;
};

export const useAnnotations = create<AnnotationState>((set, get) => ({
  byBook: {},
  notesByBook: {},
  loading: null,
  load: async (bookId) => {
    set({ loading: bookId });
    const [annotations, notes] = await Promise.all([listAnnotations(bookId), listNotes(bookId)]);
    set({
      byBook: { ...get().byBook, [bookId]: annotations },
      notesByBook: { ...get().notesByBook, [bookId]: notes },
      loading: null,
    });
  },
  add: async (input) => {
    const now = Date.now();
    const annotationId = uid('ann');
    let noteId: string | undefined;
    if (input.note?.trim()) {
      const note: Note = {
        id: uid('note'),
        bookId: input.bookId,
        page: input.page,
        text: input.note.trim(),
        quote: input.text,
        annotationId,
        createdAt: now,
        updatedAt: now,
      };
      await putNote(note);
      noteId = note.id;
      const existing = get().notesByBook[input.bookId] ?? [];
      set({ notesByBook: { ...get().notesByBook, [input.bookId]: [note, ...existing] } });
    }
    const annotation: Annotation = {
      id: annotationId,
      bookId: input.bookId,
      page: input.page,
      color: input.color,
      style: input.style,
      text: input.text,
      quote: input.text,
      rects: input.rects,
      favorite: input.favorite ?? false,
      noteId,
      createdAt: now,
      updatedAt: now,
    };
    await putAnnotation(annotation);
    const existing = get().byBook[input.bookId] ?? [];
    set({
      byBook: {
        ...get().byBook,
        [input.bookId]: [...existing, annotation].sort((a, b) => a.page - b.page || a.createdAt - b.createdAt),
      },
    });
    return annotation;
  },
  update: async (id, patch) => {
    const entries = Object.entries(get().byBook);
    for (const [bookId, annotations] of entries) {
      const current = annotations.find((a) => a.id === id);
      if (!current) continue;
      const next = { ...current, ...patch, updatedAt: Date.now() };
      await putAnnotation(next);
      set({
        byBook: {
          ...get().byBook,
          [bookId]: annotations.map((a) => (a.id === id ? next : a)),
        },
      });
      return;
    }
  },
  remove: async (id) => {
    for (const [bookId, annotations] of Object.entries(get().byBook)) {
      const target = annotations.find((a) => a.id === id);
      if (!target) continue;
      await removeAnnotation(id);
      if (target.noteId) {
        await removeNote(target.noteId);
        const notes = (get().notesByBook[bookId] ?? []).filter((n) => n.id !== target.noteId);
        set({ notesByBook: { ...get().notesByBook, [bookId]: notes } });
      }
      set({
        byBook: { ...get().byBook, [bookId]: annotations.filter((a) => a.id !== id) },
      });
      return;
    }
  },
  setRects: async (id, rects) => {
    const entries = Object.entries(get().byBook);
    for (const [bookId, annotations] of entries) {
      const target = annotations.find((a) => a.id === id);
      if (!target) continue;
      const next = { ...target, rects, updatedAt: Date.now() };
      await putAnnotation(next);
      set({ byBook: { ...get().byBook, [bookId]: annotations.map((a) => (a.id === id ? next : a)) } });
      return;
    }
  },
  addNote: async (bookId, page, text, opts) => {
    const now = Date.now();
    const note: Note = {
      id: uid('note'),
      bookId,
      page,
      text: text.trim(),
      quote: opts?.quote,
      annotationId: opts?.annotationId,
      createdAt: now,
      updatedAt: now,
    };
    await putNote(note);
    if (opts?.annotationId) {
      const annotations = get().byBook[bookId] ?? [];
      const target = annotations.find((a) => a.id === opts.annotationId);
      if (target) {
        const next = { ...target, noteId: note.id, updatedAt: now };
        await putAnnotation(next);
        set({ byBook: { ...get().byBook, [bookId]: annotations.map((a) => (a.id === target.id ? next : a)) } });
      }
    }
    const existing = get().notesByBook[bookId] ?? [];
    set({ notesByBook: { ...get().notesByBook, [bookId]: [note, ...existing] } });
    return note;
  },
  updateNote: async (id, text) => {
    for (const [bookId, notes] of Object.entries(get().notesByBook)) {
      const current = notes.find((n) => n.id === id);
      if (!current) continue;
      const next = { ...current, text: text.trim(), updatedAt: Date.now() };
      await putNote(next);
      set({ notesByBook: { ...get().notesByBook, [bookId]: notes.map((n) => (n.id === id ? next : n)) } });
      return;
    }
  },
  removeNote: async (id) => {
    for (const [bookId, notes] of Object.entries(get().notesByBook)) {
      const target = notes.find((n) => n.id === id);
      if (!target) continue;
      await removeNote(id);
      if (target.annotationId) {
        const annotations = get().byBook[bookId] ?? [];
        const annotated = annotations.find((a) => a.id === target.annotationId);
        if (annotated) {
          const next = { ...annotated, noteId: undefined, updatedAt: Date.now() };
          await putAnnotation(next);
          set({
            byBook: { ...get().byBook, [bookId]: annotations.map((a) => (a.id === annotated.id ? next : a)) },
          });
        }
      }
      set({ notesByBook: { ...get().notesByBook, [bookId]: notes.filter((n) => n.id !== id) } });
      return;
    }
  },
}));
