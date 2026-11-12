import { Fragment, useEffect, useRef, useState } from 'react';
import type { Book } from '../../types';
import { BookSpine } from './BookSpine';
import { ShelfCat } from './ShelfCat';
import { UploadSlot } from './UploadSlot';
import { ShelfDecor } from './ShelfDecor';
import { cn } from '../../lib/utils';
import { useToast } from '../../state/toast';

type Props = {
  books: Book[];
  query: string;
  pullingId?: string;
  onOpen: (book: Book) => void;
  onContext: (book: Book, x: number, y: number) => void;
  onUpload: () => void;
  onClearSearch: () => void;
  onReorder: (rows: string[][]) => void;
  dragActive?: boolean;
};

type DropTarget = { row: number; index: number; left: number };

type DecorKind = 'cat' | 'plant';
type DecorPlacement = { row: number | null; x: number; surface?: 'shelf' | 'top' };
type DecorStore = { cat: DecorPlacement; plant: DecorPlacement };
type DecorTarget =
  | { surface: 'shelf'; row: number; x: number }
  | { surface: 'top'; x: number };
type DecorDrop = DecorTarget & { kind: DecorKind };

const DECOR_KEY = 'pagecat.shelfDecor.v1';
const defaultDecor: DecorStore = {
  cat: { row: 0, x: 82, surface: 'shelf' },
  plant: { row: null, x: 80, surface: 'shelf' },
};

function clampDecorX(x: number) {
  return Math.max(10, Math.min(86, x));
}

function loadDecor(): DecorStore {
  try {
    const raw = localStorage.getItem(DECOR_KEY);
    if (!raw) return defaultDecor;
    const parsed = JSON.parse(raw) as Partial<DecorStore>;
    return {
      cat: {
        row: Number.isInteger(parsed.cat?.row) ? Number(parsed.cat?.row) : 0,
        x: clampDecorX(Number(parsed.cat?.x ?? defaultDecor.cat.x)),
        surface: parsed.cat?.surface === 'top' ? 'top' : 'shelf',
      },
      plant: {
        row: Number.isInteger(parsed.plant?.row) ? Number(parsed.plant?.row) : null,
        x: clampDecorX(Number(parsed.plant?.x ?? defaultDecor.plant.x)),
        surface: parsed.plant?.surface === 'top' ? 'top' : 'shelf',
      },
    };
  } catch {
    return defaultDecor;
  }
}

function saveDecor(decor: DecorStore) {
  try {
    localStorage.setItem(DECOR_KEY, JSON.stringify(decor));
  } catch {
    // visual placement only; ignore storage errors
  }
}

const rowCapacity = 12;

const shelfLabels = [
  { kicker: 'RECENTLY READ', zh: '常读常新' },
  { kicker: 'STILL READING', zh: '继续翻阅' },
  { kicker: 'TO BE READ', zh: '未完待续' },
];

