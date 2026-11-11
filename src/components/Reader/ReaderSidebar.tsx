import { Highlighter, ListTree, NotebookPen, Sparkles, X } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Annotation, Book, Note, OutlineItem } from '../../types';
import { OutlinePanel } from './OutlinePanel';
import { HighlightsPanel } from './HighlightsPanel';
import { NotesPanel } from './NotesPanel';
import { AIPanel } from '../AI/AIPanel';

export type ReaderTab = 'toc' | 'highlights' | 'notes' | 'ai';

type Props = {
  book: Book;
  doc: PDFDocumentProxy;
  tab: ReaderTab;
  onTab: (tab: ReaderTab) => void;
  onClose: () => void;
  annotations: Annotation[];
  notes: Note[];
  toc: OutlineItem[];
  currentPage: number;
  pageCount: number;
  percent: number;
  focusNote: number;
  aiSelection?: string;
  onJump: (page: number, annotationId?: string) => void;
  onFavorite: (annotation: Annotation, value: boolean) => void;
  onRemoveAnnotation: (annotation: Annotation) => void;
  onAddNote: (text: string) => Promise<void>;
  onUpdateNote: (note: Note, text: string) => Promise<void>;
  onRemoveNote: (note: Note) => void;
  onOpenSettings: () => void;
  onClearAiSelection: () => void;
};

export function ReaderSidebar(props: Props) {
  const { tab, onTab } = props;
  const tabs: { key: ReaderTab; label: string; icon: typeof ListTree; count?: number }[] = [
    { key: 'toc', label: '目录', icon: ListTree },
    { key: 'highlights', label: '划线', icon: Highlighter, count: props.annotations.length },
    { key: 'notes', label: '笔记', icon: NotebookPen, count: props.notes.length },
    { key: 'ai', label: 'AI', icon: Sparkles },
  ];

  return (
    <aside className={`reader-sidebar ${tab === 'ai' ? 'ai-open' : ''}`}>
      <div className="sidebar-tabs">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button key={key} className={`sidebar-tab ${tab === key ? 'active' : ''} ${key === 'ai' ? 'ai-tab' : ''}`} onClick={() => onTab(key)}>
            <Icon size={14} />
            <span>{label}</span>
            {count ? <em>{count}</em> : null}
          </button>
        ))}
        <button className="sidebar-close" onClick={props.onClose} aria-label="收起侧栏">
          <X size={15} />
        </button>
      </div>

      <div className="sidebar-body">
        {tab === 'toc' && (
          <OutlinePanel
            toc={props.toc}
            currentPage={props.currentPage}
            pageCount={props.pageCount}
            percent={props.percent}
            onJump={props.onJump}
          />
        )}
        {tab === 'highlights' && (
          <HighlightsPanel
            annotations={props.annotations}
            notes={props.notes}
            currentPage={props.currentPage}
            onJump={props.onJump}
            onFavorite={props.onFavorite}
            onRemove={props.onRemoveAnnotation}
          />
        )}
        {tab === 'notes' && (
          <NotesPanel
            notes={props.notes}
            currentPage={props.currentPage}
            focusSignal={props.focusNote}
            onJump={props.onJump}
            onAdd={props.onAddNote}
            onUpdate={props.onUpdateNote}
            onRemove={props.onRemoveNote}
          />
        )}
        {tab === 'ai' && (
          <AIPanel
            book={props.book}
            doc={props.doc}
            page={props.currentPage}
            pageCount={props.pageCount}
            annotations={props.annotations}
            notes={props.notes}
            toc={props.toc}
            selection={props.aiSelection}
            onClearSelection={props.onClearAiSelection}
            onJump={props.onJump}
            onOpenSettings={props.onOpenSettings}
          />
        )}
      </div>

      {tab !== 'ai' && (
        <div className="sidebar-foot">
          <span>← → 翻页</span>
          <span>选中文字即可划线</span>
          <span>Esc 关闭浮层</span>
        </div>
      )}
    </aside>
  );
}
