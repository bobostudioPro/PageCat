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
};

const shelfLabels = [
  { kicker: 'RECENTLY READ', zh: '常读常新' },
  { kicker: 'TO BE READ', zh: '未完待续' },
];

export function Shelf({ books, query, pullingId, onOpen, onContext, onUpload, onClearSearch }: Props) {
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

  return (
    <section className={cn('bookcase', filtered.length === 0 && 'empty')} aria-label="我的书架">
      <div className="bookcase-crown">
        <span className="crown-plate">
          <span className="crown-cat">⌂</span>
          <span>PAGECAT · 私人书房</span>
        </span>
        <span className="crown-line" />
        <span className="crown-year">EST. 2026</span>
      </div>

      <div className="bookcase-body">
        <div className="shelf-row">
          {firstRow.map((book, index) => (
            <BookSpine
              key={book.id}
              book={book}
              index={index}
              pulling={pullingId === book.id}
              onOpen={onOpen}
              onContext={onContext}
            />
          ))}
          {!query && <ShelfCat />}
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
              index={index + 3}
              pulling={pullingId === book.id}
              onOpen={onOpen}
              onContext={onContext}
            />
          ))}
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
