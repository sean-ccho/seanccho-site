/**
 * 작은 선 그림 (글자 크기·색을 따라간다) — 이모지(📅 🔥 ⭐ 🔴…) 대신 (2026-11-02).
 * 이모지는 OS·브라우저마다 모양과 색이 달라서 화면이 가벼워 보였다. 늘 aria-hidden — 뜻은 옆 글자가 전한다.
 */
export type IconName =
  | "calendar" | "flame" | "star" | "trend" | "hash" | "search" | "home" | "grid" | "bars" | "wallet"
  // 빠른 보기 카드 (2026-11-10)
  | "bolt" | "shield" | "users" | "peak" | "rebound" | "bookmark" | "x"
  // 예측 모델 (2026-11-12)
  | "database" | "check-badge" | "scale" | "pin" | "compare" | "doc" | "user" | "user-star" | "alert" | "history";

const PATHS: Record<IconName, React.ReactNode> = {
  database: (
    <>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.5" />
      <path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5" />
    </>
  ),
  "check-badge": (
    <path d="M12 2.5l2.3 1.7 2.8-.1.9 2.7 2.3 1.6-.9 2.7.9 2.7-2.3 1.6-.9 2.7-2.8-.1L12 21.5l-2.3-1.7-2.8.1-.9-2.7-2.3-1.6.9-2.7-.9-2.7 2.3-1.6.9-2.7 2.8.1zM8.5 12l2.3 2.3 4.7-4.6" />
  ),
  scale: <path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z" />,
  pin: <path d="M9 3h6l-1 6 3 3v2H7v-2l3-3zM12 14v7" />,
  compare: <path d="M7 4 3 8l4 4M3 8h13M17 12l4 4-4 4M21 16H8" />,
  doc: <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M8.5 13h7M8.5 17h7M8.5 9h2" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
    </>
  ),
  "user-star": (
    <>
      <circle cx="10" cy="8" r="4" />
      <path d="M2.5 21c0-4 3.4-6.5 7.5-6.5 1.2 0 2.3.2 3.3.6M18 13.5l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" />
    </>
  ),
  alert: <path d="M12 3 2 20h20zM12 10v4.5M12 17.5h.01" />,
  history: <path d="M3 12a9 9 0 1 0 2.6-6.4L3 8M3 3v5h5M12 7.5V12l3 2" />,
  calendar: <path d="M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />,
  flame: (
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  ),
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  trend: <path d="M22 7l-8.5 8.5-5-5L2 17M16 7h6v6" />,
  hash: <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
    </>
  ),
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  grid: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  bars: <path d="M4 20h16M7 16v-5M12 16V6M17 16V9" />,
  wallet: <path d="M3 7a2 2 0 0 1 2-2h12v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14.5h.01" />,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  shield: <path d="M12 3 4 6v6c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V6zM9 12l2 2 4-4" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5M16 5.2a3 3 0 0 1 0 5.6M21 20c0-2.4-1.5-4.3-3.8-4.9" />
    </>
  ),
  peak: <path d="M3 20 9.5 9l3.5 5.5L15.5 11 21 20zM9.5 9V3.5l4 1.6-4 1.6" />,
  rebound: <path d="M3 5c4 0 5 13 9 13s5-13 9-13" />,
  bookmark: <path d="M6 3h12v18l-6-4.2L6 21z" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
};

export function Icon({ name, size = 14, className, filled = false }: {
  name: IconName;
  size?: number;
  className?: string;
  /** 별처럼 속을 채우는 그림 */
  filled?: boolean;
}) {
  return (
    <svg className={`icon${className ? ` ${className}` : ""}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name]}
    </svg>
  );
}

/** 상태 점 — SEC 경고 빨강·주황·노랑 (🔴 🟠 🟡 대신), 경기 상태 좋음은 초록. */
export function Dot({ tone }: { tone: "red" | "orange" | "yellow" | "green" }) {
  return <span className={`dot dot--${tone}`} aria-hidden="true" />;
}
