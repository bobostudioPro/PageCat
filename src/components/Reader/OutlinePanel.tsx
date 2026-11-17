import { BookMarked, ChevronRight } from 'lucide-react';
import type { OutlineItem } from '../../types';

type Props = {
  toc: OutlineItem[];
  tocLoading?: boolean;
  currentPage: number;
  pageCount: number;
  percent: number;
  onJump: (page: number, title?: string) => void;
};

export function OutlinePanel({ toc, tocLoading = false, currentPage, pageCount, percent, onJump }: Props) {
  return (
    <div className="outline-panel">
      <div className="reader-progress-card">
        <div className="rpc-top">
          <span>阅读进度</span>
          <strong>{Math.round(percent * 100)}%</strong>
        </div>
        <div className="rpc-bar">
          <span style={{ width: `${Math.max(2, percent * 100)}%` }} />
        </div>
        <div className="rpc-bottom">
          <span>第 {currentPage} 页</span>
          <span>共 {pageCount} 页</span>
        </div>
      </div>

      {tocLoading ? (
        <div className="outline-skeleton" aria-label="正在加载目录">
          <div className="outline-skeleton-label" />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={`outline-skeleton-row lvl-${i % 3}`}>
              <span />
              <span />
            </div>
          ))}
        </div>
      ) : toc.length > 0 ? (
        <div className="outline-list">
          <div className="panel-section-label">
            <BookMarked size={12} /> 目录
          </div>
          {toc.map((item, i) => {
            const active = currentPage === item.page;
            const near = Math.abs(currentPage - item.page) <= 2;
            return (
              <button
                key={`${item.title}-${i}`}
                className={`outline-item lvl-${item.level} ${active ? 'active' : ''} ${near && !active ? 'near' : ''}`}
                onClick={() => onJump(item.page, item.title)}
              >
                <span className="outline-page">{String(item.page).padStart(2, '0')}</span>
                <span className="outline-title">{item.title}</span>
                <ChevronRight size={12} className="outline-arrow" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="outline-empty">
          <p>这份 PDF 没有目录。</p>
          <div className="page-grid">
            {Array.from({ length: Math.min(pageCount, 48) }, (_, i) => i + 1).map((page) => (
              <button key={page} className={currentPage === page ? 'active' : ''} onClick={() => onJump(page)}>
                {page}
              </button>
            ))}
          </div>
          {pageCount > 48 && <span className="outline-note">共 {pageCount} 页，可在顶部输入页码跳转。</span>}
        </div>
      )}
    </div>
  );
}
