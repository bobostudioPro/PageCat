import { cn } from '../../lib/utils';

export function CatMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path
        d="M14 48V26.5C14 18.5 20.5 12 28.5 12h7C43.5 12 50 18.5 50 26.5V48"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M21.5 48V30.4c0-4.2 3.4-7.6 7.6-7.6h5.8c4.2 0 7.6 3.4 7.6 7.6V48"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.62"
      />
      <path d="M25.5 34.5h1.8M36.7 34.5h1.8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M29.5 39.4c1.4 1 3.6 1 5 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 48h36" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={cn('brand', light && 'brand-light', className)}>
      <span className="brand-mark">
        <CatMark />
      </span>
      <span className="brand-word">
        <span className="brand-name">PageCat</span>
        <span className="brand-sub">数字书房</span>
      </span>
    </span>
  );
}
