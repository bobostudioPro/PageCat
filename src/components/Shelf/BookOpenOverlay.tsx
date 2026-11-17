import { useEffect, useRef } from 'react';
import type { Book } from '../../types';

export function BookOpenOverlay({ book, onDone }: { book: Book; onDone: () => void }) {
  const done = useRef(false);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => {
      if (done.current) return;
      done.current = true;
      onDone();
    }, reduced ? 220 : 1320);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  const title = book.titleZh || book.title;
  const author = book.authorZh || book.author;

  return (
    <div
      className="open-overlay"
      onClick={() => {
        if (done.current) return;
        done.current = true;
        onDone();
      }}
    >
      <div className="opening-stage">
        <div className="opening-book">
          <div className="opening-page">
            <span className="opening-page-kicker">PAGECAT · OPENING</span>
            <strong>{title}</strong>
            <span className="opening-page-author">{author}</span>
            <span className="opening-page-progress">
              {book.percent ? `从第 ${book.lastPage ?? 1} 页继续` : '从第一页开始'}
            </span>
            <span className="opening-page-mark">❦</span>
          </div>
          <div
            className="opening-cover"
            style={{
              background: book.cover ? `#2a1b12 url("${book.cover}") center/cover no-repeat` : book.accent,
            }}
          >
            <span className="opening-cover-grain" />
            <span className="opening-cover-frame" />
            <span className="opening-cover-shine" />
            {!book.cover && (
              <span className="opening-cover-type">
                <em>{book.genre || 'PAGECAT LIBRARY'}</em>
                <strong>{title}</strong>
                <i>{author}</i>
              </span>
            )}
          </div>
        </div>
        <p className="opening-caption">
          <span>正在翻开</span>《{title}》
        </p>
      </div>
    </div>
  );
}
