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
  paragraphs: PageParagraph[];
  translations: string[];
  provider: TranslationProvider;
  sourceLang: 'zh' | 'en';
  targetLang: 'zh' | 'en';
};

export function TranslationPanel({ book, doc, page, pageCount, onJump }: Props) {
  const [mode, setMode] = useState<'page' | 'book'>('page');
  const [data, setData] = useState<PageTranslation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef(new Map<number, PageTranslation>());
  const requestRef = useRef(0);
  const speak = useTts((state) => state.speak);
  const toast = useToast((state) => state.push);

  const loadPage = async (targetPage: number, force = false) => {
    if (!force && cache.current.has(targetPage)) {
      setData(cache.current.get(targetPage)!);
      setError(null);
      return;
    }
    const request = requestRef.current + 1;
    requestRef.current = request;
    setLoading(true);
    setError(null);
    if (!force) setData(null);
    try {
      const paragraphs = await getPageParagraphs(doc, targetPage);
      if (!paragraphs.length) {
        const empty: PageTranslation = {
          paragraphs: [],
          translations: [],
          provider: 'free',
          sourceLang: 'en',
          targetLang: 'zh',
        };
        cache.current.set(targetPage, empty);
        if (requestRef.current === request) setData(empty);
        return;
      }
      const direction = directionFor(paragraphs.map((item) => item.text));
      const outcome = await translateTexts(paragraphs.map((item) => item.text), {
        context: `Book: ${book.titleZh || book.title}. Page ${targetPage}.`,
        force,
      });
      const next: PageTranslation = {
        paragraphs,
        translations: outcome.texts,
        provider: outcome.provider,
        sourceLang: direction.sourceLang,
        targetLang: direction.targetLang,
      };
      cache.current.set(targetPage, next);
      if (requestRef.current === request) setData(next);
    } catch (err) {
      if (requestRef.current === request) setError(translationErrorMessage(err));
    } finally {
      if (requestRef.current === request) setLoading(false);
    }
  };

  useEffect(() => {
    void loadPage(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, doc]);

  const targetLabel = data?.targetLang === 'en' ? 'English' : '中文';
  const providerLabel = data?.provider === 'ai' ? 'AI 翻译' : '免费翻译';

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
      toast('译文还在生成中');
      return;
    }
    speak(text, { label: `第 ${page} 页译文`, lang: data?.targetLang === 'zh' ? 'zh-CN' : 'en-US' });
  };

  return (
    <div className="translate-panel">
      <header className="translate-head">
        <div className="translate-heading">
          <span className="translate-mark">
            <Languages size={17} />
          </span>
          <div>
            <strong>双语对照</strong>
            <span>{targetLabel}译文{data ? ` · ${providerLabel}` : ''}</span>
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
        <span className="translate-spacer" />
        <button className="translate-icon-btn" onClick={speakSource} title="朗读原文" aria-label="朗读原文">
          <Volume2 size={14} />
        </button>
        <button className="translate-icon-btn" onClick={speakTarget} title="朗读译文" aria-label="朗读译文">
          <Volume2 size={14} />
        </button>
        <button className="translate-icon-btn" onClick={() => void loadPage(page, true)} title="重新翻译" aria-label="重新翻译" disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {mode === 'book' && (
        <div className="translate-book-note">
          <span>整本对照 · 按页翻译</span>
          <span>按页切换即可</span>
        </div>
      )}

      <div className="translate-body">
        {loading && !data && (
          <div className="translate-loading">
            <Loader2 size={18} className="spin" />
            <span>正在翻译这一页…</span>
          </div>
        )}
        {error && (
          <div className="translate-error">
            <strong>这一页没有翻译成功</strong>
            <p>{error}</p>
            <button onClick={() => void loadPage(page, true)}>再试一次</button>
          </div>
        )}
        {!error && data && data.paragraphs.length === 0 && (
          <div className="translate-empty">
            <Languages size={20} />
            <p>这一页没有可提取的文字。</p>
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
              <div className="translation-target">
                {loading && !data.translations[index] ? (
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
            </article>
          ))}
      </div>

      <footer className="translate-foot">
        <span>
          {data?.provider === 'ai'
            ? '译文由你的 AI 接口生成，可能不准确，请对照原文。'
            : '免费翻译会把当前文字发送到翻译服务；整本建议接入 AI。'}
        </span>
      </footer>
    </div>
  );
}
