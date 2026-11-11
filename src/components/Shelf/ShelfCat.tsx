import { useToast } from '../../state/toast';

const quotes = [
  '猫说：读不下去的时候，就摸一摸书脊。',
  '猫说：划线是给未来的自己留面包屑。',
  '猫说：一本书不必读完，也可以被好好爱过。',
  '猫说：今天适合读一页，然后发呆。',
  '猫说：书架不是装饰，是还没拆开的远方。',
];

export function ShelfCat({ onShelf = true }: { onShelf?: boolean }) {
  const push = useToast((s) => s.push);
  return (
    <button
      className={`shelf-cat ${onShelf ? 'on-shelf' : ''}`}
      aria-label="摸一摸书架上的猫"
      title="摸一摸猫"
      onClick={() => push(quotes[Math.floor(Math.random() * quotes.length)])}
    >
      <svg viewBox="0 0 170 120" fill="none" aria-hidden="true">
        <ellipse cx="95" cy="111" rx="60" ry="6" fill="#0c0805" opacity="0.5" />
        {/* tail */}
        <path
          d="M56 101c-24 2-31-12-25-24 4-8 12-12 21-11"
          stroke="#43382f"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path d="M39 71c3-3 7-4 10-3" stroke="#8a7461" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
        {/* body loaf */}
        <path
          d="M48 104c-12-3-18-14-14-29 5-19 24-32 51-33l20-1c26-1 44 10 48 27 4 15-4 30-18 36H48Z"
          fill="#4a3f35"
        />
        <path d="M50 98c-5-8-5-18 0-27 7-12 21-20 38-22" stroke="#5c4f43" strokeWidth="5" strokeLinecap="round" opacity="0.5" />
        {/* stripes */}
        <path d="M66 74c-5 4-8 9-9 16M84 68c-4 5-6 11-6 18M102 66c-3 6-4 12-4 19" stroke="#352c25" strokeWidth="4.5" strokeLinecap="round" opacity="0.55" />
        {/* head */}
        <path d="M101 94c-9-7-13-20-8-30 4-9 14-14 25-13 14 1 24 12 24 25 0 15-12 25-25 24-6 0-11-2-16-6Z" fill="#4d4238" />
        {/* ears */}
        <path d="M110 62l-8-23 22 11-14 12Z" fill="#4d4238" />
        <path d="M141 58l11-19 6 24-17-5Z" fill="#4d4238" />
        <path d="M113 57l-3-11 10 6-7 5Z" fill="#a3766b" opacity="0.7" />
        <path d="M144 56l5-9 2 11-7-2Z" fill="#a3766b" opacity="0.7" />
        {/* face */}
        <ellipse cx="137" cy="86" rx="14" ry="9" fill="#6d5b4b" />
        <ellipse cx="127" cy="87" rx="5" ry="4" fill="#d8c4a8" />
        <ellipse cx="145" cy="88" rx="5" ry="4" fill="#d8c4a8" />
        <path d="M119 73c2.4 2.2 5.4 2.2 7.8 0M136 72c2.4 2.2 5.4 2.2 7.8 0" stroke="#2c241d" strokeWidth="2" strokeLinecap="round" />
        <path d="M133 82l3 2 3-2" stroke="#c58f7c" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M136 84v3M136 87c-2 1-3 2-5 2M136 87c2 1 3 2 5 2" stroke="#2c241d" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M127 86l-13 2M127 89l-12 5M146 86l12 2M146 89l11 5" stroke="#d8c4a8" strokeWidth="0.8" opacity="0.55" />
        {/* paws */}
        <ellipse cx="104" cy="105" rx="12" ry="5.5" fill="#d8c4a8" />
        <ellipse cx="123" cy="107" rx="10" ry="5" fill="#d8c4a8" />
        <path d="M99 103v5M104 102v6M109 103v5" stroke="#b09a7d" strokeWidth="0.9" strokeLinecap="round" />
        {/* little book */}
        <g transform="translate(34,99) rotate(-2)">
          <rect width="58" height="13" rx="2" fill="#74422c" />
          <rect x="3" y="2" width="52" height="3" fill="#aa7d51" opacity="0.55" />
          <rect x="3" y="8" width="52" height="4" fill="#e9d7b7" opacity="0.85" />
          <path d="M35 13v-13" stroke="#5b3323" strokeWidth="1" opacity="0.5" />
        </g>
      </svg>
      <span className="cat-zzz" aria-hidden="true">
        <i>z</i>
        <i>z</i>
      </span>
    </button>
  );
}
