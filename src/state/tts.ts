import { create } from 'zustand';

type TtsState = {
  speaking: boolean;
  paused: boolean;
  label: string;
  lang: string;
  error: string | null;
  speak: (text: string, options?: { label?: string; lang?: string }) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
};

let chunks: string[] = [];
let chunkIndex = 0;
let active = false;
let currentUtterance: SpeechSynthesisUtterance | null = null;

function cjkRatio(text: string) {
  const chars = [...text].filter((ch) => /\S/.test(ch));
  if (!chars.length) return 0;
  return chars.filter((ch) => /[\u3400-\u9fff]/.test(ch)).length / chars.length;
}

function splitForSpeech(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let rest = normalized;
  while (rest.length > 220) {
    let cut = Math.max(rest.lastIndexOf('. ', 220), rest.lastIndexOf('。', 220), rest.lastIndexOf('! ', 220), rest.lastIndexOf('? ', 220));
    if (cut < 80) cut = rest.lastIndexOf(' ', 220);
    if (cut < 60) cut = 220;
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function pickVoice(lang: string) {
  const synth = window.speechSynthesis;
  if (!synth) return null;
  const voices = synth.getVoices();
  const exact = voices.find((voice) => voice.lang.toLowerCase().startsWith(lang.toLowerCase()));
  if (exact) return exact;
  if (lang.startsWith('zh')) return voices.find((voice) => voice.lang.toLowerCase().startsWith('zh')) ?? null;
  return voices.find((voice) => voice.lang.toLowerCase().startsWith('en')) ?? null;
}

export const useTts = create<TtsState>((set, get) => {
  const finish = () => {
    active = false;
    currentUtterance = null;
    set({ speaking: false, paused: false, label: '', lang: '', error: null });
  };

  const speakChunk = () => {
    if (!active) return;
    const synth = window.speechSynthesis;
    if (!synth) {
      set({ speaking: false, error: '当前浏览器不支持语音朗读。' });
      return;
    }
    if (chunkIndex >= chunks.length) {
      finish();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
    const { lang } = get();
    utterance.lang = lang;
    utterance.rate = lang.startsWith('zh') ? 0.92 : 0.98;
    utterance.pitch = 1;
    const voice = pickVoice(lang);
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      if (!active) return;
      chunkIndex += 1;
      speakChunk();
    };
    utterance.onerror = (event) => {
      if (!active || event.error === 'canceled' || event.error === 'interrupted') return;
      set({ speaking: false, paused: false, error: '语音播放失败，换一个浏览器或声音再试。' });
      active = false;
    };
    currentUtterance = utterance;
    synth.speak(utterance);
  };

  const stopInternal = () => {
    active = false;
    chunkIndex = 0;
    chunks = [];
    currentUtterance = null;
    window.speechSynthesis?.cancel();
  };

  return {
    speaking: false,
    paused: false,
    label: '',
    lang: '',
    error: null,
    speak: (text, options = {}) => {
      if (!('speechSynthesis' in window)) {
        set({ speaking: false, error: '当前浏览器不支持语音朗读。' });
        return;
      }
      stopInternal();
      const nextChunks = splitForSpeech(text);
      if (!nextChunks.length) {
        set({ speaking: false, error: '没有可朗读的文字。' });
        return;
      }
      const sourceLang = options.lang ?? (cjkRatio(text) > 0.2 ? 'zh-CN' : 'en-US');
      chunks = nextChunks;
      chunkIndex = 0;
      active = true;
      set({
        speaking: true,
        paused: false,
        label: options.label ?? '正在朗读',
        lang: sourceLang,
        error: null,
      });
      // Give the browser a tick to load its voice list and cancel the previous queue.
      window.setTimeout(() => {
        if (active) speakChunk();
      }, 40);
    },
    pause: () => {
      if (!get().speaking) return;
      window.speechSynthesis?.pause();
      set({ paused: true });
    },
    resume: () => {
      if (!get().speaking) return;
      window.speechSynthesis?.resume();
      set({ paused: false });
    },
    stop: () => {
      stopInternal();
      set({ speaking: false, paused: false, label: '', lang: '', error: null });
    },
  };
});
