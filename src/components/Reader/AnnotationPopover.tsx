import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Save, Sparkles, Star, Trash2, X } from 'lucide-react';
import type { Annotation, AnnotationColor, Note, Rect } from '../../types';
import { annotationStyle } from '../../lib/selection';

const colors: { key: AnnotationColor; label: string }[] = [
  { key: 'amber', label: '琥珀黄' },
  { key: 'rose', label: '玫瑰红' },
  { key: 'sage', label: '鼠尾草' },
  { key: 'sky', label: '雾霭蓝' },
];

type Props = {
  annotation: Annotation;
  note?: Note;
  anchor: { x: number; y: number; top: number; bottom: number };
  onClose: () => void;
  onColor: (color: AnnotationColor) => void;
  onFavorite: (value: boolean) => void;
  onSaveNote: (text: string) => Promise<void> | void;
  onDelete: () => void;
  onAsk: () => void;
  onJump: () => void;
};

export function AnnotationPopover({ annotation, note, anchor, onClose, onColor, onFavorite, onSaveNote, onDelete, onAsk, onJump }: Props) {
  const [text, setText] = useState(note?.text ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const color = annotationStyle(annotation).color;

  useEffect(() => {
    setText(note?.text ?? '');
    setConfirmDelete(false);
  }, [annotation.id, note?.id, note?.text]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = 330;
  const left = Math.min(vw - width - 14, Math.max(14, anchor.x - width / 2 + 8));
  const preferAbove = anchor.y > vh - 360;
  const top = preferAbove ? Math.max(14, anchor.y - 430) : Math.min(vh - 430, anchor.y + 14);

  const save = async () => {
    setSaving(true);
    try {
      await onSaveNote(text.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={ref} className="annotation-popover" style={{ left, top, width }} role="dialog" aria-label="划线详情">
      <div className="ap-head">
        <span className="ap-swatch" style={{ background: color }} />
        <span className="ap-title">第 {annotation.page} 页 · {annotation.style === 'underline' ? '下划线' : '高亮'}</span>
        <button className="ap-close" onClick={onClose} aria-label="关闭">
          <X size={14} />
        </button>
      </div>

      <button className="ap-quote" onClick={onJump} title="回到原文">
        <span>“{annotation.quote}”</span>
        <ArrowUpRight size={12} />
      </button>

      <div className="ap-colors">
        {colors.map((c) => (
          <button
            key={c.key}
            className={`tb-color ${c.key} ${annotation.color === c.key ? 'selected' : ''}`}
            title={c.label}
            aria-label={c.label}
            onClick={() => onColor(c.key)}
          />
        ))}
        <button
          className={`ap-fav ${annotation.favorite ? 'on' : ''}`}
          onClick={() => onFavorite(!annotation.favorite)}
          title={annotation.favorite ? '取消收藏' : '收藏'}
        >
          <Star size={14} fill={annotation.favorite ? 'currentColor' : 'none'} />
          {annotation.favorite ? '已收藏' : '收藏'}
        </button>
      </div>

      <textarea
        className="ap-note"
        value={text}
        placeholder="写下此刻的想法…"
        onChange={(e) => setText(e.target.value)}
        rows={3}
        autoFocus={!text}
      />

      <div className="ap-actions">
        <button className="ap-ai" onClick={onAsk}>
          <Sparkles size={13} /> 问 AI
        </button>
        <span className="ap-spacer" />
        {confirmDelete ? (
          <>
            <button className="ap-delete confirm" onClick={onDelete}>
              确认删除
            </button>
            <button className="ap-cancel" onClick={() => setConfirmDelete(false)}>
              取消
            </button>
          </>
        ) : (
          <button className="ap-delete" onClick={() => setConfirmDelete(true)} title="删除划线">
            <Trash2 size={13} />
          </button>
        )}
        <button className="ap-save" onClick={save} disabled={saving || text.trim() === (note?.text ?? '').trim()}>
          <Save size={13} /> {saving ? '保存中' : '保存笔记'}
        </button>
      </div>
    </div>
  );
}
