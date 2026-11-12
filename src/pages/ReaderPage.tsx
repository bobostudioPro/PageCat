import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Lamp,
  Languages,
  Moon,
  NotebookPen,
  PanelRightClose,
  PanelRightOpen,
  Settings2,
  Sparkles,
  Sun,
  ZoomIn,
  Volume2,
  ZoomOut,
} from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useLibrary } from '../state/library';
import { useAnnotations } from '../state/annotations';
import { useSettings } from '../state/settings';
import { useToast } from '../state/toast';
import { openBookPdf, getOutline, getPageText } from '../lib/pdf';
import type { Annotation, AnnotationColor, OutlineItem } from '../types';
import { clamp, isEditableTarget } from '../lib/utils';
import { selectionFromWindow, hitTest, type TextSelection } from '../lib/selection';
import { translateTexts, translationErrorMessage, type TranslationProvider } from '../lib/translate';
import { PageView } from '../components/Reader/PageView';
import type { ExternalReference } from '../components/AI/AIPanel';
import { SelectionToolbar } from '../components/Reader/SelectionToolbar';
import { AnnotationPopover } from '../components/Reader/AnnotationPopover';
import { ReaderSidebar, type ReaderTab } from '../components/Reader/ReaderSidebar';
import { SelectionTranslationCard } from '../components/Reader/SelectionTranslationCard';
import { TtsPlayer } from '../components/Reader/TtsPlayer';
import { PageTurnEffect, type PageTurnState } from '../components/Reader/PageTurnEffect';
import { SettingsDialog } from '../components/ui/SettingsDialog';
import { useTts } from '../state/tts';
import { Logo } from '../components/ui/Logo';

type PopoverAnchor = { x: number; y: number; top: number; bottom: number };
type SidebarState = { open: boolean; tab: ReaderTab };
function capturePageSnapshot(canvas: HTMLCanvasElement | null | undefined, theme: 'paper' | 'sepia' | 'night') {
  if (!canvas) return undefined;
  try {
    if (theme === 'paper') return canvas.toDataURL('image/jpeg', 0.84);
    const off = document.createElement('canvas');
    off.width = canvas.width;
    off.height = canvas.height;
    const ctx = off.getContext('2d');
    if (!ctx) return canvas.toDataURL('image/jpeg', 0.84);
    ctx.filter = theme === 'sepia' ? 'sepia(0.42) saturate(0.8) brightness(0.95) contrast(1.03)' : 'invert(1) hue-rotate(180deg) brightness(0.9) contrast(1.04)';
    ctx.drawImage(canvas, 0, 0);
    return off.toDataURL('image/jpeg', 0.84);
  } catch {
    return undefined;
  }
}

type SelectionTranslation = {
  source: string;
  target: string;
  loading: boolean;
  error: string | null;
  provider?: TranslationProvider;
  targetLang: 'zh' | 'en';
  anchor: TextSelection['anchor'];
};

