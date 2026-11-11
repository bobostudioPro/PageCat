import { useState } from 'react';
import { Highlighter, NotebookPen, Star, Trash2 } from 'lucide-react';
import type { Annotation, Note } from '../../types';
import { annotationStyle } from '../../lib/selection';

type Props = {
  annotations: Annotation[];
  notes: Note[];
  currentPage: number;
  onJump: (page: number, id?: string) => void;
  onFavorite: (annotation: Annotation, value: boolean) => void;
  onRemove: (annotation: Annotation) => void;
};

export function HighlightsPanel({ annotations, notes, currentPage, onJump, onFavorite, onRemove }: Props) {
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const filtered = filter === 'favorites' ? annotations.filter((a) => a.favorite) : annotations;
  const noteById = new Map(notes.map((n) => [n.id, n]));

  return (
    <div className="highlight-panel">
      <div className="panel-toolbar">
        <span className="panel-count">
          共 <strong>{annotations.length}</strong> 条划线
        </span>
        <div className="mini-segmented">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            全部
          </button>
          <button className={filter === 'favorites' ? 'active' : ''} onClick={() => setFilter('favorites')}>
            <Star size={10} /> 收藏
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="panel-empty">
          <span className="empty-icon">
            <Highlighter size={22} />
          </span>
          <strong>{filter === 'favorites' ? '还没有收藏的句子' : '还没有划线'}</strong>
          <p>在书页上选中一段文字，会浮出划线工具。四种颜色，可以选中你此刻的心情。</p>
        </div>
      ) : (
        <div className="highlight-list">
          {filtered.map((annotation) => {
            const note = annotation.noteId ? noteById.get(annotation.noteId) : undefined;
            const color = annotationStyle(annotation).color;
            return (
              <article
                key={annotation.id}
                className={`highlight-card ${currentPage === annotation.page ? 'on-page' : ''}`}
                onClick={() => onJump(annotation.page, annotation.id)}
              >
                <span className="hc-stripe" style={{ background: color }} />
                <div className="hc-head">
                  <span className="hc-page">第 {annotation.page} 页</span>
                  <span className="hc-style">{annotation.style === 'underline' ? '下划线' : '高亮'}</span>
                  <span className="hc-spacer" />
                  <button
                    className={`hc-icon ${annotation.favorite ? 'on' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFavorite(annotation, !annotation.favorite);
                    }}
                    aria-label={annotation.favorite ? '取消收藏' : '收藏'}
                  >
                    <Star size={13} fill={annotation.favorite ? 'currentColor' : 'none'} />
                  </button>
                  {confirmId === annotation.id ? (
                    <span className="hc-confirm" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          onRemove(annotation);
                          setConfirmId(null);
                        }}
                      >
                        删除
                      </button>
                      <button onClick={() => setConfirmId(null)}>取消</button>
                    </span>
                  ) : (
                    <button
                      className="hc-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmId(annotation.id);
                      }}
                      aria-label="删除划线"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <blockquote className="hc-quote">{annotation.quote}</blockquote>
                {note && (
                  <div className="hc-note">
                    <NotebookPen size={11} />
                    <span>{note.text}</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
