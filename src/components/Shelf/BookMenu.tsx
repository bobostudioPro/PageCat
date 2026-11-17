import { useEffect, useRef } from 'react';
import { BookOpen, Info, Trash2 } from 'lucide-react';
import type { Book } from '../../types';

type Props = {
  book: Book;
  x: number;
  y: number;
  onClose: () => void;
  onOpen: (book: Book) => void;
  onDetails: (book: Book) => void;
  onRemove: (book: Book) => void;
};

export function BookMenu({ book, x, y, onClose, onOpen, onDetails, onRemove }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const left = Math.min(window.innerWidth - 220, Math.max(12, x - 20));
  const top = Math.min(window.innerHeight - 180, Math.max(12, y + 8));

  return (
    <div ref={ref} className="book-menu" style={{ left, top }} role="menu" aria-label={`整理《${book.title}》`}>
      <div className="book-menu-head">
        <span style={{ background: book.spineColor || book.accent }} />
        <div>
          <strong>{book.titleZh || book.title}</strong>
          <em>{book.authorZh || book.author}</em>
        </div>
      </div>
      <button role="menuitem" onClick={() => onOpen(book)}>
        <BookOpen size={15} /> 继续阅读
      </button>
      <button role="menuitem" onClick={() => onDetails(book)}>
        <Info size={15} /> 书籍详情
      </button>
      <button role="menuitem" className="danger" onClick={() => onRemove(book)}>
        <Trash2 size={15} /> 从书架取下
      </button>
    </div>
  );
}
