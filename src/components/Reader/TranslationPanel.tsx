import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Languages, Loader2, RefreshCw, Volume2 } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Book } from '../../types';
import { getPageParagraphs, getPageText, type PageParagraph } from '../../lib/pdf';
import { directionFor, translateTexts, translationErrorMessage, type TranslationProvider } from '../../lib/translate';
import { useTts } from '../../state/tts';
import { useToast } from '../../state/toast';

type Props = {
  book: Book;
  doc: PDFDocumentProxy;
  page: number;
  pageCount: number;
  onJump: (page: number) => void;
};

type PageTranslation = {
  page: number;
  paragraphs: PageParagraph[];
  translations: string[];
  provider?: TranslationProvider;
  sourceLang: 'zh' | 'en';
  targetLang: 'zh' | 'en';
  translated: boolean;
};

const PAGE_CACHE_KEY = 'pagecat.translationPages.v1';

function pageCacheKey(bookId: string, page: number) {
  return `${bookId}:${page}`;
}

function readAllCache(): Record<string, PageTranslation> {
  try {
    const raw = localStorage.getItem(PAGE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, PageTranslation>) : {};
  } catch {
    return {};
  }
}

function readBookCache(bookId: string) {
  const all = readAllCache();
  const map = new Map<number, PageTranslation>();
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(`${bookId}:`) || !value?.translated) continue;
    map.set(value.page, value);
  }
  return map;
}

