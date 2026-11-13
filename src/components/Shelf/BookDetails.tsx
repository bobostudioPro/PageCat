import { useEffect, useState } from 'react';
import { BookOpen, Highlighter, NotebookPen, Trash2 } from 'lucide-react';
import type { Book } from '../../types';
import { Modal } from '../ui/Modal';
import { listAnnotations, listNotes } from '../../lib/db';
import { rerange } from '../../lib/utils';

type Props = {
  book: Book | null;
  onClose: () => void;
  onOpen: (book: Book) => void;
  onRemove: (book: Book) => void;
};

export function BookDetails({ book, onClose, onOpen, onRemove }: Props) {
  const [counts, setCounts] = useState({ highlights: 0, favorites: 0, notes: 0 });
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!book) return;
    setConfirm(false);
    Promise.all([listAnnotations(book.id), listNotes(book.id)]).then(([anns, notes]) => {
      setCounts({
        highlights: anns.length,
        favorites: anns.filter((a) => a.favorite).length,
        notes: notes.length,
      });
    });
  }, [book]);

  if (!book) return null;

  return (
    <Modal open={!!book} onClose={onClose} title={book.titleZh || book.title} subtitle={`${book.authorZh || book.author}${book.year ? ` · ${book.year}` : ''}`} wide>
      <div className="book-details">
        <div className="details-cover" style={{ backgroundImage: book.cover ? `url("${book.cover}")` : undefined, backgroundColor: book.cover ? undefined : book.accent }}>
          {!book.cover && <span>{(book.titleZh || book.title).slice(0, 4)}</span>}
        </div>
        <div className="details-body">
          <div className="details-tags">
            <span>{book.genre || '未分类'}</span>
            <span>{book.pageCount} 页</span>
            {book.percent ? <span>已读 {rerange(book.percent)}</span> : <span>未读</span>}
            {book.isSample && <span>示例藏书</span>}
          </div>
          {book.description && <p className="details-desc">{book.description}</p>}
          <div className="details-stats">
            <div>
              <Highlighter size={15} />
              <strong>{counts.highlights}</strong>
              <span>条划线</span>
            </div>
            <div>
              <span className="star-char">★</span>
              <strong>{counts.favorites}</strong>
              <span>条收藏</span>
            </div>
            <div>
              <NotebookPen size={15} />
              <strong>{counts.notes}</strong>
              <span>篇笔记</span>
            </div>
          </div>
          <div className="details-actions">
            <button className="btn btn-brass" onClick={() => onOpen(book)}>
              <BookOpen size={16} />
              {book.percent ? `继续读第 ${book.lastPage ?? 1} 页` : '翻开这本书'}
            </button>
            {confirm ? (
              <span className="details-confirm">
                确定取下？
                <button onClick={() => onRemove(book)}>确定</button>
                <button onClick={() => setConfirm(false)}>取消</button>
              </span>
            ) : (
              <button className="btn btn-quiet details-remove" onClick={() => setConfirm(true)}>
                <Trash2 size={14} /> 取下
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
