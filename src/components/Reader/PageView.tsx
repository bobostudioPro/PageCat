import { useEffect, useRef, useState, type RefObject } from 'react';
import { TextLayer, type PDFDocumentProxy } from 'pdfjs-dist';
import type { Annotation } from '../../types';
import { annotationStyle, findQuoteRects } from '../../lib/selection';

type Props = {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  baseWidth: number;
  baseHeight: number;
  annotations: Annotation[];
  activeId?: string;
  flashId?: string;
  scrollRoot: RefObject<HTMLDivElement | null>;
  onRectsResolved: (id: string, rects: Annotation['rects']) => void;
  onRendered?: (page: number) => void;
};

export function PageView({
  doc,
  pageNumber,
  scale,
  baseWidth,
  baseHeight,
  annotations,
  activeId,
  flashId,
  scrollRoot,
  onRectsResolved,
  onRendered,
}: Props) {
  const blockRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const textHostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(pageNumber <= 2);
  const [size, setSize] = useState({ w: baseWidth * scale, h: baseHeight * scale });
  const [textLayerEl, setTextLayerEl] = useState<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const generation = useRef(0);
  const taskRef = useRef<{ cancel: () => void } | null>(null);
  const textLayerRef = useRef<TextLayer | null>(null);
  const triedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const el = blockRef.current;
    if (!el) return;
    const root = scrollRoot.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      { root: root ?? null, rootMargin: '1800px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRoot]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const gen = ++generation.current;
    setStatus('loading');
    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled || gen !== generation.current) return;
        const viewport = page.getViewport({ scale });
        setSize({ w: viewport.width, h: viewport.height });
        const host = pageRef.current;
        const canvasHost = canvasHostRef.current;
        const textHost = textHostRef.current;
        if (!host || !canvasHost || !textHost) return;
        host.style.width = `${viewport.width}px`;
        host.style.height = `${viewport.height}px`;
        host.style.setProperty('--total-scale-factor', String(scale));
        host.style.setProperty('--scale-round-x', '1px');
        host.style.setProperty('--scale-round-y', '1px');

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-canvas';
        canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
        canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvasHost.replaceChildren(canvas);
        textHost.replaceChildren();
        setTextLayerEl(null);

        const task = page.render({
          canvas,
          viewport,
          transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
          background: '#ffffff',
        });
        task.promise.catch(() => {
          // cancellation is expected while zooming or leaving the page
        });
        taskRef.current = task;

        const textContent = await page.getTextContent();
        if (cancelled || gen !== generation.current) return;
        const layer = new TextLayer({
          textContentSource: textContent,
          container: textHost,
          viewport,
        });
        textLayerRef.current = layer;
        textHost.classList.add('textLayer');
        textHost.style.width = `${viewport.width}px`;
        textHost.style.height = `${viewport.height}px`;
        await layer.render();
        if (cancelled || gen !== generation.current) {
          layer.cancel();
          return;
        }
        await task.promise;
        if (cancelled || gen !== generation.current) return;
        setStatus('ready');
        setTextLayerEl(textHost);
        onRendered?.(pageNumber);
      } catch (err) {
        if ((err as Error)?.name === 'RenderingCancelledException') return;
        if (!cancelled) {
          console.error('page render failed', pageNumber, err);
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        taskRef.current?.cancel();
      } catch {
        // ignore
      }
      try {
        textLayerRef.current?.cancel();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, pageNumber, scale, visible]);

  useEffect(() => {
    if (!textLayerEl) return;
    triedRef.current = new Set();
    const unresolved = annotations.filter((a) => a.page === pageNumber && a.rects.length === 0);
    for (const annotation of unresolved) {
      if (triedRef.current.has(annotation.id)) continue;
      triedRef.current.add(annotation.id);
      const rects = findQuoteRects(textLayerEl, annotation.quote);
      if (rects.length) onRectsResolved(annotation.id, rects);
    }
  }, [textLayerEl, annotations, pageNumber, onRectsResolved]);

  const pageAnnotations = annotations.filter((a) => a.page === pageNumber);

  return (
    <div className="page-block" data-page={pageNumber} ref={blockRef}>
      <div className="page-shadow" />
      <div
        className={`pdf-page ${status === 'loading' ? 'is-loading' : ''}`}
        ref={pageRef}
        style={{ width: size.w, height: size.h }}
        data-page={pageNumber}
      >
        <div className="canvas-wrapper" ref={canvasHostRef} />
        <div className="textLayer" ref={textHostRef} />
        <div className="annotation-layer" aria-hidden="true">
          {pageAnnotations.map((annotation) => {
            const color = annotationStyle(annotation).color;
            return annotation.rects.map((rect, index) => (
              <span
                key={`${annotation.id}-${index}`}
                className={[
                  'hl',
                  annotation.style === 'underline' ? 'hl-underline' : 'hl-marker',
                  activeId === annotation.id ? 'active' : '',
                  flashId === annotation.id ? 'flash' : '',
                ].join(' ')}
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.w * 100}%`,
                  height: `${rect.h * 100}%`,
                  ['--hl-color' as string]: color,
                }}
              />
            ));
          })}
          {pageAnnotations
            .filter((a) => a.noteId)
            .map((annotation) => {
              const rect = annotation.rects[0];
              if (!rect) return null;
              return (
                <span
                  key={`dot-${annotation.id}`}
                  className="note-dot"
                  style={{
                    left: `${Math.min(98, (rect.x + rect.w) * 100 + 0.3)}%`,
                    top: `${rect.y * 100}%`,
                    background: annotationStyle(annotation).color,
                  }}
                />
              );
            })}
        </div>
        {status === 'loading' && (
          <div className="page-loading">
            <span />
            <span />
            <span />
          </div>
        )}
        {status === 'error' && <div className="page-error">这一页没有渲染出来</div>}
      </div>
      <div className="page-folio">
        <span>{pageNumber}</span>
      </div>
    </div>
  );
}
