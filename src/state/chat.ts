import { create } from 'zustand';
import type { BookChat, ChatMessage } from '../types';
import { getChat, putChat } from '../lib/db';
import { uid } from '../lib/utils';

type ChatState = {
  byBook: Record<string, BookChat>;
  loading: string | null;
  load: (bookId: string) => Promise<void>;
  append: (bookId: string, message: Omit<ChatMessage, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) => ChatMessage;
  update: (bookId: string, id: string, patch: Partial<ChatMessage>) => void;
  clear: (bookId: string) => Promise<void>;
  persist: (bookId: string) => Promise<void>;
};

function blank(bookId: string): BookChat {
  return { bookId, messages: [], updatedAt: 0 };
}

export const useChat = create<ChatState>((set, get) => ({
  byBook: {},
  loading: null,
  load: async (bookId) => {
    if (get().byBook[bookId]) return;
    set({ loading: bookId });
    const chat = (await getChat(bookId)) ?? blank(bookId);
    set({ byBook: { ...get().byBook, [bookId]: chat }, loading: null });
  },
  append: (bookId, message) => {
    const chat = get().byBook[bookId] ?? blank(bookId);
    const full: ChatMessage = {
      id: message.id ?? uid('msg'),
      role: message.role,
      content: message.content,
      mode: message.mode,
      error: message.error,
      createdAt: message.createdAt ?? Date.now(),
    };
    const next = { ...chat, messages: [...chat.messages, full], updatedAt: Date.now() };
    set({ byBook: { ...get().byBook, [bookId]: next } });
    return full;
  },
  update: (bookId, id, patch) => {
    const chat = get().byBook[bookId];
    if (!chat) return;
    const next = {
      ...chat,
      messages: chat.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      updatedAt: Date.now(),
    };
    set({ byBook: { ...get().byBook, [bookId]: next } });
  },
  clear: async (bookId) => {
    const next = blank(bookId);
    set({ byBook: { ...get().byBook, [bookId]: next } });
    await putChat(next);
  },
  persist: async (bookId) => {
    const chat = get().byBook[bookId];
    if (chat) await putChat(chat);
  },
}));
