/** 사이트 로고 (상승 꺾은선). */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="brand__mark" width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <rect x="1" y="1" width="26" height="26" rx="7" fill="var(--accent)" />
      <path
        d="M7 18 L12 13 L15.5 16.5 L21 10"
        fill="none"
        stroke="var(--accent-ink)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
