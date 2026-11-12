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
      style={{ left: `clamp(63px, ${x}%, calc(100% - 63px))`, right: 'auto' } as React.CSSProperties}
    >
      <div className="deco-stack" aria-hidden="true">
        <span className="deco-book b1" />
        <span className="deco-book b2" />
        <span className="deco-book b3" />
        <span className="deco-plant">
          <svg viewBox="0 0 70 90" fill="none">
            <path d="M35 52V25M35 38c-9-2-15-8-17-17 10 1 16 7 17 17ZM35 31c8-3 13-9 14-18-9 2-14 8-14 18ZM35 44c-7-1-12-5-14-12 8 0 13 5 14 12Z" stroke="#6f7a55" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M15 52h40l-5 30c-.4 2.5-2.5 4-5 4H25c-2.5 0-4.6-1.5-5-4l-5-30Z" fill="#a4613a" />
            <path d="M17 52h36l-2.5 8h-31L17 52Z" fill="#bb7a4b" />
            <path d="M20 66h30" stroke="#7d4127" strokeWidth="1" opacity=".5" />
            <path d="M23 80h24" stroke="#7d4127" strokeWidth="1" opacity=".35" />
          </svg>
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
