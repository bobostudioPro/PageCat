import { create } from 'zustand';
import { uid } from '../lib/utils';

export type Toast = { id: string; text: string; tone?: 'default' | 'error' | 'success' };

type ToastState = {
  toasts: Toast[];
  push: (text: string, tone?: Toast['tone']) => void;
  dismiss: (id: string) => void;
};

export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  push: (text, tone = 'default') => {
    const id = uid('toast');
    set({ toasts: [...get().toasts, { id, text, tone }] });
    window.setTimeout(() => get().dismiss(id), 3600);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
