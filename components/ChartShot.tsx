/** TradingView 캡처 한 장 — 누르면 원본을 새 탭에서 연다 (폰에서 손가락으로 확대). 없으면 안내 상자. */
export function ChartShot({ src, alt }: { src: string | undefined; alt: string }) {
  if (!src) return <div className="shot-missing">오늘 캡처된 차트가 없어요</div>;
  return (
    <a className="shot" href={src} target="_blank" rel="noopener noreferrer" aria-label={`${alt} — 원본 크기로 새 탭에서 열기`}
      style={{ cursor: "zoom-in" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- GitHub raw 이미지를 그대로 쓴다 */}
      <img src={src} alt={alt} loading="lazy" decoding="async" />
    </a>
  );
}
