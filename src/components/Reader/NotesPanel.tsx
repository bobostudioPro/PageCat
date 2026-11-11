import { useEffect, useRef, useState } from 'react';
import { Check, NotebookPen, Pencil, Trash2, X } from 'lucide-react';
import type { Note } from '../../types';
import { formatDate } from '../../lib/utils';

type Props = {
  notes: Note[];
  currentPage: number;
  focusSignal: number;
  onJump: (page: number, annotationId?: string) => void;
  onAdd: (text: string) => Promise<void>;
  onUpdate: (note: Note, text: string) => Promise<void>;
  onRemove: (note: Note) => void;
};

export function NotesPanel({ notes, currentPage, focusSignal, onJump, onAdd, onUpdate, onRemove }: Props) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusSignal > 0) {
      textareaRef.current?.focus();
      textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusSignal]);

  const add = async () => {
    if (!draft.trim() || saving) return;
    setSaving(true);
    try {
      await onAdd(draft);
      setDraft('');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (note: Note) => {
    if (!editText.trim()) return;
    await onUpdate(note, editText);
    setEditingId(null);
  };

  return (
    <div className="notes-panel">
      <div className="note-composer">
        <div className="note-composer-head">
          <span>在第 {currentPage} 页写一条笔记</span>
          <NotebookPen size={13} />
        </div>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="不必完整，先写下来…"
          rows={3}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void add();
          }}
        />
        <div className="note-composer-foot">
          <span>⌘ + Enter 保存</span>
          <button onClick={add} disabled={!draft.trim() || saving}>
            {saving ? '保存中…' : '保存笔记'}
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="panel-empty">
          <span className="empty-icon">
            <NotebookPen size={22} />
          </span>
          <strong>还没有笔记</strong>
          <p>笔记可以附在划线上，也可以独立存在于某一页。所有文字都只留在这台设备。</p>
        </div>
      ) : (
        <div className="note-list">
          {notes.map((note) => (
            <article key={note.id} className="note-card">
              <div className="nc-head">
                <button className="nc-page" onClick={() => onJump(note.page, note.annotationId)}>
                  第 {note.page} 页
                </button>
                <span className="nc-date">{formatDate(note.updatedAt)}</span>
                <span className="nc-spacer" />
                <button
                  className="hc-icon"
                  onClick={() => {
                    setEditingId(note.id);
                    setEditText(note.text);
                  }}
                  aria-label="编辑笔记"
                >
                  <Pencil size={12} />
                </button>
                {confirmId === note.id ? (
                  <span className="hc-confirm">
                    <button
                      onClick={() => {
                        onRemove(note);
                        setConfirmId(null);
                      }}
                    >
                      删除
                    </button>
                    <button onClick={() => setConfirmId(null)}>取消</button>
                  </span>
                ) : (
                  <button className="hc-icon" onClick={() => setConfirmId(note.id)} aria-label="删除笔记">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              {note.quote && <blockquote className="nc-quote">{note.quote}</blockquote>}
              {editingId === note.id ? (
                <div className="nc-edit">
                  <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} autoFocus />
                  <div className="nc-edit-actions">
                    <button onClick={() => setEditingId(null)}>
                      <X size={12} /> 取消
                    </button>
                    <button className="save" onClick={() => void saveEdit(note)}>
                      <Check size={12} /> 保存
                    </button>
                  </div>
                </div>
              ) : (
                <p className="nc-text">{note.text}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
