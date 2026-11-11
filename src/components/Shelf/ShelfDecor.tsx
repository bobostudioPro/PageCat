export function ShelfDecor() {
  return (
    <div className="shelf-decor" aria-hidden="true">
      <div className="deco-stack">
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
    </div>
  );
}
