import { createPortal } from 'react-dom';

export type PageTurnState = {
  id: number;
  direction: 'next' | 'prev';
  rect: { left: number; top: number; width: number; height: number };
  image?: string;
};

export function PageTurnEffect({ turn, theme }: { turn: PageTurnState | null; theme: 'paper' | 'sepia' | 'night' }) {
  if (!turn) return null;
  return createPortal(
    <div
      className={`page-turn ${turn.direction} theme-${theme}`}
      style={{ left: turn.rect.left, top: turn.rect.top, width: turn.rect.width, height: turn.rect.height }}
      aria-hidden="true"
    >
      <span className="page-turn-shade" />
      <span className="page-turn-face">
        <span className="page-turn-front">
          {turn.image && <span className="page-turn-page-image" style={{ backgroundImage: `url("${turn.image}")` }} />}
          <span className="page-turn-grain" />
        </span>
        <span className="page-turn-back">
          <span className="page-turn-grain" />
        </span>
      </span>
    </div>,
    document.body,
  );
}
