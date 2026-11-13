import { useEffect, useRef, useState } from 'react';
import { Bug, Droplets, Leaf } from 'lucide-react';
import { cn } from '../../lib/utils';

type Props = {
  x?: number;
  dragging?: boolean;
  onMoveStart?: (event: React.DragEvent<HTMLButtonElement>) => void;
  onMoveEnd?: () => void;
  movable?: boolean;
};

type Care = 'water' | 'fertilize' | 'pest';

const CARE_COPY: Record<Care, string> = {
  water: '喝饱了，叶子亮亮的。',
  fertilize: '加点养分，慢慢长。',
  pest: '小虫子走开了。',
};

export function ShelfDecor({ x = 80, dragging = false, movable = true, onMoveStart, onMoveEnd }: Props) {
  const [care, setCare] = useState<Care | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const bubbleTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current);
    };
  }, []);

  const act = (kind: Care) => {
    if (timer.current) window.clearTimeout(timer.current);
    if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current);
    setCare(kind);
    setMessage(CARE_COPY[kind]);
    timer.current = window.setTimeout(() => setCare(null), 1600);
    bubbleTimer.current = window.setTimeout(() => setMessage(null), 2800);
  };

  return (
    <div
      className={cn('shelf-decor', dragging && 'decor-dragging', care && `care-${care}`)}
      style={{ left: `clamp(8px, ${x}%, calc(100% - 134px))`, right: 'auto' } as React.CSSProperties}
    >
      {message && (
        <div className="plant-bubble" role="status">
          {message}
          <span className="plant-bubble-tail" aria-hidden="true" />
        </div>
      )}

      <div className="plant-care" role="group" aria-label="照看盆栽">
        <button onClick={() => act('water')} title="浇水" aria-label="给盆栽浇水">
          <Droplets size={12} />
        </button>
        <button onClick={() => act('fertilize')} title="施肥" aria-label="给盆栽施肥">
          <Leaf size={12} />
        </button>
        <button onClick={() => act('pest')} title="驱虫" aria-label="给盆栽驱虫">
          <Bug size={12} />
        </button>
      </div>

      <div className="deco-stack" aria-hidden="true">
        <span className="deco-book b1" />
        <span className="deco-book b2" />
        <span className="deco-book b3" />
        <span className="deco-plant">
          <img src={`${import.meta.env.BASE_URL}decor/plant-ai.webp`} alt="" draggable={false} />
          {care && (
            <span className={`plant-vfx ${care}`} aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties} />)}
            </span>
          )}
        </span>
      </div>

      {movable && <button
        className="decor-grip plant-grip"
        draggable
        onDragStart={(event) => {
          event.stopPropagation();
          const root = event.currentTarget.closest('.shelf-decor') as HTMLElement | null;
          if (root) event.dataTransfer.setDragImage(root, 62, 50);
          onMoveStart?.(event);
        }}
        onDragEnd={() => onMoveEnd?.()}
        aria-label="拖动移动盆栽"
        title="拖动移动盆栽"
      >
        <span className="grip-dots" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      </button>}
    </div>
  );
}