function persistPage(bookId: string, data: PageTranslation) {
  try {
    const all = readAllCache();
    all[pageCacheKey(bookId, data.page)] = data;
    const entries = Object.entries(all).slice(-300);
    localStorage.setItem(PAGE_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // history is best-effort; the current session still keeps it in memory
  }
}

export function TranslationPanel({ book, doc, page, pageCount, onJump }: Props) {
  const [mode, setMode] = useState<'page' | 'book'>('page');
  const [data, setData] = useState<PageTranslation | null>(null);
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translatedPages, setTranslatedPages] = useState<number[]>([]);
  const cache = useRef(new Map<number, PageTranslation>());
  const requestRef = useRef(0);
  const pageRef = useRef(page);
  const speak = useTts((state) => state.speak);
  const toast = useToast((state) => state.push);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    const loaded = readBookCache(book.id);
    cache.current = loaded;
    setTranslatedPages([...loaded.keys()].sort((a, b) => a - b));
    setData(null);
    setError(null);
  }, [book.id]);

  useEffect(() => {
    let cancelled = false;
    const request = requestRef.current + 1;
    requestRef.current = request;

    const cached = cache.current.get(page);
    if (cached) {
      setData(cached);
      setError(null);
      setLoading(false);
      return;
    }

    setData(null);
    setError(null);
    setLoading(true);
    void (async () => {
      try {
        const paragraphs = await getPageParagraphs(doc, page);
        if (cancelled || requestRef.current !== request) return;
        const direction = directionFor(paragraphs.map((item) => item.text));
        setData({
          page,
          paragraphs,
          translations: [],
          sourceLang: direction.sourceLang,
          targetLang: direction.targetLang,
          translated: false,
        });
      } catch (err) {
        if (!cancelled && requestRef.current === request) setError(translationErrorMessage(err));
      } finally {
        if (!cancelled && requestRef.current === request) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, doc, book.id]);

  const loadPageAgain = async () => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    setLoading(true);
    setError(null);
    try {
      const paragraphs = await getPageParagraphs(doc, page);
      if (requestRef.current !== request) return;
      const direction = directionFor(paragraphs.map((item) => item.text));
      setData({
        page,
        paragraphs,
        translations: [],
        sourceLang: direction.sourceLang,
        targetLang: direction.targetLang,
        translated: false,
      });
    } catch (err) {
      if (requestRef.current === request) setError(translationErrorMessage(err));
    } finally {
      if (requestRef.current === request) setLoading(false);
    }
  };

  const translatePage = async (force = false) => {
    if (!data || !data.paragraphs.length || translating) return;
    const startedFor = data.page;
    setTranslating(true);
    setError(null);
    try {
      const outcome = await translateTexts(
        data.paragraphs.map((item) => item.text),
        {
          context: `Book: ${book.titleZh || book.title}. Page ${data.page}.`,
          force,
        },
      );
      if (pageRef.current !== startedFor) return;
      const next: PageTranslation = {
        ...data,
        translations: outcome.texts,
        provider: outcome.provider,
        sourceLang: outcome.sourceLang,
        targetLang: outcome.targetLang,
        translated: true,
      };
      cache.current.set(startedFor, next);
      persistPage(book.id, next);
      setData(next);
      setTranslatedPages((previous) => [...new Set([...previous, startedFor])].sort((a, b) => a - b));
    } catch (err) {
      if (pageRef.current === startedFor) setError(translationErrorMessage(err));
    } finally {
      setTranslating(false);
    }
  };

  const speakSource = async () => {
    try {
      const text = await getPageText(doc, page);
      if (!text.trim()) throw new Error('这一页没有可提取的文字');
      speak(text, { label: `第 ${page} 页原文`, lang: data?.sourceLang === 'zh' ? 'zh-CN' : 'en-US' });
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  const speakTarget = () => {
    const text = data?.translations.filter(Boolean).join(' ');
    if (!text) {
      toast('先翻译这一页，再朗读译文');
      return;
    }
    speak(text, { label: `第 ${page} 页译文`, lang: data?.targetLang === 'zh' ? 'zh-CN' : 'en-US' });
  };

  const targetLabel = data?.targetLang === 'en' ? 'English' : '中文';
  const providerLabel = data?.provider === 'ai' ? 'AI 翻译' : '免费翻译';

  return (
    <div className="translate-panel">
      <header className="translate-head">
        <div className="translate-heading">
          <span className="translate-mark">
            <Languages size={17} />
          </span>
          <div>
            <strong>双语对照</strong>
            <span>{targetLabel}译文{data?.translated ? ` · ${providerLabel}` : ''}</span>
          </div>
        </div>
        <div className="translate-modes">
          <button className={mode === 'page' ? 'active' : ''} onClick={() => setMode('page')}>
            本页
          </button>
          <button className={mode === 'book' ? 'active' : ''} onClick={() => setMode('book')}>
            整本
          </button>
        </div>
      </header>

      <div className="translate-toolbar">
        <button onClick={() => onJump(Math.max(1, page - 1))} disabled={page <= 1} aria-label="上一页">
          <ChevronLeft size={14} />
        </button>
        {mode === 'book' ? (
          <label className="translate-page-select">
            第
            <select value={page} onChange={(e) => onJump(Number(e.target.value))}>
              {Array.from({ length: pageCount }, (_, index) => (
                <option key={index} value={index + 1}>
                  {index + 1}
                </option>
              ))}
            </select>
            / {pageCount} 页
          </label>
        ) : (
          <span className="translate-page-label">第 {page} / {pageCount} 页</span>
        )}
        <button onClick={() => onJump(Math.min(pageCount, page + 1))} disabled={page >= pageCount} aria-label="下一页">
          <ChevronRight size={14} />
        </button>
        {translatedPages.length > 0 && (
          <select
            className="translate-history"
            value=""
            title="已翻译页面"
            aria-label="翻译历史"
            onChange={(e) => {
              const target = Number(e.target.value);
              if (target) onJump(target);
            }}
          >
            <option value="">已译 {translatedPages.length} 页</option>
            {translatedPages.map((item) => (
              <option key={item} value={item}>
                第 {item} 页
              </option>
            ))}
          </select>
        )}
        <span className="translate-spacer" />
        <button className="translate-icon-btn" onClick={speakSource} title="朗读原文" aria-label="朗读原文">
          <Volume2 size={14} />
        </button>
        <button className="translate-icon-btn" onClick={speakTarget} title="朗读译文" aria-label="朗读译文">
          <Volume2 size={14} />
        </button>
        {data?.translated && (
          <button className="translate-icon-btn" onClick={() => void translatePage(true)} title="重新翻译" aria-label="重新翻译" disabled={translating}>
            <RefreshCw size={13} className={translating ? 'spin' : ''} />
          </button>
        )}
      </div>

      {mode === 'book' && (
        <div className="translate-book-note">
          <span>整本对照 · 按页查看</span>
          <span>已译页面会保留</span>
        </div>
      )}

      <div className="translate-body">
        {loading && !data && (
          <div className="translate-loading">
            <Loader2 size={18} className="spin" />
            <span>正在读取这一页…</span>
          </div>
        )}
        {error && (
          <div className="translate-error">
            <strong>没有翻译成功</strong>
            <p>{error}</p>
            <button onClick={() => (data?.paragraphs.length ? void translatePage(true) : void loadPageAgain())}>再试一次</button>
          </div>
        )}
        {!error && data && data.paragraphs.length === 0 && (
          <div className="translate-empty">
            <Languages size={20} />
            <p>这一页没有可提取的文字。</p>
          </div>
        )}
        {!error && data && data.paragraphs.length > 0 && !data.translated && (
          <div className="translate-cta">
            <div>
              <strong>这一页还没有翻译</strong>
              <span>只有点击后才调用翻译；滚动切换页面不会自动翻译。</span>
            </div>
            <button onClick={() => void translatePage()} disabled={translating}>
              {translating ? <Loader2 size={13} className="spin" /> : <Languages size={13} />}
              {translating ? '翻译中…' : '翻译本页'}
            </button>
          </div>
        )}
        {!error &&
          data?.paragraphs.map((paragraph, index) => (
            <article className="translation-block" key={`${paragraph.index}-${index}`}>
              <div className="translation-source">
                <span className="translation-index">{paragraph.index + 1}</span>
                <p>{paragraph.text}</p>
                <button onClick={() => speak(paragraph.text, { label: `第 ${page} 页原文`, lang: data.sourceLang === 'zh' ? 'zh-CN' : 'en-US' })} aria-label="朗读这句原文" title="朗读原文">
                  <Volume2 size={12} />
                </button>
              </div>
              {data.translated && (
                <div className="translation-target">
                  {translating && !data.translations[index] ? (
                    <span className="translation-skeleton" />
                  ) : (
                    <p>{data.translations[index] || '—'}</p>
                  )}
                  {data.translations[index] && (
                    <button onClick={() => speak(data.translations[index], { label: `第 ${page} 页译文`, lang: data.targetLang === 'zh' ? 'zh-CN' : 'en-US' })} aria-label="朗读这句译文" title="朗读译文">
                      <Volume2 size={12} />
                    </button>
                  )}
                </div>
              )}
              {translating && !data.translated && <span className="translation-skeleton" />}
            </article>
          ))}
      </div>

      <footer className="translate-foot">
        <span>
          翻译只在你点击时生成，已译页面会保留；免费翻译会把当前文字发送到翻译服务。
        </span>
      </footer>
    </div>
  );
}
