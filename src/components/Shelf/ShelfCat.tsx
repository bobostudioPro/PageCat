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
        <svg className="cat-figure" viewBox="0 0 160 150" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="catFur" x1="60" y1="50" x2="110" y2="135" gradientUnits="userSpaceOnUse">
              <stop stopColor="#5b4e43" />
              <stop offset=".55" stopColor="#4a3f35" />
              <stop offset="1" stopColor="#3d332b" />
            </linearGradient>
            <linearGradient id="catFurLight" x1="70" y1="42" x2="118" y2="95" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6a5a4c" />
              <stop offset="1" stopColor="#4c4137" />
            </linearGradient>
            <linearGradient id="catCream" x1="75" y1="80" x2="105" y2="138" gradientUnits="userSpaceOnUse">
              <stop stopColor="#e1ceb1" />
              <stop offset="1" stopColor="#c9b18f" />
            </linearGradient>
            <radialGradient id="catEye" cx="0" cy="0" r="1" gradientTransform="translate(78 66) rotate(90) scale(9 6)" gradientUnits="userSpaceOnUse">
              <stop stopColor="#efc46e" />
              <stop offset=".6" stopColor="#c8923e" />
              <stop offset="1" stopColor="#8e5d21" />
            </radialGradient>
            <linearGradient id="catCushion" x1="30" y1="130" x2="130" y2="146" gradientUnits="userSpaceOnUse">
              <stop stopColor="#945157" />
              <stop offset=".55" stopColor="#743d43" />
              <stop offset="1" stopColor="#522a30" />
            </linearGradient>
          </defs>

          <ellipse cx="82" cy="143" rx="63" ry="7" fill="#0a0604" opacity=".4" />
          <g className="cat-cushion">
            <path d="M20 134c0-5 4-8 9-8h108c5 0 9 3 9 8s-4 8-9 8H29c-5 0-9-3-9-8Z" fill="url(#catCushion)" />
            <path d="M24 130c16-6 46-8 71-6 18 1 29 4 35 8" stroke="#c88b7c" strokeWidth="1.4" opacity=".55" />
            <path d="M27 129h112M30 140h104" stroke="#d0a477" strokeWidth="1" opacity=".7" />
            <path d="M22 134v7M30 136v6M142 134v7M135 136v6" stroke="#d8b37c" strokeWidth="1.1" opacity=".6" />
            <circle cx="20" cy="138" r="2.2" fill="#d0a477" opacity=".8" />
            <circle cx="146" cy="138" r="2.2" fill="#d0a477" opacity=".8" />
          </g>

          <g className="cat-body">
            <path d="M33 128c-9-6-13-19-8-33 5-18 22-30 46-32 25-2 45 6 53 21 7 14 5 29-4 37-8 7-18 10-34 10H53c-8 0-14-1-20-3Z" fill="url(#catFur)" />
            <path d="M42 88c7-4 14-6 21-7M37 104c7-4 14-6 21-7M36 119c7-3 14-4 21-4" stroke="#332a23" strokeWidth="4" strokeLinecap="round" opacity=".55" />
            <path d="M120 88c-5-4-11-6-17-7M124 104c-5-4-11-6-17-7" stroke="#332a23" strokeWidth="4" strokeLinecap="round" opacity=".38" />
            <path d="M58 125c-2-13 6-22 19-22 13 0 21 9 19 23-6 3-12 4-19 4s-14-2-19-5Z" fill="url(#catCream)" opacity=".9" />
          </g>

          <g className="cat-tail">
            <path d="M44 127c-20 2-31-10-27-23 3-9 10-14 19-13" stroke="#3e332b" strokeWidth="12" strokeLinecap="round" />
            <path d="M28 92c4-2 8-2 11 0" stroke="#c9b18f" strokeWidth="4.5" strokeLinecap="round" opacity=".85" />
          </g>

          <g className="cat-head">
            <g className="cat-ear cat-ear-left">
              <path d="M63 50 57 18c-1-3 2-5 5-3l22 18Z" fill="url(#catFurLight)" />
              <path d="M64 45 61 25l13 11Z" fill="#b87970" />
            </g>
            <g className="cat-ear cat-ear-right">
              <path d="M119 50l7-32c1-3-2-5-5-3L99 36Z" fill="url(#catFurLight)" />
              <path d="M121 45l4-20-13 11Z" fill="#b87970" />
            </g>
            <ellipse cx="91" cy="68" rx="34" ry="29" fill="url(#catFurLight)" />
            <path d="M81 45l2 11M91 43v12M101 45l-2 11" stroke="#3a2f27" strokeWidth="3" strokeLinecap="round" opacity=".5" />
            <ellipse cx="91" cy="87" rx="20" ry="11" fill="url(#catCream)" />
            <g className="cat-eyes cat-eyes-open">
              <ellipse cx="79" cy="68" rx="8" ry="9" fill="#241e18" />
              <ellipse cx="104" cy="68" rx="8" ry="9" fill="#241e18" />
              <g className="cat-pupils">
                <ellipse cx="79" cy="68" rx="5.5" ry="8" fill="url(#catEye)" />
                <ellipse cx="104" cy="68" rx="5.5" ry="8" fill="url(#catEye)" />
                <ellipse cx="79" cy="68" rx="2" ry="6" fill="#18130f" />
                <ellipse cx="104" cy="68" rx="2" ry="6" fill="#18130f" />
                <circle cx="81" cy="65" r="1.8" fill="#fff8e8" opacity=".8" />
                <circle cx="106" cy="65" r="1.8" fill="#fff8e8" opacity=".8" />
              </g>
            </g>
            <g className="cat-eyes cat-eyes-closed">
              <path d="M70 69c4 4 10 4 14 0M97 69c4 4 10 4 14 0" stroke="#2c241d" strokeWidth="2.2" strokeLinecap="round" />
            </g>
            <g className="cat-eyes cat-eyes-happy">
              <path d="M70 70c4-5 10-5 14 0M97 70c4-5 10-5 14 0" stroke="#2c241d" strokeWidth="2.2" strokeLinecap="round" />
            </g>
            <path d="M87 80h8l-4 4-4-4Z" fill="#c58f7c" />
            <path d="M91 84v4M91 88c-3 2-6 2-8 0M91 88c3 2 6 2 8 0" stroke="#4b3a2c" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M69 84l-18 4M69 89l-17 7M113 84l18 4M113 89l17 7" stroke="#e1ceb1" strokeWidth=".9" strokeLinecap="round" opacity=".6" />
            <path d="M64 96c7 6 47 6 54 0" stroke="#8a3b2f" strokeWidth="5" strokeLinecap="round" />
            <circle cx="91" cy="103" r="5.2" fill="#d3ad6e" stroke="#8f6a3c" strokeWidth="1" />
            <path d="M88 102c0-1.5 1.5-2.5 3-2.5s3 1 3 2.5c0 1.5-2 2.5-3 3.5-1-1-3-2-3-3.5Z" fill="#4b3324" opacity=".7" />
          </g>

          <g className="cat-paws">
            <ellipse cx="68" cy="130" rx="15" ry="7" fill="#d9c6a8" />
            <ellipse cx="99" cy="131" rx="15" ry="7" fill="#d9c6a8" />
            <path d="M61 128v4M67 127v5M73 128v4M92 129v4M98 128v5M104 129v4" stroke="#b69d7d" strokeWidth=".9" strokeLinecap="round" />
          </g>

          <path d="M50 62c7-16 22-25 39-25" stroke="#7b6858" strokeWidth="1.2" strokeLinecap="round" opacity=".45" />
        </svg>
      </button>

      <button className="cat-toy" onClick={play} aria-label="把毛线球推给猫玩" title="陪猫玩毛线球">
        <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <circle cx="24" cy="26" r="16" fill="#a65c5c" />
          <circle cx="24" cy="26" r="16" stroke="#7e3f42" strokeWidth="1" />
          <path d="M11 22c7-6 19-7 26-1M9 29c8 7 21 8 30 1M17 13c5 6 8 15 6 26M30 13c-5 7-6 16-2 26" stroke="#d9a09c" strokeWidth="1.2" opacity=".8" />
          <path d="M38 37c6 2 7 6 3 8-3 1-8-2-10-5" stroke="#a65c5c" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>

      <button className="cat-bowl" onClick={feed} aria-label="喂猫吃小鱼干" title="喂猫">
        <svg viewBox="0 0 54 44" fill="none" aria-hidden="true">
          <ellipse cx="27" cy="38" rx="22" ry="3.5" fill="#0a0604" opacity=".35" />
          <path d="M8 23h38l-4 12c-.5 2-2 3-4 3H16c-2 0-3.5-1-4-3L8 23Z" fill="#b98058" />
          <path d="M8 23h38l-1.5 5H9.5L8 23Z" fill="#d19d70" />
          <path d="M15 34h24" stroke="#8e5f3d" strokeWidth="1" opacity=".6" />
          <g className="cat-fish">
            <path d="M22 23c2-5 10-6 14-2 3 3 2 5-1 5H24c-2 0-3-1-2-3Z" fill="#8aa0a8" />
            <path d="M22 23l-6-4v8l6-4Z" fill="#8aa0a8" />
            <circle cx="32" cy="22" r="1" fill="#2b2118" />
          </g>
          <g className="cat-crumbs">
            <circle cx="20" cy="19" r="1.2" fill="#d6b483" />
            <circle cx="37" cy="16" r="1" fill="#d6b483" />
          </g>
        </svg>
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