function useShelfLayout() {
  const read = () => {
    const width = typeof window === 'undefined' ? 1440 : window.innerWidth;
    return { wide: width >= 1200, perRow: width < 760 ? 3 : 4 };
  };
  const [layout, setLayout] = useState(read);
  useEffect(() => {
    const onResize = () => setLayout(read());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return layout;
}

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
  const layout = useShelfLayout();
  const toast = useToast((s) => s.push);
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropTarget | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragIdRef = useRef<string | null>(null);
  const dropRef = useRef<DropTarget | null>(null);
  const justDragged = useRef(false);
  const [decor, setDecor] = useState<DecorStore>(loadDecor);
  const [decorDrag, setDecorDrag] = useState<DecorKind | null>(null);
  const [decorDrop, setDecorDrop] = useState<DecorDrop | null>(null);
  const decorDragRef = useRef<DecorKind | null>(null);

  const canDrag = !query.trim() && layout.wide;
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

  let rows: Book[][];
  if (layout.wide) {
    const maxRow = filtered.reduce((max, book) => Math.max(max, book.shelfRow ?? 0), 0);
    const count = Math.max(2, maxRow + 1);
    rows = Array.from({ length: count }, () => []);
    for (const book of filtered) {
      const row = Math.min(count - 1, book.shelfRow ?? 0);
      rows[row].push(book);
    }
    rows.forEach((row) => row.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
  } else {
    const count = Math.max(2, Math.ceil(filtered.length / layout.perRow));
    const base = Math.floor(filtered.length / count);
    const extra = filtered.length % count;
    let offset = 0;
    rows = Array.from({ length: count }, (_, index) => {
      const take = base + (index < extra ? 1 : 0);
      const row = filtered.slice(offset, offset + take);
      offset += take;
      return row;
    });
  }

  const catOnTop = decor.cat.surface === 'top';
  const plantOnTop = decor.plant.surface === 'top';
  const catRow = catOnTop ? -1 : Math.min(rows.length - 1, Math.max(0, decor.cat.row ?? 0));
  const plantRow = plantOnTop ? -1 : Math.min(rows.length - 1, Math.max(0, decor.plant.row ?? rows.length - 1));

  useEffect(() => {
    if (query.trim()) return;
    setDecor((prev) => {
      const last = rows.length - 1;
      const nextCatRow =
        prev.cat.surface === 'top' ? prev.cat.row : Math.max(0, Math.min(prev.cat.row ?? 0, last));
      const nextPlantRow =
        prev.plant.surface === 'top'
          ? prev.plant.row
          : prev.plant.row == null
            ? null
            : Math.max(0, Math.min(prev.plant.row, last));
      if (nextCatRow === prev.cat.row && nextPlantRow === prev.plant.row) return prev;
      const next = {
        cat: { ...prev.cat, row: nextCatRow },
        plant: { ...prev.plant, row: nextPlantRow },
      };
      saveDecor(next);
      return next;
    });
  }, [rows.length, query]);

  const handleOpen = (book: Book) => {
    if (justDragged.current) return;
    onOpen(book);
  };

  const finishDecorDrag = () => {
    decorDragRef.current = null;
    setDecorDrag(null);
    setDecorDrop(null);
  };

  const handleDecorDragStart = (kind: DecorKind, e: React.DragEvent<HTMLButtonElement>) => {
    dragIdRef.current = null;
    dropRef.current = null;
    setDragId(null);
    setDrop(null);
    decorDragRef.current = kind;
    setDecorDrag(kind);
    setDecorDrop(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `decor:${kind}`);
  };

  const placeDecor = (kind: DecorKind, target: DecorTarget) => {
    const placement: DecorPlacement =
      target.surface === 'top'
        ? { surface: 'top', row: null, x: clampDecorX(target.x) }
        : { surface: 'shelf', row: target.row, x: clampDecorX(target.x) };
    const next: DecorStore = { ...decor, [kind]: placement };
    setDecor(next);
    saveDecor(next);
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
    decorDragRef.current = null;
    setDecorDrag(null);
    setDecorDrop(null);
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
    const rowElements = [...body.querySelectorAll<HTMLElement>('.shelf-row')];
    if (!rowElements.length) return null;
    const rowRects = rowElements.map((row) => row.getBoundingClientRect());
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
    const rowEl = rowElements[row];
    const rowRect = rowRects[row];
    const items = [...rowEl.querySelectorAll<HTMLElement>('.spine-wrap')]
      .map((el) => ({
        index: Number(el.dataset.shelfIndex),
        rect: el.getBoundingClientRect(),
      }))
      .filter((item) => Number.isFinite(item.index))
      .sort((a, b) => a.index - b.index);

    if (!items.length) {
      return { row, index: 0, left: 14 };
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

  const computeDecorDrop = (clientX: number, clientY: number): DecorTarget | null => {
    const body = bodyRef.current;
    if (!body) return null;
    const bookcase = body.closest('.bookcase') as HTMLElement | null;
    const bookcaseRect = bookcase?.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    if (bookcaseRect && clientY <= bodyRect.top && clientY >= bookcaseRect.top - 198) {
      const x = clampDecorX(((clientX - bookcaseRect.left) / bookcaseRect.width) * 100);
      return { surface: 'top', x };
    }
    const rowElements = [...body.querySelectorAll<HTMLElement>('.shelf-row')];
    if (!rowElements.length) return null;
    const rects = rowElements.map((row) => row.getBoundingClientRect());
    let row = rects.findIndex((rect) => clientY >= rect.top && clientY <= rect.bottom);
    if (row < 0) {
      row = rects.reduce(
        (best, rect, index) =>
          Math.abs((rect.top + rect.bottom) / 2 - clientY) <
          Math.abs((rects[best].top + rects[best].bottom) / 2 - clientY)
            ? index
            : best,
        0,
      );
    }
    const x = clampDecorX(((clientX - rects[row].left) / rects[row].width) * 100);
    return { surface: 'shelf', row, x };
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (decorDragRef.current) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const target = computeDecorDrop(e.clientX, e.clientY);
      if (target) {
        const kind = decorDragRef.current;
        setDecorDrop(target.surface === 'top' ? { ...target, kind } : { ...target, kind });
      }
      return;
    }
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
    if (!dragIdRef.current && !decorDragRef.current) return;
    const next = e.relatedTarget as Node | null;
    if (!next || !e.currentTarget.contains(next)) {
      dropRef.current = null;
      setDrop(null);
      setDecorDrop(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (decorDragRef.current) {
      e.preventDefault();
      const kind = decorDragRef.current;
      const target = computeDecorDrop(e.clientX, e.clientY);
      if (target) placeDecor(kind, target);
      finishDecorDrag();
      return;
    }
    if (!dragIdRef.current) return;
    e.preventDefault();
    const draggedId = dragIdRef.current;
    const target = computeDrop(e.clientX, e.clientY) ?? dropRef.current;
    if (target) {
      const rowIds = rows.map((row) => row.map((book) => book.id));
      const sourceRow = rowIds.findIndex((ids) => ids.includes(draggedId));
      if (sourceRow >= 0) {
        const targetHasRoom =
          sourceRow === target.row || rowIds[target.row].length < rowCapacity;
        if (targetHasRoom) {
          const sourceIndex = rowIds[sourceRow].indexOf(draggedId);
          rowIds[sourceRow].splice(sourceIndex, 1);
          let insert = target.index;
          if (sourceRow === target.row && sourceIndex < insert) insert -= 1;
          insert = Math.max(0, Math.min(rowIds[target.row].length, insert));
          rowIds[target.row].splice(insert, 0, draggedId);
          const changed = rowIds.some(
            (ids, row) => ids.length !== rows[row]?.length || ids.some((id, index) => id !== rows[row][index]?.id),
          );
          if (changed) onReorder(rowIds);
        } else {
          toast(`这一层已经放满 ${rowCapacity} 本，先挪走一本吧`);
        }
      }
    }
    finishDrag();
  };

  return (
    <section
      className={cn('bookcase', filtered.length === 0 && 'empty', (dragId || decorDrag) && 'reordering')}
      aria-label="我的书架"
    >
      {!query && (catOnTop || plantOnTop || decorDrop?.surface === 'top') && (
        <div className="bookcase-top-decor">
          {catOnTop && (
            <ShelfCat
              x={decor.cat.x}
              movable={layout.wide}
              dragging={decorDrag === 'cat'}
              onMoveStart={(event) => handleDecorDragStart('cat', event)}
              onMoveEnd={finishDecorDrag}
              dragActive={dragActive}
            />
          )}
          {plantOnTop && (
            <ShelfDecor
              x={decor.plant.x}
              movable={layout.wide}
              dragging={decorDrag === 'plant'}
              onMoveStart={(event) => handleDecorDragStart('plant', event)}
              onMoveEnd={finishDecorDrag}
            />
          )}
          {decorDrop?.surface === 'top' && (
            <span className={cn('decor-drop-marker top', decorDrop.kind)} style={{ left: `${decorDrop.x}%` }} aria-hidden="true">
              <em>{decorDrop.kind === 'cat' ? '猫' : '盆栽'}</em>
            </span>
          )}
        </div>
      )}
      {decorDrag && (
        <div
          className="bookcase-top-drop active"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        />
      )}
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
        {rows.map((rowBooks, rowIndex) => {
          const isFirst = rowIndex === 0;
          const isLast = rowIndex === rows.length - 1;
          const label = isFirst ? shelfLabels[0] : isLast ? shelfLabels[2] : shelfLabels[1];
          return (
            <Fragment key={rowIndex}>
              <div className={cn('shelf-row', rowIndex > 0 && 'lower')}>
                {rowBooks.map((book, index) => (
                  <BookSpine
                    key={book.id}
                    book={book}
                    shelfIndex={index}
                    pulling={pullingId === book.id}
                    draggable={canDrag}
                    dragging={dragId === book.id}
                    reordering={Boolean(dragId || decorDrag)}
                    onOpen={handleOpen}
                    onContext={onContext}
                    onDragStart={handleDragStart}
                    onDragEnd={finishDrag}
                  />
                ))}
                {drop?.row === rowIndex && <span className="shelf-drop-line" style={{ left: drop.left }} aria-hidden="true" />}
                {decorDrop?.surface === 'shelf' && decorDrop.row === rowIndex && (
                  <span className={cn('decor-drop-marker', decorDrop.kind)} style={{ left: `${decorDrop.x}%` }} aria-hidden="true">
                    <em>{decorDrop.kind === 'cat' ? '猫' : '盆栽'}</em>
                  </span>
                )}
                {!query && !catOnTop && catRow === rowIndex && (
                  <ShelfCat
                    x={decor.cat.x}
                    movable={layout.wide}
                    dragging={decorDrag === 'cat'}
                    onMoveStart={(event) => handleDecorDragStart('cat', event)}
                    onMoveEnd={finishDecorDrag}
                    dragActive={dragActive}
                  />
                )}
                {isFirst && filtered.length === 0 && (
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
                {isLast && !query && <UploadSlot onUpload={onUpload} />}
                {!query && !plantOnTop && plantRow === rowIndex && (
                  <ShelfDecor
                    x={decor.plant.x}
                    movable={layout.wide}
                    dragging={decorDrag === 'plant'}
                    onMoveStart={(event) => handleDecorDragStart('plant', event)}
                    onMoveEnd={finishDecorDrag}
                  />
                )}
                {isLast && filtered.length > 0 && rowBooks.length === 0 && (
                  <div className="shelf-quiet">
                    <span>再放一本书，这里会更热闹。</span>
                    <button onClick={onUpload}>放入新书</button>
                  </div>
                )}
                <div className="shelf-flex-spacer" />
                <span className={cn('shelf-plaque', rowIndex > 0 && 'lower')}>
                  <em>{label.kicker}</em>
                  <i>{label.zh}</i>
                </span>
              </div>
              <div className="shelf-board" aria-hidden="true">
                <span className="board-light" />
                <span className="board-front" />
              </div>
            </Fragment>
          );
        })}
      </div>

      <div className="bookcase-base">
        <span />
      </div>
    </section>
  );
}
