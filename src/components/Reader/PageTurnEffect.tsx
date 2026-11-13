import { createPortal } from 'react-dom';

export type PageTurnState = {
  id: number;
  direction: 'next' | 'prev';
  rect: { left: number; top: number; width: number; height: number };
  image?: string;
  nextImage?: string;
  samePage?: boolean;
};

export function PageTurnEffect({ turn, theme }: { turn: PageTurnState | null; theme: 'paper' | 'sepia' | 'night' }) {
  if (!turn) return null;
  if (turn.samePage) {
    return createPortal(
      <div
        className={`page-turn same theme-${theme}`}
        style={{ left: turn.rect.left, top: turn.rect.top, width: turn.rect.width, height: turn.rect.height }}
        aria-hidden="true"
      >
        <span className="page-turn-sweep">
          <span className="page-turn-sweep-leaf" />
        </span>
      </div>,
      document.body,
    );
  }
  return createPortal(
    <div
      className={`page-turn ${turn.direction} theme-${theme}`}
      style={{ left: turn.rect.left, top: turn.rect.top, width: turn.rect.width, height: turn.rect.height }}
      aria-hidden="true"
    >
      <span className="page-turn-next" style={turn.nextImage ? { backgroundImage: `url("${turn.nextImage}")` } : undefined} />
      <span className="page-turn-face">
        <span className="page-turn-front" style={turn.image ? { backgroundImage: `url("${turn.image}")` } : undefined}>
          <span className="page-turn-grain" />
        </span>
        <span className="page-turn-back">
          <span className="page-turn-grain" />
        </span>
      </span>
      <span className="page-turn-shade" />
    </div>,
    document.body,
  );
}
