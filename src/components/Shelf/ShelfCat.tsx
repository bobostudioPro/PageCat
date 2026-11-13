import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

type CatMood = 'sleeping' | 'awake' | 'happy' | 'playing' | 'eating' | 'stretching';

const petLines = ['呼噜呼噜…', '再摸一下。', '这里很暖和。', '你的手上有书香。'];
const playLines = ['抓到你了！', '毛线球比书好玩。', '再来一次！'];
const feedLines = ['小鱼干！', '吃饱了才有力气读书。', '慢慢吃，不着急。'];
const idleLines = ['喵。', '今天读哪一本？', '一本书不必读完，也可以被好好爱过。', '要不要休息一下？'];

const heartSpots = [
  { x: -18, y: -24, d: 0 },
  { x: 8, y: -34, d: 0.12 },
  { x: 24, y: -18, d: 0.24 },
  { x: -4, y: -8, d: 0.36 },
  { x: 34, y: -32, d: 0.48 },
];

type Props = {
  dragActive?: boolean;
  x?: number;
  dragging?: boolean;
  onMoveStart?: (event: React.DragEvent<HTMLButtonElement>) => void;
  onMoveEnd?: () => void;
  movable?: boolean;
};

export function ShelfCat({ dragActive = false, x = 82, dragging = false, movable = true, onMoveStart, onMoveEnd }: Props) {
  const [mood, setMood] = useState<CatMood>('sleeping');
  const [bubble, setBubble] = useState<string | null>(null);
  const [hearts, setHearts] = useState(0);
  const [blinking, setBlinking] = useState(false);
  const [look, setLook] = useState({ x: 0, y: 0 });

  const actionTimer = useRef<number | null>(null);
  const bubbleTimer = useRef<number | null>(null);
  const sleepTimer = useRef<number | null>(null);
  const clickTimer = useRef<number | null>(null);
  const greeted = useRef(false);
  const moodRef = useRef<CatMood>('sleeping');
  const decorBase = `${import.meta.env.BASE_URL}decor/`;
  const catImage =
    mood === 'happy'
      ? 'cat-happy.webp'
      : mood === 'sleeping' || mood === 'eating' || blinking
        ? 'cat-sleepy.webp'
        : 'cat-awake.webp';

  const clear = (ref: React.MutableRefObject<number | null>) => {
    if (ref.current) {
      window.clearTimeout(ref.current);
      ref.current = null;
    }
  };

  const say = (text: string, duration = 2800) => {
    clear(bubbleTimer);
    setBubble(text);
    bubbleTimer.current = window.setTimeout(() => setBubble(null), duration);
  };

  const scheduleSleep = (delay = 10000) => {
    clear(sleepTimer);
    sleepTimer.current = window.setTimeout(() => {
      if (moodRef.current === 'awake') {
        setMood('sleeping');
        setBubble(null);
      }
    }, delay);
  };

  const setMoodSafe = (next: CatMood) => {
    moodRef.current = next;
    setMood(next);
  };

  const wake = (greet = false) => {
    clear(sleepTimer);
    if (moodRef.current === 'sleeping') setMoodSafe('awake');
    if (greet && !greeted.current) {
      greeted.current = true;
      say('喵，你回来啦。摸摸我，或推毛线球。', 3600);
    }
    scheduleSleep(14000);
  };

  const action = (next: CatMood, text: string, duration = 2100, heartsCount = true) => {
    clear(actionTimer);
    clear(sleepTimer);
    setMoodSafe(next);
    say(text, duration + 300);
    if (heartsCount) setHearts((n) => n + 1);
    actionTimer.current = window.setTimeout(() => {
      if (moodRef.current === next) setMoodSafe('awake');
      scheduleSleep(11000);
    }, duration);
  };

  const pet = () => {
    wake();
    action('happy', petLines[Math.floor(Math.random() * petLines.length)], 1900);
  };

  const play = () => {
    wake();
    action('playing', playLines[Math.floor(Math.random() * playLines.length)], 1900);
  };

  const feed = () => {
    wake();
    action('eating', feedLines[Math.floor(Math.random() * feedLines.length)], 2300);
  };

  const stretch = () => {
    wake();
    action('stretching', '伸个懒腰…', 1500, false);
  };

  const handleCatClick = () => {
    if (clickTimer.current) {
      clear(clickTimer);
      stretch();
      return;
    }
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      pet();
    }, 210);
  };

  const handleMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'touch') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 4;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 3;
    setLook({ x: Math.max(-2, Math.min(2, x)), y: Math.max(-1.5, Math.min(1.5, y)) });
  };

  useEffect(() => {
    if (dragActive) {
      wake();
      say('咦，又有新书？', 3200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragActive]);

  useEffect(() => {
    const blink = window.setInterval(() => {
      if (moodRef.current === 'awake' && !bubble) {
        setBlinking(true);
        window.setTimeout(() => setBlinking(false), 130);
      }
    }, 5200);
    return () => window.clearInterval(blink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bubble]);

  useEffect(() => {
    if (!window.matchMedia('(hover: none)').matches) return;
    const hint = window.setTimeout(() => {
      if (moodRef.current === 'sleeping') {
        wake();
        say('摸摸我，或推毛线球给我。', 3800);
      }
    }, 2800);
    return () => window.clearTimeout(hint);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const idle = window.setInterval(() => {
      if (moodRef.current === 'awake' && !bubble && !dragActive) {
        say(idleLines[Math.floor(Math.random() * idleLines.length)], 3200);
      }
    }, 26000);
    return () => window.clearInterval(idle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bubble, dragActive]);

  useEffect(() => {
    for (const name of ['cat-sleepy', 'cat-happy']) {
      const img = new Image();
      img.src = `${import.meta.env.BASE_URL}decor/${name}.webp`;
    }
  }, []);

  useEffect(() => {
    return () => {
      clear(actionTimer);
      clear(bubbleTimer);
      clear(sleepTimer);
      clear(clickTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={cn('shelf-cat', mood, blinking && 'blinking', dragActive && 'drag-alert', dragging && 'decor-dragging')}
      style={{ left: `clamp(8px, ${x}%, calc(100% - 232px))`, right: 'auto', '--look-x': `${look.x}px`, '--look-y': `${look.y}px` } as React.CSSProperties}
    >
      {bubble && (
        <div className="cat-bubble" role="status">
          {bubble}
          <span className="cat-bubble-tail" aria-hidden="true" />
        </div>
      )}

      <div className="cat-stage">
        <span className="cat-zzz" aria-hidden="true">
          <i>z</i>
          <i>z</i>
        </span>

        <button
          className="cat-pet"
        onMouseEnter={() => wake(true)}
        onMouseLeave={() => {
          setLook({ x: 0, y: 0 });
          scheduleSleep(7000);
        }}
        onFocus={() => wake(true)}
        onPointerMove={handleMove}
        onClick={handleCatClick}
        aria-label="摸摸书架上的猫；双击让它伸懒腰"
        title="摸摸猫 · 双击伸懒腰"
      >
        <img className="cat-figure" src={`${decorBase}${catImage}`} alt="" draggable={false} />
      </button>

      <button className="cat-toy" onClick={play} aria-label="把毛线球推给猫玩" title="陪猫玩毛线球">
        <img src={`${decorBase}cat-toy.webp`} alt="" draggable={false} />
      </button>

      <button className="cat-bowl" onClick={feed} aria-label="喂猫吃小鱼干" title="喂猫">
        <img src={`${decorBase}cat-bowl.webp`} alt="" draggable={false} />
      </button>

        <div className="cat-hearts" key={hearts} aria-hidden="true">
          {hearts > 0 && Array.from({ length: 5 }, (_, i) => (
            <span key={i} style={{ '--hx': `${heartSpots[i].x}px`, '--hy': `${heartSpots[i].y}px`, '--hd': `${heartSpots[i].d}s` } as React.CSSProperties}>
              ♥
            </span>
          ))}
        </div>
      </div>

      {movable && <button
        className="decor-grip cat-grip"
        draggable
        onDragStart={(event) => {
          event.stopPropagation();
          const root = event.currentTarget.closest('.shelf-cat') as HTMLElement | null;
          if (root) event.dataTransfer.setDragImage(root, 112, 80);
          onMoveStart?.(event);
        }}
        onDragEnd={() => onMoveEnd?.()}
        aria-label="拖动移动猫"
        title="拖动移动猫"
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
