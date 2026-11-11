import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  className?: string;
  hideClose?: boolean;
};

export function Modal({ open, onClose, title, subtitle, children, footer, wide, className, hideClose }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'input, textarea, select, button:not(.modal-close), [tabindex="0"]',
      );
      focusable?.focus();
    }, 80);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn('modal', wide && 'wide', className)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panelRef}
      >
        {(title || !hideClose) && (
          <div className="modal-head">
            <div>
              {title && <h2>{title}</h2>}
              {subtitle && <p>{subtitle}</p>}
            </div>
            {!hideClose && (
              <button className="modal-close" onClick={onClose} aria-label="关闭">
                <X size={18} />
              </button>
            )}
          </div>
        )}
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
