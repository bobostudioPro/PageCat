import { useEffect, useRef, useState } from 'react';
import { FileUp, Loader2, UploadCloud } from 'lucide-react';
import { Modal } from './Modal';
import { useLibrary } from '../../state/library';
import { formatBytes } from '../../lib/utils';

type Props = { open: boolean; onClose: () => void; initialFiles?: File[]; onConsumed?: () => void };

export function UploadDialog({ open, onClose, initialFiles, onConsumed }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const addBook = useLibrary((s) => s.addBook);
  const adding = useLibrary((s) => s.adding);
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState<{ name: string; size: number; status: 'waiting' | 'working' | 'done' | 'error' }[]>([]);
  const consumed = useRef(false);

  useEffect(() => {
    if (!open) {
      consumed.current = false;
      return;
    }
    if (!consumed.current && initialFiles?.length) {
      consumed.current = true;
      void handleFiles(initialFiles).finally(() => onConsumed?.());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFiles]);

  const handleFiles = async (files: FileList | File[]) => {
    const pdfs = [...files].filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!pdfs.length) return;
    setQueue(pdfs.map((f) => ({ name: f.name, size: f.size, status: 'waiting' })));
    let added = 0;
    for (let i = 0; i < pdfs.length; i++) {
      setQueue((q) => q.map((row, idx) => (idx === i ? { ...row, status: 'working' } : row)));
      const book = await addBook(pdfs[i]);
      if (book) added++;
      setQueue((q) => q.map((row, idx) => (idx === i ? { ...row, status: book ? 'done' : 'error' } : row)));
    }
    if (added) {
      window.setTimeout(() => {
        onClose();
        setQueue([]);
      }, 520);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!adding) onClose();
      }}
      title="把一本书放上书架"
      subtitle="PDF 只在你的浏览器里处理与保存，不会上传到任何服务器。"
    >
      <div
        className={`dropzone ${dragging ? 'dragging' : ''} ${adding ? 'busy' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !adding && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
      >
        <div className="dropzone-illustration">
          <span className="drop-book">
            <span />
            <span />
            <span />
          </span>
          <UploadCloud size={22} className="drop-cloud" />
        </div>
        {adding ? (
          <>
            <strong>正在整理书页…</strong>
            <p>读取目录、生成封面，比泡一杯茶稍慢一点。</p>
          </>
        ) : (
          <>
            <strong>拖入 PDF，或点击选择文件</strong>
            <p>支持多选。建议单个文件小于 80 MB。</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {queue.length > 0 && (
        <ul className="upload-queue">
          {queue.map((row) => (
            <li key={row.name}>
              <FileUp size={15} />
              <span className="queue-name">{row.name}</span>
              <span className="queue-size">{formatBytes(row.size)}</span>
              <span className={`queue-status ${row.status}`}>
                {row.status === 'working' && <Loader2 size={14} className="spin" />}
                {row.status === 'done' && '已上架'}
                {row.status === 'error' && '失败'}
                {row.status === 'waiting' && '等待'}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="upload-notes">
        <span>· 划线、笔记和阅读进度都会随书保存在本机</span>
        <span>· 换一台设备时，需要重新放入 PDF</span>
      </div>
    </Modal>
  );
}
