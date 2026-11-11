import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings } from '../types';

type SettingsState = Settings & {
  update: (patch: Partial<Settings>) => void;
  resetApi: () => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      aiProvider: 'deepseek',
      aiBaseUrl: 'https://api.deepseek.com',
      aiModel: 'deepseek-chat',
      aiApiKey: '',
      aiTemperature: 0.6,
      readerTheme: 'paper',
      pageTurnSound: false,
      update: (patch) => set(patch),
      resetApi: () =>
        set({ aiApiKey: '', aiBaseUrl: 'https://api.deepseek.com', aiModel: 'deepseek-chat', aiProvider: 'deepseek' }),
    }),
    {
      name: 'pagecat.settings.v1',
      partialize: ({ update, resetApi, ...rest }) => rest,
    },
  ),
);
