import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, GripHorizontal, Loader2, Volume2, X } from 'lucide-react';
import type { TextSelection } from '../../lib/selection';
import type { TranslationProvider } from '../../lib/translate';
import { useTts } from '../../state/tts';
import { useToast } from '../../state/toast';

type Props = {
  anchor: TextSelection['anchor'];
  source: string;
  target: string;
  loading: boolean;
  error?: string | null;
  provider?: TranslationProvider;
  targetLang: 'zh' | 'en';
  onClose: () => void;
};

export function SelectionTranslationCard({ anchor, source, target, loading, error, provider, targetLang, onClose }: Props) {
  const speak = useTts((state) => state.speak);
  const push = useToast((state) => state.push);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; left: number; top: number } | null>(null);
  const width = 382;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(vw - width / 2 - 12, Math.max(width / 2 + 12, anchor.left + anchor.width / 2));
  const below = anchor.bottom < vh - 300;
  const top = below ? anchor.bottom + 12 : anchor.top - 12;
  const style = position
    ? { left: position.left, top: position.top, width, transform: 'none' as const }
    : { left, top, width };

  const startDrag = (event: React.PointerEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top };
    setPosition({ left: rect.left, top: rect.top });
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    const rect = cardRef.current?.getBoundingClientRect();
    if (!drag || !rect) return;
    const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
    const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
    setPosition({
      left: Math.min(maxLeft, Math.max(8, drag.left + event.clientX - drag.startX)),
      top: Math.min(maxTop, Math.max(8, drag.top + event.clientY - drag.startY)),
    });
  };

  const endDrag = (event: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return createPortal(
    <div
      ref={cardRef}
      className={`selection-translation ${below ? 'below' : 'above'} ${position ? 'dragged' : ''} ${dragging ? 'is-dragging' : ''}`}
      style={style}
      onMouseDown={(event) => event.preventDefault()}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="dialog"
      aria-label="选中文字翻译"
    >
      <div className="st-head" onPointerDown={startDrag} title="拖动卡片">
        <GripHorizontal size={13} className="st-grip" />
        <span>选中翻译</span>
        <span className="st-provider">{loading ? '翻译中' : provider === 'ai' ? 'AI 翻译' : '免费翻译'}</span>
        <button onPointerDown={(event) => event.stopPropagation()} onClick={onClose} aria-label="关闭翻译">
          <X size={14} />
        </button>
      </div>
      <div className="st-body">
        <p className="st-source">{source}</p>
        <div className="st-target">
          {loading ? (
            <span className="st-loading">
              <Loader2 size={14} className="spin" /> 正在翻译…
            </span>
          ) : error ? (
            <span className="st-error">{error}</span>
          ) : (
            <p>{target}</p>
          )}
        </div>
      </div>
      <div className="st-actions">
        <button
          onClick={() => speak(source, { label: '选中原文', lang: /[\u3400-\u9fff]/.test(source) ? 'zh-CN' : 'en-US' })}
          title="朗读原文"
        >
          <Volume2 size={13} /> 原文
        </button>
        <button
          onClick={() => target && speak(target, { label: '选中译文', lang: targetLang === 'zh' ? 'zh-CN' : 'en-US' })}
          title="朗读译文"
          disabled={!target || loading}
        >
          <Volume2 size={13} /> 译文
        </button>
        <button
          onClick={() => {
            if (!target) return;
            void navigator.clipboard.writeText(target);
            push('已复制译文', 'success');
          }}
          title="复制译文"
          disabled={!target || loading}
        >
          <Copy size={13} /> 复制
        </button>
      </div>
    </div>,
    document.body,
  );
}
