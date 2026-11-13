import { cn } from '../../lib/utils';

type Props = {
  x?: number;
  dragging?: boolean;
  onMoveStart?: (event: React.DragEvent<HTMLButtonElement>) => void;
  onMoveEnd?: () => void;
  movable?: boolean;
};

export function ShelfDecor({ x = 80, dragging = false, movable = true, onMoveStart, onMoveEnd }: Props) {
  return (
    <div
      className={cn('shelf-decor', dragging && 'decor-dragging')}
      style={{ left: `clamp(8px, ${x}%, calc(100% - 134px))`, right: 'auto' } as React.CSSProperties}
    >
      <div className="deco-stack" aria-hidden="true">
        <span className="deco-book b1" />
        <span className="deco-book b2" />
        <span className="deco-book b3" />
        <span className="deco-plant">
          <img src={`${import.meta.env.BASE_URL}decor/plant-ai.webp`} alt="" draggable={false} />
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
