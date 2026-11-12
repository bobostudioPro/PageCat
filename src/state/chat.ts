import { create } from 'zustand';
import type { ChatMessage, ChatSession } from '../types';
import { getChat, listSessions, putSession, removeChat, removeSession } from '../lib/db';
import { uid } from '../lib/utils';

type NewMessage = Omit<ChatMessage, 'id' | 'createdAt'> & { id?: string; createdAt?: number };

type ChatState = {
  byBook: Record<string, ChatSession[]>;
  activeByBook: Record<string, string>;
  loading: string | null;
  load: (bookId: string) => Promise<void>;
  create: (bookId: string, title?: string) => Promise<ChatSession>;
  select: (bookId: string, sessionId: string) => void;
  remove: (bookId: string, sessionId: string) => Promise<void>;
  append: (bookId: string, message: NewMessage) => ChatMessage;
  update: (bookId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  persist: (bookId: string) => Promise<void>;
};

function titleFrom(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 26 ? `${clean.slice(0, 26)}…` : clean || '新的对话';
}

function newSession(bookId: string, messages: ChatMessage[] = []): ChatSession {
  const now = Date.now();
  return {
    id: uid('session'),
    bookId,
    title: messages.length ? '早先的对话' : '新的对话',
    messages,
    createdAt: now,
    updatedAt: now,
  };
}

function sortSessions(sessions: ChatSession[]) {
  return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
}

function activeSession(state: ChatState, bookId: string) {
  const sessions = state.byBook[bookId] ?? [];
  const activeId = state.activeByBook[bookId];
  return sessions.find((s) => s.id === activeId) ?? sessions[0];
}

const loads = new Map<string, Promise<void>>();

export const useChat = create<ChatState>((set, get) => ({
  byBook: {},
  activeByBook: {},
  loading: null,
  load: async (bookId) => {
    if (get().byBook[bookId]) return;
    if (loads.has(bookId)) return loads.get(bookId)!;
    const pending = (async () => {
      set({ loading: bookId });
      let sessions = await listSessions(bookId);
      if (!sessions.length) {
        const legacy = await getChat(bookId);
        if (legacy?.messages?.length) {
          const migrated = newSession(bookId, legacy.messages);
          const firstUser = legacy.messages.find((m) => m.role === 'user');
          migrated.title = firstUser ? titleFrom(firstUser.content) : '早先的对话';
          migrated.createdAt = legacy.messages[0]?.createdAt ?? migrated.createdAt;
          migrated.updatedAt = legacy.updatedAt ?? migrated.updatedAt;
          await putSession(migrated);
          await removeChat(bookId);
          sessions = [migrated];
        } else {
          const blank = newSession(bookId);
          await putSession(blank);
          sessions = [blank];
        }
      }
      // Repair duplicates left by concurrent mounts, and keep one blank draft at most.
      const withMessages = sessions.filter((s) => s.messages.length > 0);
      if (withMessages.length) {
        for (const empty of sessions.filter((s) => s.messages.length === 0)) {
          await removeSession(empty.id);
        }
        sessions = withMessages;
      } else if (sessions.length > 1) {
        const [keep, ...rest] = sortSessions(sessions);
        for (const empty of rest) await removeSession(empty.id);
        sessions = [keep];
      }
      sessions = sortSessions(sessions);
      set({
        byBook: { ...get().byBook, [bookId]: sessions },
        activeByBook: { ...get().activeByBook, [bookId]: sessions[0].id },
        loading: null,
      });
    })();
    loads.set(bookId, pending);
    try {
      await pending;
    } finally {
      loads.delete(bookId);
    }
  },
  create: async (bookId, title) => {
    const session = newSession(bookId);
    if (title) session.title = title;
    await putSession(session);
    const sessions = sortSessions([session, ...(get().byBook[bookId] ?? [])]);
    set({
      byBook: { ...get().byBook, [bookId]: sessions },
      activeByBook: { ...get().activeByBook, [bookId]: session.id },
    });
    return session;
  },
  select: (bookId, sessionId) => {
    set({ activeByBook: { ...get().activeByBook, [bookId]: sessionId } });
  },
  remove: async (bookId, sessionId) => {
    await removeSession(sessionId);
    let sessions = (get().byBook[bookId] ?? []).filter((s) => s.id !== sessionId);
    if (!sessions.length) {
      const blank = newSession(bookId);
      await putSession(blank);
      sessions = [blank];
    }
    const currentActive = get().activeByBook[bookId];
    const activeId = currentActive === sessionId ? sessions[0].id : currentActive;
    set({
      byBook: { ...get().byBook, [bookId]: sortSessions(sessions) },
      activeByBook: { ...get().activeByBook, [bookId]: activeId },
    });
  },
  append: (bookId, message) => {
    const session = activeSession(get(), bookId);
    if (!session) {
      throw new Error('No active chat session');
    }
    const full: ChatMessage = {
      id: message.id ?? uid('msg'),
      role: message.role,
      content: message.content,
      mode: message.mode,
      error: message.error,
      references: message.references,
      createdAt: message.createdAt ?? Date.now(),
    };
    const isFirstUser = message.role === 'user' && !session.messages.some((m) => m.role === 'user');
    const next: ChatSession = {
      ...session,
      title: isFirstUser ? titleFrom(message.content) : session.title,
      messages: [...session.messages, full],
      updatedAt: Date.now(),
    };
    const sessions = sortSessions((get().byBook[bookId] ?? []).map((s) => (s.id === session.id ? next : s)));
    set({
      byBook: { ...get().byBook, [bookId]: sessions },
      activeByBook: { ...get().activeByBook, [bookId]: session.id },
    });
    return full;
  },
  update: (bookId, messageId, patch) => {
    const session = activeSession(get(), bookId);
    if (!session) return;
    const next: ChatSession = {
      ...session,
      messages: session.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
      updatedAt: Date.now(),
    };
    const sessions = sortSessions((get().byBook[bookId] ?? []).map((s) => (s.id === session.id ? next : s)));
    set({ byBook: { ...get().byBook, [bookId]: sessions } });
  },
  persist: async (bookId) => {
    const session = activeSession(get(), bookId);
    if (session) await putSession(session);
  },
}));