export function ReaderPage() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const { books, status, initialize, updateBook } = useLibrary();
  const annStore = useAnnotations();
  const settings = useSettings();
  const push = useToast((s) => s.push);

  const book = books.find((b) => b.id === bookId);
  const annotations = (bookId ? annStore.byBook[bookId] : []) ?? [];
  const notes = (bookId ? annStore.notesByBook[bookId] : []) ?? [];

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [base, setBase] = useState({ w: 612, h: 792 });
  const [baseReady, setBaseReady] = useState(false);
  const [scale, setScale] = useState(1);
  const [zoom, setZoom] = useState(() => (typeof window !== 'undefined' && window.innerWidth >= 1200 ? 1.2 : 1));
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [currentPage, setCurrentPage] = useState(book?.lastPage ?? 1);
  const [pageDraft, setPageDraft] = useState(String(book?.lastPage ?? 1));
  const [toc, setToc] = useState<OutlineItem[]>(book?.toc ?? []);
  const [sidebar, setSidebar] = useState<SidebarState>({ open: typeof window !== 'undefined' && window.innerWidth > 1024, tab: 'toc' });
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<PopoverAnchor | null>(null);
  const [aiExternal, setAiExternal] = useState<ExternalReference | null>(null);
  const aiNonce = useRef(0);
  const [flashId, setFlashId] = useState<string>();
  const [focusNote, setFocusNote] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectionTranslation, setSelectionTranslation] = useState<SelectionTranslation | null>(null);
  const [pageTurn, setPageTurn] = useState<PageTurnState | null>(null);
  const speaking = useTts((s) => s.speaking);

  const scrollRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const annotationsRef = useRef(annotations);
  const tabInitialized = useRef(false);
  const lastScale = useRef(1);
  const flashTimer = useRef<number | undefined>(undefined);
  const pageTurnTimer = useRef<number | undefined>(undefined);
  const renderedPages = useRef(new Set<number>());
  const pageTurnTarget = useRef<number | undefined>(undefined);
  const turning = useRef(false);

  const theme = settings.readerTheme;
  const activeAnnotation = activeAnnotationId ? annotations.find((a) => a.id === activeAnnotationId) ?? null : null;
  const activeNote = activeAnnotation?.noteId ? notes.find((n) => n.id === activeAnnotation.noteId) : undefined;
  const percent = book ? clamp(currentPage / book.pageCount, 0, 1) : 0;

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (status === 'ready' && !book) {
      navigate('/', { replace: true });
    }
  }, [status, book, navigate]);

  useEffect(() => {
    if (!book || status !== 'ready') return;
    void annStore.load(book.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id, status]);

  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  useEffect(() => {
    if (!book) return;
    document.title = `${book.titleZh || book.title} · PageCat`;
    return () => {
      document.title = 'PageCat · 一间安静的数字书房';
    };
  }, [book]);

  useEffect(() => {
    if (!book) return;
    let cancelled = false;
    setDoc(null);
    setDocError(null);
    openBookPdf(book)
      .then((pdf) => {
        if (!cancelled) setDoc(pdf);
      })
      .catch((err) => {
        if (!cancelled) setDocError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id]);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    doc
      .getPage(1)
      .then((page) => {
        const viewport = page.getViewport({ scale: 1 });
        if (!cancelled) {
          setBase({ w: viewport.width, h: viewport.height });
          setBaseReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setBaseReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  useEffect(() => {
    if (!doc || !book) return;
    let cancelled = false;
    if (book.toc?.length) {
      setToc(book.toc);
      return;
    }
    getOutline(doc)
      .then((items) => {
        if (!cancelled) setToc(items);
      })
      .catch(() => {
        if (!cancelled) setToc([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, book?.id]);

  useEffect(() => {
    if (!book || tabInitialized.current) return;
    tabInitialized.current = true;
    const initialTab: ReaderTab = book.seedAnnotations?.length ? 'highlights' : 'toc';
    setSidebar((s) => ({ ...s, tab: initialTab }));
    setCurrentPage(book.lastPage ?? 1);
    setPageDraft(String(book.lastPage ?? 1));
  }, [book]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setViewportWidth(el.clientWidth);
      setViewportHeight(el.clientHeight);
    });
    observer.observe(el);
    setViewportWidth(el.clientWidth);
    setViewportHeight(el.clientHeight);
    return () => observer.disconnect();
  }, [doc, sidebar.open]);

  const gutter = viewportWidth > 1000 ? 58 : viewportWidth > 640 ? 30 : 14;
  const widthFit = viewportWidth ? Math.max(0.2, (viewportWidth - gutter * 2) / base.w) : 1;
  const heightFit = viewportHeight ? Math.max(0.2, (viewportHeight - 118) / base.h) : widthFit;
  const fitScale = Math.min(widthFit, heightFit);
  const effectiveScale = clamp(fitScale * zoom, 0.2, 3.2);

  useEffect(() => {
    setScale(effectiveScale);
  }, [effectiveScale]);

  const scrollToPage = useCallback((page: number, behavior: ScrollBehavior = 'smooth') => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const block = scroll.querySelector<HTMLElement>(`.page-block[data-page="${page}"]`);
    if (!block) return;
    const top = block.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop - 20;
    scroll.scrollTo({ top: Math.max(0, top), behavior });
    setCurrentPage(page);
    setPageDraft(String(page));
  }, []);

  const showPageTurn = async (direction: 'next' | 'prev', targetPage?: number) => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const scrollRect = scroll.getBoundingClientRect();
    const blocks = [...scroll.querySelectorAll<HTMLElement>('.page-block')];
    const nearest = blocks
      .filter((block) => {
        const r = block.getBoundingClientRect();
        return r.bottom > scrollRect.top + 70 && r.top < scrollRect.bottom - 40;
      })
      .sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return Math.abs(ra.top - scrollRect.top) - Math.abs(rb.top - scrollRect.top);
      })[0];
    const pageEl = nearest?.querySelector<HTMLElement>('.pdf-page');
    if (!pageEl) return;
    const rect = pageEl.getBoundingClientRect();
    const top = Math.max(62, scrollRect.top + 20);
    const height = Math.min(rect.height, window.innerHeight - top - 8);
    if (height < 120 || rect.width < 80) return;
    turning.current = true;

    const currentBlock = pageEl.closest('.page-block') as HTMLElement | null;
    const currentPage = Number(currentBlock?.dataset.page);
    let image = capturePageSnapshot(pageEl.querySelector<HTMLCanvasElement>('canvas'), theme);
    let nextImage: string | undefined;

    if (targetPage && targetPage !== currentPage) {
      const existing = scroll.querySelector<HTMLCanvasElement>(`.page-block[data-page="${targetPage}"] .pdf-page canvas`);
      nextImage = capturePageSnapshot(existing, theme);
      if (!nextImage && doc) {
        try {
          const target = await doc.getPage(targetPage);
          const viewport = target.getViewport({ scale });
          const off = document.createElement('canvas');
          off.width = Math.max(1, Math.floor(viewport.width));
          off.height = Math.max(1, Math.floor(viewport.height));
          const ctx = off.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, off.width, off.height);
            await target.render({ canvas: off, viewport, background: '#ffffff' }).promise;
            nextImage = capturePageSnapshot(off, theme);
          }
          target.cleanup();
        } catch {
          nextImage = undefined;
        }
      }
    }

    if (pageTurnTimer.current) window.clearTimeout(pageTurnTimer.current);
    pageTurnTarget.current = targetPage;
    const started = performance.now();
    setPageTurn({
      id: Date.now(),
      direction,
      image,
      nextImage,
      rect: { left: rect.left, top, width: rect.width, height },
    });
    const finish = () => {
      const target = pageTurnTarget.current;
      const ready = !target || renderedPages.current.has(target);
      if (ready || performance.now() - started > 2600) {
        if (target) scrollToPage(target, 'auto');
        window.setTimeout(() => {
          if (target) scrollToPage(target, 'auto');
          window.setTimeout(() => {
            setPageTurn(null);
            turning.current = false;
          }, 160);
        }, 140);
        return;
      }
      pageTurnTimer.current = window.setTimeout(finish, 70);
    };
    pageTurnTimer.current = window.setTimeout(finish, 1120);
  };

  const turnToPage = (direction: 'next' | 'prev', page: number) => {
    void showPageTurn(direction, page).finally(() => scrollToPage(page, 'auto'));
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (turning.current) return;
        const top = el.getBoundingClientRect().top;
        const blocks = el.querySelectorAll<HTMLElement>('.page-block');
        let page = 1;
        for (const block of blocks) {
          const rect = block.getBoundingClientRect();
          if (rect.top - top <= 180) page = Number(block.dataset.page);
          else break;
        }
        setCurrentPage(page);
        setPageDraft(String(page));
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [doc, baseReady]);

  useEffect(() => {
    if (!book || !doc) return;
    const timer = window.setTimeout(() => {
      void updateBook(book.id, {
        lastPage: currentPage,
        percent: clamp(currentPage / book.pageCount, 0, 1),
        lastOpenedAt: Date.now(),
      });
    }, 650);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, book?.id, doc]);

  const clearBrowserSelection = () => window.getSelection()?.removeAllRanges();

  const captureSelection = useCallback(() => {
    const captured = selectionFromWindow();
    if (!captured) return false;
    setSelection(captured);
    setActiveAnnotationId(null);
    setPopoverAnchor(null);
    return true;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onPointerDown = (e: PointerEvent) => {
      pointerStart.current = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      const start = pointerStart.current;
      pointerStart.current = null;
      const moved = start ? Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6 : false;
      window.setTimeout(() => {
        const target = e.target as HTMLElement;
        if (target.closest('.selection-toolbar, .annotation-popover')) return;
        if (captureSelection()) return;
        if (moved) return;
        const pageEl = target.closest<HTMLElement>('.pdf-page');
        if (!pageEl) {
          setActiveAnnotationId(null);
          setPopoverAnchor(null);
          return;
        }
        const rect = pageEl.getBoundingClientRect();
        const point = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
        const found = hitTest(annotationsRef.current, Number(pageEl.dataset.page), point);
        if (found) {
          setActiveAnnotationId(found.id);
          setPopoverAnchor({ x: e.clientX, y: e.clientY, top: rect.top, bottom: rect.bottom });
          setSelection(null);
        } else {
          setActiveAnnotationId(null);
          setPopoverAnchor(null);
        }
      }, 10);
    };
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointerup', onPointerUp);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointerup', onPointerUp);
    };
  }, [captureSelection, doc, baseReady]);

  useEffect(() => {
    let timer: number | undefined;
    const onSelectionChange = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;
        const active = document.activeElement as HTMLElement | null;
        if (active?.closest('.selection-toolbar, .annotation-popover, .ai-panel')) return;
        captureSelection();
      }, 230);
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      if (timer) window.clearTimeout(timer);
    };
  }, [captureSelection]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.selection-toolbar, .annotation-popover, .pdf-page')) return;
      setSelection(null);
      setActiveAnnotationId(null);
      setPopoverAnchor(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const closeSelection = () => {
    setSelection(null);
    clearBrowserSelection();
  };

  const createAnnotation = async (color: AnnotationColor, style: 'highlight' | 'underline', favorite = false, openNote = false) => {
    if (!book || !selection) return;
    const captured = selection;
    const annotation = await annStore.add({
      bookId: book.id,
      page: captured.page,
      color,
      style,
      text: captured.text,
      rects: captured.rects,
      favorite,
    });
    setSelection(null);
    clearBrowserSelection();
    if (openNote) {
      setActiveAnnotationId(annotation.id);
      setPopoverAnchor({
        x: captured.anchor.x,
        y: captured.anchor.bottom,
        top: captured.anchor.top,
        bottom: captured.anchor.bottom,
      });
    } else {
      push(favorite ? '已收藏这条划线' : '已划线', 'success');
    }
  };

  const askAboutSelection = (
    text: string,
    kind: ExternalReference['kind'] = 'selection',
    page = currentPage,
    refId?: string,
    quote?: string,
  ) => {
    if (!text.trim()) return;
    aiNonce.current += 1;
    setAiExternal({ kind, page, text: text.trim(), refId, quote, nonce: aiNonce.current });
    setSelection(null);
    setActiveAnnotationId(null);
    setPopoverAnchor(null);
    clearBrowserSelection();
    setSidebar({ open: true, tab: 'ai' });
  };

  const jumpTo = (page: number, annotationId?: string) => {
    if (page !== currentPage) turnToPage(page > currentPage ? 'next' : 'prev', page);
    else scrollToPage(page);
    if (annotationId) {
      setFlashId(annotationId);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      if (pageTurnTimer.current) window.clearTimeout(pageTurnTimer.current);
      flashTimer.current = window.setTimeout(() => setFlashId(undefined), 1800);
    }
    if (window.innerWidth <= 1024) setSidebar((s) => ({ ...s, open: false }));
  };

  const jumpToPanel = (page: number) => {
    if (page !== currentPage) turnToPage(page > currentPage ? 'next' : 'prev', page);
    else scrollToPage(page);
  };

  const toggleTheme = () => {
    const order = ['paper', 'sepia', 'night'] as const;
    const next = order[(order.indexOf(theme) + 1) % order.length];
    settings.update({ readerTheme: next });
  };

  const themeIcon = theme === 'paper' ? <Sun size={16} /> : theme === 'sepia' ? <Lamp size={16} /> : <Moon size={16} />;

  const openTab = (tab: ReaderTab) => {
    setSidebar({ open: true, tab });
  };

  const goPage = (delta: number) => {
    if (!book) return;
    const next = clamp(currentPage + delta, 1, book.pageCount);
    if (next !== currentPage) turnToPage(delta > 0 ? 'next' : 'prev', next);
    else scrollToPage(next);
  };

  const commitPageDraft = () => {
    if (!book) return;
    const value = Number(pageDraft);
    if (Number.isFinite(value) && value >= 1) {
      const target = clamp(Math.round(value), 1, book.pageCount);
      if (target !== currentPage) turnToPage(target > currentPage ? 'next' : 'prev', target);
      else scrollToPage(target);
    } else {
      setPageDraft(String(currentPage));
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!book) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        goPage(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goPage(-1);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom((z) => clamp(Math.round((z + 0.1) * 10) / 10, 0.5, 2.2));
      } else if (e.key === '-') {
        e.preventDefault();
        setZoom((z) => clamp(Math.round((z - 0.1) * 10) / 10, 0.5, 2.2));
      } else if (e.key === '0') {
        setZoom(1);
      } else if (e.key.toLowerCase() === 'n') {
        openTab('notes');
        setFocusNote((v) => v + 1);
      } else if (e.key.toLowerCase() === 'a') {
        openTab('ai');
      } else if (e.key === 'Escape') {
        setSelection(null);
        setActiveAnnotationId(null);
        setPopoverAnchor(null);
        if (window.innerWidth <= 1024) setSidebar((s) => ({ ...s, open: false }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id, currentPage, book?.pageCount, theme]);

  useEffect(() => {
    return () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      useTts.getState().stop();
    };
  }, []);

  useEffect(() => {
    useTts.getState().stop();
  }, [bookId]);

  const translateSelection = async () => {
    if (!selection) return;
    const captured = selection;
    setSelectionTranslation({
      source: captured.text,
      target: '',
      loading: true,
      error: null,
      targetLang: /[\u3400-\u9fff]/.test(captured.text) ? 'en' : 'zh',
      anchor: captured.anchor,
    });
    try {
      const outcome = await translateTexts([captured.text], {
        context: book ? `《${book.titleZh || book.title}》第 ${captured.page} 页` : undefined,
      });
      setSelectionTranslation({
        source: captured.text,
        target: outcome.texts[0] ?? '',
        loading: false,
        error: null,
        provider: outcome.provider,
        targetLang: outcome.targetLang,
        anchor: captured.anchor,
      });
    } catch (err) {
      setSelectionTranslation({
        source: captured.text,
        target: '',
        loading: false,
        error: translationErrorMessage(err),
        targetLang: /[\u3400-\u9fff]/.test(captured.text) ? 'en' : 'zh',
        anchor: captured.anchor,
      });
    }
  };

  const readCurrentPage = async () => {
    if (!doc) return;
    try {
      const text = await getPageText(doc, currentPage);
      if (!text.trim()) {
        push('这一页没有可朗读的文字', 'error');
        return;
      }
      useTts.getState().speak(text, {
        label: `第 ${currentPage} 页`,
        lang: /[\u3400-\u9fff]/.test(text) ? 'zh-CN' : 'en-US',
      });
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  if (status !== 'ready' || !book) {
    return (
      <div className="reader reader-loading">
        <Logo light />
        <p>{status === 'error' ? '书架没有加载成功' : '正在铺开书页…'}</p>
      </div>
    );
  }

  if (docError) {
    return (
      <div className="reader reader-loading">
        <Logo light />
        <p>{docError}</p>
        <button className="btn btn-brass" onClick={() => navigate('/')}>
          回到书架
        </button>
      </div>
    );
  }

  const totalPages = book.pageCount;

  return (
    <div className={`reader theme-${theme} ${sidebar.open ? 'sidebar-open' : ''} ${sidebar.tab === 'ai' ? 'ai-case' : ''}`}>
      <header className="reader-topbar">
        <div className="rt-left">
          <button className="rt-icon" onClick={() => navigate('/')} title="回到书架" aria-label="回到书架">
            <ArrowLeft size={17} />
          </button>
          <div className="rt-book">
            <span className="rt-kicker">{book.genre || '阅读'} · {book.percent ? '继续阅读' : '第一次翻开'}</span>
            <strong>{book.titleZh || book.title}</strong>
          </div>
        </div>

        <div className="rt-center">
          <button className="rt-icon small" onClick={() => goPage(-1)} disabled={currentPage <= 1} aria-label="上一页">
            <ChevronLeft size={16} />
          </button>
          <div className="rt-page">
            <input
              value={pageDraft}
              onChange={(e) => setPageDraft(e.target.value.replace(/[^\d]/g, ''))}
              onBlur={commitPageDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              aria-label="页码"
            />
            <span>/ {totalPages}</span>
          </div>
          <button className="rt-icon small" onClick={() => goPage(1)} disabled={currentPage >= totalPages} aria-label="下一页">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="rt-right">
          <div className="zoom-control" title="缩放仅影响 PDF；100% 为整页适应">
            <button onClick={() => setZoom((z) => clamp(Math.round((z - 0.1) * 10) / 10, 0.5, 2.2))} aria-label="缩小">
              <ZoomOut size={15} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => clamp(Math.round((z + 0.1) * 10) / 10, 0.5, 2.2))} aria-label="放大">
              <ZoomIn size={15} />
            </button>
          </div>
          <button className="rt-icon" onClick={toggleTheme} title="切换灯光" aria-label="切换阅读灯光">
            {themeIcon}
          </button>
          <button className={`rt-icon ${speaking ? 'active' : ''}`} onClick={() => void readCurrentPage()} title="朗读本页" aria-label="朗读本页">
            <Volume2 size={16} />
          </button>
          <button
            className={`rt-icon ${sidebar.open && sidebar.tab === 'translate' ? 'active' : ''}`}
            onClick={() => openTab('translate')}
            title="双语翻译"
            aria-label="双语翻译"
          >
            <Languages size={16} />
          </button>
          <button className="rt-icon" onClick={() => { openTab('notes'); setFocusNote((v) => v + 1); }} title="记笔记" aria-label="记笔记">
            <NotebookPen size={16} />
          </button>
          <button className={`rt-icon ai-btn ${sidebar.open && sidebar.tab === 'ai' ? 'active' : ''}`} onClick={() => openTab('ai')} title="AI 助手" aria-label="AI 助手">
            <Sparkles size={16} />
          </button>
          <button className="rt-icon" onClick={() => setSettingsOpen(true)} title="设置" aria-label="设置">
            <Settings2 size={16} />
          </button>
          <button className="rt-icon" onClick={() => setSidebar((s) => ({ ...s, open: !s.open }))} title="侧栏" aria-label="侧栏">
            {sidebar.open ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
          </button>
        </div>
        <div className="rt-progress">
          <span style={{ width: `${percent * 100}%` }} />
        </div>
      </header>

      <div className="reader-body">
        <main className="reader-scroll" ref={scrollRef}>
          <div className="pages">
            {baseReady &&
              Array.from({ length: totalPages }, (_, index) => (
                <PageView
                  key={index + 1}
                  doc={doc!}
                  pageNumber={index + 1}
                  scale={scale}
                  baseWidth={base.w}
                  baseHeight={base.h}
                  annotations={annotations}
                  activeId={activeAnnotationId ?? undefined}
                  flashId={flashId}
                  scrollRoot={scrollRef}
                  onRendered={(page) => renderedPages.current.add(page)}
                  onRectsResolved={(id, rects) => void annStore.setRects(id, rects)}
                />
              ))}
            {!baseReady && (
              <div className="reader-page-skeleton">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
          <div className="reader-end">
            <span className="end-mark">❦</span>
            <p>读到这里了。合上书，或者再往前翻一页。</p>
            <button className="btn btn-ghost" onClick={() => navigate('/')}>
              回到书架
            </button>
          </div>
        </main>

        {sidebar.open && (
          <ReaderSidebar
            book={book}
            doc={doc!}
            tab={sidebar.tab}
            onTab={(tab) => setSidebar((s) => ({ ...s, tab }))}
            onClose={() => setSidebar((s) => ({ ...s, open: false }))}
            annotations={annotations}
            notes={notes}
            toc={toc}
            currentPage={currentPage}
            pageCount={totalPages}
            percent={percent}
            focusNote={focusNote}
            aiExternal={aiExternal}
            onConsumeAiExternal={() => setAiExternal(null)}
            onAskHighlight={(annotation) => askAboutSelection(annotation.quote, 'highlight', annotation.page, annotation.id)}
            onAskNote={(note) => askAboutSelection(note.text, 'note', note.page, note.id, note.quote)}
            onJump={jumpTo}
            onJumpPanel={jumpToPanel}
            onFavorite={(annotation: Annotation, value: boolean) => void annStore.update(annotation.id, { favorite: value })}
            onRemoveAnnotation={(annotation) => void annStore.remove(annotation.id)}
            onAddNote={async (text) => {
              await annStore.addNote(book.id, currentPage, text);
              push('笔记已保存', 'success');
            }}
            onUpdateNote={async (note, text) => {
              await annStore.updateNote(note.id, text);
              push('笔记已更新', 'success');
            }}
            onRemoveNote={(note) => void annStore.removeNote(note.id)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}
        {sidebar.open && <button className="sidebar-backdrop" aria-label="收起侧栏" onClick={() => setSidebar((s) => ({ ...s, open: false }))} />}
      </div>

      {selection && (
        <SelectionToolbar
          selection={selection}
          onHighlight={(color) => void createAnnotation(color, 'highlight')}
          onUnderline={() => void createAnnotation('sky', 'underline')}
          onFavorite={() => void createAnnotation('amber', 'highlight', true)}
          onNote={() => void createAnnotation('amber', 'highlight', false, true)}
          onAsk={() => askAboutSelection(selection.text, 'selection', selection.page)}
          onTranslate={() => void translateSelection()}
          onCopy={() => {
            void navigator.clipboard.writeText(selection.text);
            push('已复制原文', 'success');
            closeSelection();
          }}
          onClose={closeSelection}
        />
      )}

      {selectionTranslation && (
        <SelectionTranslationCard
          anchor={selectionTranslation.anchor}
          source={selectionTranslation.source}
          target={selectionTranslation.target}
          loading={selectionTranslation.loading}
          error={selectionTranslation.error}
          provider={selectionTranslation.provider}
          targetLang={selectionTranslation.targetLang}
          onClose={() => setSelectionTranslation(null)}
        />
      )}

      {activeAnnotation && popoverAnchor && (
        <AnnotationPopover
          annotation={activeAnnotation}
          note={activeNote}
          anchor={popoverAnchor}
          onClose={() => {
            setActiveAnnotationId(null);
            setPopoverAnchor(null);
          }}
          onColor={(color) => void annStore.update(activeAnnotation.id, { color })}
          onFavorite={(value) => void annStore.update(activeAnnotation.id, { favorite: value })}
          onSaveNote={async (text) => {
            if (!text) {
              if (activeNote) await annStore.removeNote(activeNote.id);
              return;
            }
            if (activeNote) await annStore.updateNote(activeNote.id, text);
            else await annStore.addNote(book.id, activeAnnotation.page, text, { quote: activeAnnotation.quote, annotationId: activeAnnotation.id });
            push('笔记已保存', 'success');
          }}
          onDelete={() => {
            void annStore.remove(activeAnnotation.id);
            setActiveAnnotationId(null);
            setPopoverAnchor(null);
            push('划线已删除');
          }}
          onAsk={() => askAboutSelection(activeAnnotation.quote, 'highlight', activeAnnotation.page, activeAnnotation.id)}
          onJump={() => {
            jumpTo(activeAnnotation.page, activeAnnotation.id);
            setActiveAnnotationId(null);
            setPopoverAnchor(null);
          }}
        />
      )}

      <div className="mobile-page-pill">
        <span>{currentPage} / {totalPages}</span>
        <i><span style={{ width: `${percent * 100}%` }} /></i>
      </div>

      <PageTurnEffect turn={pageTurn} theme={theme} />
      <TtsPlayer />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
