import type { Annotation, Rect } from '../types';
import { normalizeText } from './utils';

export type TextSelection = {
  page: number;
  text: string;
  rects: Rect[];
  anchor: { x: number; y: number; top: number; bottom: number; left: number; right: number; width: number };
};

export function rectsFromRange(pageEl: HTMLElement, range: Range): Rect[] {
  const pageRect = pageEl.getBoundingClientRect();
  if (!pageRect.width || !pageRect.height) return [];
  const clientRects = [...range.getClientRects()].filter(
    (r) => r.width > 1 && r.height > 2 && r.bottom > pageRect.top && r.top < pageRect.bottom,
  );
  if (!clientRects.length) return [];
  type Box = { left: number; top: number; right: number; bottom: number };
  const lines: Box[] = [];
  for (const rect of clientRects) {
    const existing = lines.find(
      (line) => Math.abs(line.top - rect.top) < Math.max(4, rect.height * 0.35) && rect.left >= line.left - 2,
    );
    if (existing) {
      existing.left = Math.min(existing.left, rect.left);
      existing.right = Math.max(existing.right, rect.right);
      existing.top = Math.min(existing.top, rect.top);
      existing.bottom = Math.max(existing.bottom, rect.bottom);
    } else {
      lines.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
    }
  }
  return lines
    .map((r) => {
      const x = (r.left - pageRect.left) / pageRect.width;
      const y = (r.top - pageRect.top) / pageRect.height;
      const w = (r.right - r.left) / pageRect.width;
      const h = (r.bottom - r.top) / pageRect.height;
      const padX = 0.0015;
      const padY = 0.004;
      return {
        x: Math.max(0, x - padX),
        y: Math.max(0, y - padY),
        w: Math.min(1 - Math.max(0, x - padX), w + padX * 2),
        h: Math.min(1 - Math.max(0, y - padY), h + padY * 2),
      };
    })
    .filter((r) => r.w > 0.001 && r.h > 0.001);
}

export function selectionFromWindow(): TextSelection | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const text = normalizeText(sel.toString());
  if (text.length < 2) return null;
  const startEl =
    range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentElement
      : (range.startContainer as HTMLElement);
  const endEl =
    range.endContainer.nodeType === Node.TEXT_NODE
      ? range.endContainer.parentElement
      : (range.endContainer as HTMLElement);
  const pageEl = startEl?.closest<HTMLElement>('.pdf-page');
  const endPageEl = endEl?.closest<HTMLElement>('.pdf-page');
  if (!pageEl || !endPageEl || pageEl !== endPageEl) return null;
  const textLayer = pageEl.querySelector('.textLayer');
  if (!textLayer || !textLayer.contains(range.commonAncestorContainer)) {
    if (!textLayer || !startEl || !textLayer.contains(startEl)) return null;
  }
  const rects = rectsFromRange(pageEl, range);
  if (!rects.length) return null;
  const anchorRect = range.getBoundingClientRect();
  return {
    page: Number(pageEl.dataset.page),
    text: text.slice(0, 1200),
    rects,
    anchor: {
      x: anchorRect.left + anchorRect.width / 2,
      y: anchorRect.top,
      top: anchorRect.top,
      bottom: anchorRect.bottom,
      left: anchorRect.left,
      right: anchorRect.right,
      width: anchorRect.width,
    },
  };
}

function buildTextIndex(textLayer: HTMLElement) {
  const spans = [...textLayer.querySelectorAll<HTMLSpanElement>('span[role="presentation"]')].filter(
    (span) => (span.textContent ?? '').trim().length > 0,
  );
  let full = '';
  const positions: { span: HTMLSpanElement; start: number }[] = [];
  for (const span of spans) {
    positions.push({ span, start: full.length });
    full += span.textContent ?? '';
  }
  const map: number[] = [];
  let noSpace = '';
  for (let i = 0; i < full.length; i++) {
    const ch = full[i];
    if (/\s/.test(ch)) continue;
    noSpace += ch;
    map.push(i);
  }
  return { spans, positions, full, noSpace, map };
}

export function findQuoteRects(textLayer: HTMLElement, quote: string): Rect[] {
  const pageEl = textLayer.closest<HTMLElement>('.pdf-page');
  if (!pageEl) return [];
  const wanted = quote.replace(/\s+/g, '');
  if (wanted.length < 4) return [];
  const { positions, full, noSpace, map } = buildTextIndex(textLayer);
  if (!noSpace) return [];
  const candidates = [wanted, wanted.slice(0, 60), wanted.slice(0, 30)].filter((c) => c.length >= 4);
  let start = -1;
  let end = -1;
  for (const candidate of candidates) {
    const at = noSpace.indexOf(candidate);
    if (at === -1) continue;
    start = map[at];
    end = map[Math.min(map.length - 1, at + candidate.length - 1)] + 1;
    break;
  }
  if (start < 0 || end < 0) return [];
  const nodeAt = (offset: number) => {
    for (let i = positions.length - 1; i >= 0; i--) {
      if (positions[i].start <= offset) {
        const span = positions[i].span;
        const local = Math.min(span.textContent?.length ?? 0, offset - positions[i].start);
        return { node: span.firstChild as Node, offset: local };
      }
    }
    return null;
  };
  const startPos = nodeAt(start);
  const endPos = nodeAt(end);
  if (!startPos || !endPos) return [];
  try {
    const range = document.createRange();
    range.setStart(startPos.node, Math.max(0, startPos.offset));
    range.setEnd(endPos.node, Math.max(0, endPos.offset));
    if (range.collapsed) return [];
    const rects = rectsFromRange(pageEl, range);
    if (rects.length) return rects;
  } catch {
    // fall through
  }
  return [];
}

export function hitTest(annotations: Annotation[], page: number, point: { x: number; y: number }) {
  return annotations
    .filter((a) => a.page === page && a.rects.length > 0)
    .reverse()
    .find((a) =>
      a.rects.some(
        (r) =>
          point.x >= r.x - 0.004 &&
          point.x <= r.x + r.w + 0.004 &&
          point.y >= r.y - 0.006 &&
          point.y <= r.y + r.h + 0.006,
      ),
    );
}

export function annotationStyle(annotation: Annotation) {
  const colors: Record<Annotation['color'], string> = {
    amber: '#e3ad48',
    rose: '#d07a83',
    sage: '#8fa97b',
    sky: '#7fa2c4',
  };
  return { color: colors[annotation.color] };
}
