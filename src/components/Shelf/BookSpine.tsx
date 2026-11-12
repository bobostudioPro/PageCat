import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Book } from '../../types';
import { cn, rerange } from '../../lib/utils';

type Props = {
  book: Book;
  index: number;
  pulling?: boolean;
  onOpen: (book: Book) => void;
  onContext: (book: Book, x: number, y: number) => void;
  searchMatch?: boolean;
};

type Tip = { left: number; top: number; below: boolean };

const SAMPLE_SPINE_TITLES: Record<string, string> = {
  'sample-gatsby': 'The Great Gatsby',
  'sample-pride': 'Pride & Prejudice',
  'sample-alice': 'Alice in Wonderland',
  'sample-artofwar': 'The Art of War',
  'sample-meditations': 'Meditations',
  'sample-manual': 'PageCat 读本',
};

function labelWeight(text: string) {
  return [...text].reduce((n, ch) => n + (/[\u2e80-\u2fff\u3400-\u9fff]/.test(ch) ? 2 : 1), 0);
}

function shortenSpineTitle(raw: string) {
  const cleaned = raw.replace(/\s+/g, ' ').replace(/\s*[:：]\s*.*$/, '').trim();
  const chars = [...cleaned];
  const maxWeight = 17;
  let out = '';
  let weight = 0;
  for (const ch of chars) {
    const next = weight + (/[\u2e80-\u2fff\u3400-\u9fff]/.test(ch) ? 2 : 1);
    if (next > maxWeight) return `${out.trimEnd()}…`;
    out += ch;
    weight = next;
  }
  return cleaned;
}

export function BookSpine({ book, index, pulling, onOpen, onContext }: Props) {
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const [tip, setTip] = useState<Tip | null>(null);
  const height = 218 + ((index * 17 + book.pageCount) % 4) * 14;
  const width = 46 + ((book.title.length + index) % 4) * 5;
  const accent = book.spineColor || book.accent || '#7b3f52';
  const title = book.titleZh || book.title;
  const author = book.authorZh || book.author;
  const progress = book.percent ?? 0;
  const spineLabel = SAMPLE_SPINE_TITLES[book.id] || shortenSpineTitle(title);
  const spineWeight = labelWeight(spineLabel);
  const spineTitleClass = spineWeight > 15 ? 'xsmall' : spineWeight > 12 ? 'small' : '';

  const clearTimer = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const showTip = (el: HTMLElement) => {
    if (!window.matchMedia('(hover: hover)').matches) return;
    const rect = el.getBoundingClientRect();
    const tipWidth = 218;
    const left = Math.min(
      window.innerWidth - tipWidth / 2 - 12,
      Math.max(tipWidth / 2 + 12, rect.left + rect.width / 2),
    );
    const below = rect.top < 150;
    setTip({ left, top: below ? rect.bottom + 10 : rect.top - 12, below });
  };

  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [tip]);

  return (
    <div className="spine-wrap" style={{ '--h': `${height}px`, '--w': `${width}px` } as React.CSSProperties}>
      <button
        className={cn('book-spine', pulling && 'pulling')}
        style={{ '--accent': accent } as React.CSSProperties}
        aria-label={`打开《${title}》`}
        onClick={() => {
          setTip(null);
          if (longPressed.current) {
            longPressed.current = false;
            return;
          }
          onOpen(book);
        }}
        onMouseEnter={(e) => showTip(e.currentTarget)}
        onMouseLeave={() => setTip(null)}
        onFocus={(e) => showTip(e.currentTarget)}
        onBlur={() => setTip(null)}
        onContextMenu={(e) => {
          e.preventDefault();
          setTip(null);
          onContext(book, e.clientX, e.clientY);
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          longPressed.current = false;
          clearTimer();
          timer.current = window.setTimeout(() => {
            longPressed.current = true;
            setTip(null);
            onContext(book, e.clientX, e.clientY);
          }, 620);
        }}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onKeyDown={(e) => {
          if (e.shiftKey && e.key === 'F10') {
            e.preventDefault();
            setTip(null);
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onContext(book, rect.left + rect.width / 2, rect.top + 40);
          }
        }}
      >
        <span className="spine-edge" aria-hidden="true" />
        <span className="spine-cap top" aria-hidden="true" />
        <span className="spine-cap bottom" aria-hidden="true" />
        <span className="spine-ornament" aria-hidden="true">
          <svg viewBox="0 0 20 20"><path d="M4 13.5c0-4 2.6-7 6-7s6 3 6 7" fill="none" stroke="currentColor" strokeWidth="1.2"/><path d="M4.6 13.5h10.8" stroke="currentColor" strokeWidth="1.2"/><circle cx="8.2" cy="10.2" r=".8" fill="currentColor"/><circle cx="12" cy="10.2" r=".8" fill="currentColor"/></svg>
        </span>
        <span className={`spine-title ${spineTitleClass}`}>{spineLabel}</span>
        <span className="spine-author">{author}</span>
        {progress > 0 && (
          <span className="spine-progress" aria-hidden="true">
            <span style={{ height: `${Math.max(8, Math.min(100, progress * 100))}%` }} />
          </span>
        )}
        {progress > 0 && <span className="spine-ribbon" style={{ height: `${34 + progress * 24}px` }} aria-hidden="true" />}
      </button>
      {tip &&
        createPortal(
          <div
            className={cn('spine-tooltip-portal', tip.below && 'below')}
            style={{ left: tip.left, top: tip.top }}
            role="tooltip"
          >
            <div
              className="tip-cover"
              style={{
                backgroundImage: book.cover ? `url("${book.cover}")` : undefined,
                backgroundColor: book.cover ? undefined : accent,
              }}
            >
              {!book.cover && <span>{title.slice(0, 2)}</span>}
            </div>
            <div className="tip-body">
              <span className="tip-kicker">{book.genre || '藏书'}</span>
              <strong>{title}</strong>
              <span className="tip-author">{author}</span>
              <span className="tip-progress">{progress > 0 ? `已读 ${rerange(progress)}` : '还没翻开'}</span>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
