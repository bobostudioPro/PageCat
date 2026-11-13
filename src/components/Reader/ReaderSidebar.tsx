import { Highlighter, Languages, ListTree, NotebookPen, Sparkles, X } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Annotation, Book, Note, OutlineItem } from '../../types';
import { OutlinePanel } from './OutlinePanel';
import { HighlightsPanel } from './HighlightsPanel';
import { NotesPanel } from './NotesPanel';
import { AIPanel, type ExternalReference } from '../AI/AIPanel';
import { TranslationPanel } from './TranslationPanel';

export type ReaderTab = 'toc' | 'highlights' | 'notes' | 'translate' | 'ai';

type Props = {
  book: Book;
  doc: PDFDocumentProxy;
  tab: ReaderTab;
  onTab: (tab: ReaderTab) => void;
  onClose: () => void;
  annotations: Annotation[];
  notes: Note[];
  toc: OutlineItem[];
  tocLoading?: boolean;
  currentPage: number;
  pageCount: number;
  percent: number;
  focusNote: number;
  aiExternal?: ExternalReference | null;
  onJump: (page: number, annotationId?: string) => void;
  onJumpPanel: (page: number) => void;
  onJumpSection: (page: number, title?: string) => void;
  onFavorite: (annotation: Annotation, value: boolean) => void;
  onRemoveAnnotation: (annotation: Annotation) => void;
  onAddNote: (text: string) => Promise<void>;
  onUpdateNote: (note: Note, text: string) => Promise<void>;
  onRemoveNote: (note: Note) => void;
  onOpenSettings: () => void;
  onConsumeAiExternal: () => void;
  onAskHighlight: (annotation: Annotation) => void;
  onAskNote: (note: Note) => void;
};

export function ReaderSidebar(props: Props) {
  const { tab, onTab } = props;
  const tabs: { key: ReaderTab; label: string; icon: typeof ListTree; count?: number }[] = [
    { key: 'toc', label: '目录', icon: ListTree },
    { key: 'highlights', label: '划线', icon: Highlighter, count: props.annotations.length },
    { key: 'notes', label: '笔记', icon: NotebookPen, count: props.notes.length },
    { key: 'translate', label: '翻译', icon: Languages },
    { key: 'ai', label: 'AI', icon: Sparkles },
  ];

  return (
    <aside className={`reader-sidebar ${tab === 'ai' ? 'ai-open' : ''} ${tab === 'translate' ? 'translate-open' : ''}`}>
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
            tocLoading={props.tocLoading}
            currentPage={props.currentPage}
            pageCount={props.pageCount}
            percent={props.percent}
            onJump={props.onJumpSection}
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
            onAsk={props.onAskHighlight}
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
            onAsk={props.onAskNote}
          />
        )}
        {tab === 'translate' && (
          <TranslationPanel
            book={props.book}
            doc={props.doc}
            page={props.currentPage}
            pageCount={props.pageCount}
            onJump={props.onJumpPanel}
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
            externalReference={props.aiExternal}
            onConsumeExternal={props.onConsumeAiExternal}
            onJump={props.onJump}
            onOpenSettings={props.onOpenSettings}
          />
        )}
      </div>

      {tab !== 'ai' && tab !== 'translate' && (
        <div className="sidebar-foot">
          <span>← → 翻页</span>
          <span>选中文字即可划线</span>
          <span>Esc 关闭浮层</span>
        </div>
      )}
    </aside>
  );
}
