import { useRef, useState } from 'react';

type Rect = { left: number; top: number; width: number; height: number };
type Props = {
  rect: Rect | null;
  theme: 'paper' | 'sepia' | 'night';
  disabled?: boolean;
  onTurn: () => void;
};

export function CornerPageTurn({ rect, theme, disabled, onTurn }: Props) {
  const [amount, setAmount] = useState(0);
  const [dragging, setDragging] = useState(false);
  const amountRef = useRef(0);
  const startRef = useRef({ x: 0, y: 0 });

  if (!rect || disabled) return null;
  const maxSize = Math.min(rect.width, rect.height);
  const flapSize = Math.round(amount * maxSize * 1.08);

  const begin = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    startRef.current = { x: event.clientX, y: event.clientY };
    amountRef.current = 0;
    setAmount(0);
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const move = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    const dx = Math.max(0, startRef.current.x - event.clientX);
    const dy = Math.max(0, startRef.current.y - event.clientY);
    const next = Math.min(1, Math.max(0, (dx + dy * 0.8) / Math.max(160, maxSize * 0.72)));
    amountRef.current = next;
    setAmount(next);
  };

  const end = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (amountRef.current >= 0.3) onTurn();
    amountRef.current = 0;
    setAmount(0);
  };

  return (
    <div
      className={`corner-turn theme-${theme} ${dragging ? 'is-dragging' : ''}`}
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
      aria-hidden={false}
    >
      {flapSize > 2 && <span className="corner-flap" style={{ width: flapSize, height: flapSize }} aria-hidden="true" />}
      <button
        className="corner-turn-handle"
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={(event) => {
          setDragging(false);
          amountRef.current = 0;
          setAmount(0);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        aria-label="按住右下角拖动翻页"
        title="按住右下角拖动翻页"
      />
    </div>
  );
}
