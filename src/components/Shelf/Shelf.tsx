import { useRef, useState } from 'react';
import type { Book } from '../../types';
import { BookSpine } from './BookSpine';
import { ShelfCat } from './ShelfCat';
import { UploadSlot } from './UploadSlot';
import { ShelfDecor } from './ShelfDecor';
import { cn } from '../../lib/utils';

type Props = {
  books: Book[];
  query: string;
  pullingId?: string;
  onOpen: (book: Book) => void;
  onContext: (book: Book, x: number, y: number) => void;
  onUpload: () => void;
  onClearSearch: () => void;
  onReorder: (orderedIds: string[]) => void;
  dragActive?: boolean;
};

type DropTarget = { row: number; index: number; left: number };

const shelfLabels = [
  { kicker: 'RECENTLY READ', zh: '常读常新' },
  { kicker: 'TO BE READ', zh: '未完待续' },
];

export function Shelf({
  books,
  query,
  pullingId,
  onOpen,
  onContext,
  onUpload,
  onClearSearch,
  onReorder,
  dragActive,
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropTarget | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragIdRef = useRef<string | null>(null);
  const dropRef = useRef<DropTarget | null>(null);
  const justDragged = useRef(false);

  const canDrag = !query.trim();
  const filtered = query.trim()
    ? books.filter((b) => {
        const q = query.trim().toLowerCase();
        return (
          b.title.toLowerCase().includes(q) ||
          (b.titleZh ?? '').toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          (b.authorZh ?? '').toLowerCase().includes(q)
        );
      })
    : books;
  const perRow = filtered.length > 6 ? 4 : 3;
  const firstRow = filtered.slice(0, perRow);
  const secondRow = filtered.slice(perRow, perRow * 2);
  const overflow = filtered.slice(perRow * 2);

  const handleOpen = (book: Book) => {
    if (justDragged.current) return;
    onOpen(book);
  };

  const finishDrag = () => {
    dragIdRef.current = null;
    dropRef.current = null;
    setDragId(null);
    setDrop(null);
    window.setTimeout(() => {
      justDragged.current = false;
    }, 280);
  };

  const handleDragStart = (book: Book, e: React.DragEvent<HTMLDivElement>) => {
    if (!canDrag) return;
    dragIdRef.current = book.id;
    setDragId(book.id);
    justDragged.current = true;
    setDrop(null);
    dropRef.current = null;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', book.id);
  };

  const computeDrop = (clientX: number, clientY: number): DropTarget | null => {
    const body = bodyRef.current;
    if (!body) return null;
    const rows = [...body.querySelectorAll<HTMLElement>('.shelf-row')];
    if (!rows.length) return null;
    const rowRects = rows.map((row) => row.getBoundingClientRect());
    let row = rowRects.findIndex((rect) => clientY >= rect.top && clientY <= rect.bottom);
    if (row < 0) {
      row = rowRects.reduce(
        (best, rect, index) =>
          Math.abs((rect.top + rect.bottom) / 2 - clientY) <
          Math.abs((rowRects[best].top + rowRects[best].bottom) / 2 - clientY)
            ? index
            : best,
        0,
      );
    }
    const rowEl = rows[row];
    const rowRect = rowRects[row];
    const items = [...rowEl.querySelectorAll<HTMLElement>('.spine-wrap')]
      .map((el) => ({
        index: Number(el.dataset.shelfIndex),
        rect: el.getBoundingClientRect(),
      }))
      .filter((item) => Number.isFinite(item.index))
      .sort((a, b) => a.index - b.index);

    if (!items.length) {
      return { row, index: filtered.length, left: 14 };
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (clientX <= first.rect.left) {
      return { row, index: first.index, left: first.rect.left - rowRect.left };
    }
    if (clientX >= last.rect.right) {
      return { row, index: last.index + 1, left: last.rect.right - rowRect.left + 6 };
    }
    for (const item of items) {
      if (clientX < item.rect.left + item.rect.width / 2) {
        return { row, index: item.index, left: item.rect.left - rowRect.left };
      }
    }
    return { row, index: last.index + 1, left: last.rect.right - rowRect.left + 6 };
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!dragIdRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = computeDrop(e.clientX, e.clientY);
    if (target) {
      dropRef.current = target;
      setDrop(target);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!dragIdRef.current) return;
    const next = e.relatedTarget as Node | null;
    if (!next || !e.currentTarget.contains(next)) {
      dropRef.current = null;
      setDrop(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!dragIdRef.current) return;
    e.preventDefault();
    const draggedId = dragIdRef.current;
    const target = computeDrop(e.clientX, e.clientY) ?? dropRef.current;
    if (target) {
      const ids = books.map((book) => book.id);
      const from = ids.indexOf(draggedId);
      if (from >= 0) {
        ids.splice(from, 1);
        let insert = target.index;
        if (insert > from) insert -= 1;
        insert = Math.max(0, Math.min(ids.length, insert));
        ids.splice(insert, 0, draggedId);
        const changed = ids.some((id, index) => id !== books[index]?.id);
        if (changed) onReorder(ids);
      }
    }
    finishDrag();
  };

  return (
    <section
      className={cn('bookcase', filtered.length === 0 && 'empty', dragId && 'reordering')}
      aria-label="我的书架"
    >
      <div className="bookcase-crown">
        <span className="crown-plate">
          <span className="crown-cat">⌂</span>
          <span>PAGECAT · 私人书房</span>
        </span>
        <span className="crown-line" />
        <span className="crown-year">EST. 2026</span>
      </div>

      <div
        ref={bodyRef}
        className="bookcase-body"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="shelf-row">
          {firstRow.map((book, index) => (
            <BookSpine
              key={book.id}
              book={book}
              shelfIndex={index}
              pulling={pullingId === book.id}
              draggable={canDrag}
              dragging={dragId === book.id}
              reordering={Boolean(dragId)}
              onOpen={handleOpen}
              onContext={onContext}
              onDragStart={handleDragStart}
              onDragEnd={finishDrag}
            />
          ))}
          {drop?.row === 0 && <span className="shelf-drop-line" style={{ left: drop.left }} aria-hidden="true" />}
          {!query && <ShelfCat dragActive={dragActive} />}
          {filtered.length === 0 && (
            <div className="shelf-empty">
              <p>{query ? `没有找到「${query}」` : '书架还空着，像一间刚打扫好的房间。'}</p>
              {query ? (
                <button className="shelf-empty-link" onClick={onClearSearch}>
                  清除搜索
                </button>
              ) : (
                <button className="shelf-empty-link" onClick={onUpload}>
                  放入第一本书
                </button>
              )}
            </div>
          )}
          <div className="shelf-flex-spacer" />
          <span className="shelf-plaque">
            <em>{shelfLabels[0].kicker}</em>
            <i>{shelfLabels[0].zh}</i>
          </span>
        </div>
        <div className="shelf-board" aria-hidden="true">
          <span className="board-light" />
          <span className="board-front" />
        </div>

        <div className="shelf-row lower">
          {secondRow.map((book, index) => (
            <BookSpine
              key={book.id}
              book={book}
              shelfIndex={perRow + index}
              pulling={pullingId === book.id}
              draggable={canDrag}
              dragging={dragId === book.id}
              reordering={Boolean(dragId)}
              onOpen={handleOpen}
              onContext={onContext}
              onDragStart={handleDragStart}
              onDragEnd={finishDrag}
            />
          ))}
          {drop?.row === 1 && <span className="shelf-drop-line" style={{ left: drop.left }} aria-hidden="true" />}
          {!query && filtered.every((b) => b.id) && <UploadSlot onUpload={onUpload} />}
          {!query && <ShelfDecor />}
          {filtered.length > 0 && secondRow.length === 0 && (
            <div className="shelf-quiet">
              <span>再放一本书，这里会更热闹。</span>
              <button onClick={onUpload}>放入新书</button>
            </div>
          )}
          <div className="shelf-flex-spacer" />
          <span className="shelf-plaque lower">
            <em>{shelfLabels[1].kicker}</em>
            <i>{shelfLabels[1].zh}</i>
          </span>
        </div>
        <div className="shelf-board" aria-hidden="true">
          <span className="board-light" />
          <span className="board-front" />
        </div>
      </div>

      {overflow.length > 0 && (
        <div className="overflow-books">
          <span className="overflow-label">还有 {overflow.length} 本收在抽屉里</span>
          {overflow.map((book) => (
            <button key={book.id} onClick={() => onOpen(book)} className="overflow-book">
              <span style={{ background: book.spineColor || book.accent }} />
              {book.titleZh || book.title}
            </button>
          ))}
        </div>
      )}

      <div className="bookcase-base">
        <span />
      </div>
    </section>
  );
}
