import { Copy, Highlighter, NotebookPen, Sparkles, Star, Underline, X } from 'lucide-react';
import type { AnnotationColor } from '../../types';
import type { TextSelection } from '../../lib/selection';

const colors: { key: AnnotationColor; label: string }[] = [
  { key: 'amber', label: '琥珀黄' },
  { key: 'rose', label: '玫瑰红' },
  { key: 'sage', label: '鼠尾草' },
  { key: 'sky', label: '雾霭蓝' },
];

type Props = {
  selection: TextSelection;
  onHighlight: (color: AnnotationColor) => void;
  onUnderline: () => void;
  onFavorite: () => void;
  onNote: () => void;
  onAsk: () => void;
  onCopy: () => void;
  onClose: () => void;
};

export function SelectionToolbar({ selection, onHighlight, onUnderline, onFavorite, onNote, onAsk, onCopy, onClose }: Props) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = 344;
  const left = Math.min(vw - width / 2 - 14, Math.max(width / 2 + 14, selection.anchor.left + selection.anchor.width / 2));
  const placeBelow = selection.anchor.top < 96;
  const top = placeBelow ? selection.anchor.bottom + 12 : selection.anchor.top - 12;

  return (
    <div
      className={`selection-toolbar ${placeBelow ? 'below' : 'above'}`}
      style={{ left, top }}
      onMouseDown={(e) => e.preventDefault()}
      role="toolbar"
      aria-label="划线工具"
    >
      <div className="tb-colors">
        {colors.map((color) => (
          <button
            key={color.key}
            className={`tb-color ${color.key}`}
            title={`${color.label}高亮`}
            aria-label={`${color.label}高亮`}
            onClick={() => onHighlight(color.key)}
          />
        ))}
      </div>
      <span className="tb-divider" />
      <button className="tb-btn" onClick={onUnderline} title="下划线" aria-label="下划线">
        <Underline size={15} />
      </button>
      <button className="tb-btn" onClick={onFavorite} title="收藏划线" aria-label="收藏划线">
        <Star size={15} />
      </button>
      <button className="tb-btn" onClick={onNote} title="写笔记" aria-label="写笔记">
        <NotebookPen size={15} />
      </button>
      <button className="tb-btn accent" onClick={onAsk} title="分析这段 / 问 AI" aria-label="分析这段或问 AI">
        <Sparkles size={15} />
      </button>
      <span className="tb-divider" />
      <button className="tb-btn" onClick={onCopy} title="复制" aria-label="复制">
        <Copy size={14} />
      </button>
      <button className="tb-btn close" onClick={onClose} title="关闭" aria-label="关闭">
        <X size={14} />
      </button>
      <span className="tb-hint">
        <Highlighter size={10} /> {selection.text.length} 字
      </span>
    </div>
  );
}
