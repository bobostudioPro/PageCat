import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, CloudUpload, Search, Settings2, X } from 'lucide-react';
import { useLibrary } from '../state/library';
import { Logo } from '../components/ui/Logo';
import { Shelf } from '../components/Shelf/Shelf';
import { BookOpenOverlay } from '../components/Shelf/BookOpenOverlay';
import { BookMenu } from '../components/Shelf/BookMenu';
import { BookDetails } from '../components/Shelf/BookDetails';
import { UploadDialog } from '../components/ui/UploadDialog';
import { SettingsDialog } from '../components/ui/SettingsDialog';
import { Modal } from '../components/ui/Modal';
import type { Book } from '../types';
import { rerange } from '../lib/utils';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 14) return '午安';
  if (h < 18) return '下午好';
  return '晚上好';
}

function today() {
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
}

export function LibraryPage() {
  const navigate = useNavigate();
  const { books, status, error, initialize, removeBook, reorderBooks } = useLibrary();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [opening, setOpening] = useState<Book | null>(null);
  const [pullingId, setPullingId] = useState<string>();
  const [menu, setMenu] = useState<{ book: Book; x: number; y: number } | null>(null);
  const [details, setDetails] = useState<Book | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Book | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [incoming, setIncoming] = useState<File[]>([]);
  const dragDepth = useRef(0);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (!dragActive) return;
    document.body.classList.add('pagecat-dragging');
    return () => document.body.classList.remove('pagecat-dragging');
  }, [dragActive]);

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      dragDepth.current++;
      setDragActive(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    const onDragLeave = (e: DragEvent) => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragActive(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragActive(false);
      const files = [...(e.dataTransfer?.files ?? [])].filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
      );
      if (files.length) {
        setIncoming(files);
        setUploadOpen(true);
      }
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const recent = useMemo(() => {
    return [...books]
      .filter((b) => b.percent || b.lastOpenedAt)
      .sort((a, b) => (b.lastOpenedAt ?? b.createdAt) - (a.lastOpenedAt ?? a.createdAt))[0];
  }, [books]);

  const totalPages = useMemo(() => books.reduce((sum, b) => sum + b.pageCount, 0), [books]);
  const avgProgress = useMemo(
    () => (books.length ? books.reduce((sum, b) => sum + (b.percent ?? 0), 0) / books.length : 0),
    [books],
  );

  const requestOpen = (book: Book) => {
    if (opening) return;
    setMenu(null);
    setDetails(null);
    setPullingId(book.id);
    window.setTimeout(() => setOpening(book), 200);
  };

  const finishOpen = () => {
    if (!opening) {
      setPullingId(undefined);
      return;
    }
    const id = opening.id;
    setOpening(null);
    setPullingId(undefined);
    navigate(`/read/${id}`);
  };

  const handleRemove = async (book: Book) => {
    setConfirmRemove(null);
    await removeBook(book.id);
    if (opening?.id === book.id) setOpening(null);
  };

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="library loading-room">
        <div className="loading-inner">
          <Logo light />
          <div className="loading-shelf">
            <span className="loading-book" />
            <span className="loading-book b2" />
            <span className="loading-book b3" />
            <span className="loading-cat">PAGECAT</span>
          </div>
          <p>正在把书搬上书架…</p>
          <div className="loading-dots"><i /><i /><i /></div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="library loading-room">
        <div className="loading-inner">
          <Logo light />
          <p>书架没有整理成功：{error}</p>
          <button className="btn btn-brass" onClick={() => window.location.reload()}>
            再试一次
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="library">
      <div className="wall-glow" aria-hidden="true" />
      <div className="library-shell">
        <header className="site-header">
          <Logo light />
          <div className="header-spacer" />
          <label className={`search-box ${searchOpen ? 'open' : ''}`}>
            <Search size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="在书架上找一本书"
              aria-label="搜索书架"
            />
            {query && (
              <button
                className="search-clear"
                onClick={(e) => {
                  e.preventDefault();
                  setQuery('');
                }}
                aria-label="清除搜索"
              >
                <X size={13} />
              </button>
            )}
          </label>
          <button className="icon-btn on-dark mobile-search-btn" onClick={() => setSearchOpen((v) => !v)} aria-label="搜索">
            <Search size={17} />
          </button>
          <button className="btn btn-brass header-add" onClick={() => setUploadOpen(true)}>
            <CloudUpload size={15} />
            上架书籍
          </button>
          <button className="icon-btn on-dark header-settings" onClick={() => setSettingsOpen(true)} aria-label="书房设置">
            <Settings2 size={18} />
          </button>
        </header>

        <section className="hero">
          <div className="hero-copy">
            <p className="hero-kicker">{today()}</p>
            <h1>
              {greeting()}，<em>读书人</em>。
            </h1>
            <div className="hero-stats">
              <div>
                <strong>{books.length}</strong>
                <span>本藏书</span>
              </div>
              <div>
                <strong>{totalPages.toLocaleString('zh-CN')}</strong>
                <span>页书页</span>
              </div>
              <div>
                <strong>{Math.round(avgProgress * 100)}%</strong>
                <span>平均读完</span>
              </div>
            </div>
          </div>

          {recent && (
            <aside className="continue-card">
              <span className="continue-pin" aria-hidden="true" />
              <div className="continue-kicker">
                <span className="pulse-dot" /> 上次读到
              </div>
              <div className="continue-main">
                <div
                  className="continue-cover"
                  style={{
                    backgroundImage: recent.cover ? `url("${recent.cover}")` : undefined,
                    backgroundColor: recent.cover ? undefined : recent.accent,
                  }}
                >
                  {!recent.cover && <span>{(recent.titleZh || recent.title).slice(0, 2)}</span>}
                </div>
                <div className="continue-info">
                  <strong>{recent.titleZh || recent.title}</strong>
                  <em>{recent.authorZh || recent.author}</em>
                  <div className="continue-progress">
                    <span style={{ width: `${Math.max(5, (recent.percent ?? 0) * 100)}%` }} />
                  </div>
                  <span className="continue-meta">
                    第 {recent.lastPage ?? 1} / {recent.pageCount} 页 · {rerange(recent.percent ?? 0)}
                  </span>
                </div>
                <button className="continue-action" onClick={() => requestOpen(recent)}>
                  <BookOpen size={14} />
                  {recent.percent ? '接着读' : '翻开'}
                  <ArrowRight size={14} className="arrow" />
                </button>
              </div>
            </aside>
          )}
        </section>

        <Shelf
          books={books}
          query={query}
          pullingId={pullingId}
          onOpen={requestOpen}
          onContext={(book, x, y) => setMenu({ book, x, y })}
          onUpload={() => setUploadOpen(true)}
          onClearSearch={() => setQuery('')}
          onReorder={(rows) => void reorderBooks(rows)}
          dragActive={dragActive}
        />

        <footer className="site-footer">
          <span>© @bobostudio 2026</span>
        </footer>
      </div>

      {dragActive && (
        <div className="global-drop">
          <div className="global-drop-card">
            <CloudUpload size={26} />
            <strong>松手，把书放上书架</strong>
            <span>支持 PDF，只保存在你的浏览器里</span>
          </div>
        </div>
      )}

      {opening && <BookOpenOverlay book={opening} onDone={finishOpen} />}

      {menu && (
        <BookMenu
          book={menu.book}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onOpen={(book) => {
            setMenu(null);
            requestOpen(book);
          }}
          onDetails={(book) => {
            setMenu(null);
            setDetails(book);
          }}
          onRemove={(book) => {
            setMenu(null);
            setConfirmRemove(book);
          }}
        />
      )}

      <BookDetails
        book={details}
        onClose={() => setDetails(null)}
        onOpen={(book) => {
          setDetails(null);
          requestOpen(book);
        }}
        onRemove={(book) => {
          setDetails(null);
          setConfirmRemove(book);
        }}
      />

      <Modal
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title="从书架上取下？"
        subtitle={confirmRemove ? `《${confirmRemove.titleZh || confirmRemove.title}》的 PDF、划线、笔记和对话都会从本机删除。` : undefined}
      >
        <div className="confirm-actions">
          <button className="btn btn-quiet" onClick={() => setConfirmRemove(null)}>
            再想想
          </button>
          <button className="btn btn-danger" onClick={() => confirmRemove && void handleRemove(confirmRemove)}>
            取下这本书
          </button>
        </div>
      </Modal>

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} initialFiles={incoming} onConsumed={() => setIncoming([])} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
