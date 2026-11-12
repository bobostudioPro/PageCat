import { completionsUrl } from './ai/provider';
import { useSettings } from '../state/settings';

export type TranslationProvider = 'ai' | 'free';
export type TranslationLang = 'zh' | 'en';

export type TranslationOutcome = {
  texts: string[];
  provider: TranslationProvider;
  sourceLang: TranslationLang;
  targetLang: TranslationLang;
};

const CACHE_KEY = 'pagecat.translations.v1';
const memory = new Map<string, string>();
let loaded = false;

function loadCache() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const [key, value] of Object.entries(parsed)) memory.set(key, value);
  } catch {
    // cache is optional
  }
}

function saveCache() {
  try {
    const entries = [...memory.entries()].slice(-1000);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // quota errors are fine; memory cache still works
  }
}

function cacheGet(key: string) {
  loadCache();
  return memory.get(key);
}

function cacheSet(key: string, value: string) {
  memory.set(key, value);
  saveCache();
}

function cjkRatio(text: string) {
  const chars = [...text].filter((ch) => /\S/.test(ch));
  if (!chars.length) return 0;
  return chars.filter((ch) => /[\u3400-\u9fff]/.test(ch)).length / chars.length;
}

export function directionFor(texts: string[]): { sourceLang: TranslationLang; targetLang: TranslationLang } {
  const sourceLang = cjkRatio(texts.join(' ')) > 0.2 ? 'zh' : 'en';
  return { sourceLang, targetLang: sourceLang === 'zh' ? 'en' : 'zh' };
}

function splitChunks(text: string, max = 430) {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    let cut = Math.max(
      rest.lastIndexOf('. ', max),
      rest.lastIndexOf('! ', max),
      rest.lastIndexOf('? ', max),
      rest.lastIndexOf('; ', max),
    );
    if (cut < max * 0.45) cut = rest.lastIndexOf(' ', max);
    if (cut < max * 0.35) cut = max;
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function fetchWithTimeout(url: string, timeout = 15000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

async function freeTranslateParagraph(text: string, sourceLang: TranslationLang, targetLang: TranslationLang) {
  const chunks = splitChunks(text);
  const translated: string[] = [];
  for (const chunk of chunks) {
    const key = `free:${sourceLang}:${targetLang}:${chunk}`;
    const cached = cacheGet(key);
    if (cached) {
      translated.push(cached);
      continue;
    }
    const pair = `${sourceLang === 'zh' ? 'zh-CN' : 'en'}|${targetLang === 'zh' ? 'zh-CN' : 'en'}`;
    const res = await fetchWithTimeout(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${encodeURIComponent(pair)}`,
    );
    if (!res.ok) throw new Error(`免费翻译接口返回 ${res.status}，请稍后重试或接入 AI。`);
    const data = (await res.json()) as {
      responseData?: { translatedText?: string };
      responseStatus?: number;
      quotaFinished?: boolean;
      responseDetails?: string;
    };
    if (data.quotaFinished) throw new Error('免费翻译今日额度已用完，请切换为 AI 翻译，或明天再试。');
    const value = data.responseData?.translatedText?.trim();
    if (!value || data.responseStatus !== 200) throw new Error(data.responseDetails || '免费翻译没有返回结果。');
    cacheSet(key, value);
    translated.push(value);
    await new Promise((resolve) => window.setTimeout(resolve, 90));
  }
  return translated.join(sourceLang === 'zh' ? ' ' : ' ');
}

function parseAiArray(content: string) {
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) return parsed;
  } catch {
    // fall through to bracket extraction
  }
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) return parsed;
    } catch {
      // ignore
    }
  }
  return null;
}

async function translateWithAi(texts: string[], sourceLang: TranslationLang, targetLang: TranslationLang, context?: string) {
  const settings = useSettings.getState();
  if (!settings.aiApiKey || !settings.aiBaseUrl || !settings.aiModel) return null;
  const source = sourceLang === 'zh' ? 'Chinese' : 'English';
  const target = targetLang === 'zh' ? 'Simplified Chinese' : 'English';
  const groups: string[][] = [];
  let current: string[] = [];
  let size = 0;
  for (const text of texts) {
    if (current.length && size + text.length > 7000) {
      groups.push(current);
      current = [];
      size = 0;
    }
    current.push(text);
    size += text.length;
  }
  if (current.length) groups.push(current);
  const output: string[] = [];
  for (const group of groups) {
    const response = await fetch(completionsUrl(settings.aiBaseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.aiApiKey}` },
      body: JSON.stringify({
        model: settings.aiModel,
        stream: false,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: `You are a careful literary translator. Translate the user's JSON array of ${source} passages into natural ${target}. Preserve paragraph breaks and names. Return ONLY a JSON array of ${target} strings in the same order, with exactly ${group.length} items and no commentary or code fences.${context ? ` Context: ${context}` : ''}`,
          },
          { role: 'user', content: JSON.stringify(group) },
        ],
      }),
    });
    if (!response.ok) throw new Error(`翻译接口返回 ${response.status}`);
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = parseAiArray(data.choices?.[0]?.message?.content ?? '');
    if (!parsed || parsed.length !== group.length) throw new Error('翻译接口返回的内容格式不正确');
    output.push(...parsed);
  }
  return output;
}

export async function translateTexts(
  texts: string[],
  options: { context?: string; force?: boolean } = {},
): Promise<TranslationOutcome> {
  const cleanTexts = texts.map((text) => text.trim());
  if (!cleanTexts.some(Boolean)) {
    return { texts: cleanTexts, provider: 'free', sourceLang: 'en', targetLang: 'zh' };
  }
  const { sourceLang, targetLang } = directionFor(cleanTexts);
  const settings = useSettings.getState();
  if (settings.aiApiKey && settings.aiBaseUrl && settings.aiModel) {
    try {
      const aiTexts = await translateWithAi(cleanTexts, sourceLang, targetLang, options.context);
      if (aiTexts) {
        aiTexts.forEach((value, index) => cacheSet(`ai:${sourceLang}:${targetLang}:${cleanTexts[index]}`, value));
        return { texts: aiTexts, provider: 'ai', sourceLang, targetLang };
      }
    } catch (err) {
      // fall through to the free translator; the UI can still show the text
      console.warn('AI translation failed', err);
    }
  }
  const translated: string[] = [];
  for (const text of cleanTexts) {
    if (!text) {
      translated.push('');
      continue;
    }
    const key = `ai:${sourceLang}:${targetLang}:${text}`;
    const cached = cacheGet(key);
    if (cached && !options.force) {
      translated.push(cached);
      continue;
    }
    translated.push(await freeTranslateParagraph(text, sourceLang, targetLang));
  }
  return { texts: translated, provider: 'free', sourceLang, targetLang };
}

export function translationErrorMessage(err: unknown) {
  const message = (err as Error).message || '翻译失败';
  if (/Failed to fetch|NetworkError|aborted/i.test(message)) {
    return '翻译服务暂时无法连接，请检查网络后重试，或在设置里接入 AI。';
  }
  return message;
}
