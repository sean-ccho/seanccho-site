import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * 링크 미리보기 그림 (2026-11-19) — 링크드인 · 이력서 링크에 붙는 1200×630 한 장. 영어만 (영어권 채용 담당자용 ·
 * 그림 글꼴에 한글이 없다). 모든 페이지가 물려받는다. 빌드 때 한 번 그려 두고 같은 그림을 계속 쓴다.
 * 숫자는 2026-11-19 밤 자료 기준 (미국 5,454 + 캐나다 1,937 종목) — 크게 바뀌면 여기와 content/profile.ts share 를 같이.
 * 글꼴: IBM Plex Sans (SIL Open Font License) — assets/fonts.
 */
export const alt = "Quant Dashboard — a live quant system for US & Canadian stocks";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const [regular, semibold] = await Promise.all([
  readFile(join(process.cwd(), "assets/fonts/IBMPlexSans-Regular.ttf")),
  readFile(join(process.cwd(), "assets/fonts/IBMPlexSans-SemiBold.ttf")),
]);

// 사이트 토스식 밝은 색 (globals.css 퀀트 화면)
const C = {
  bg: "#ffffff",
  panel: "#f2f4f6",
  line: "#e5e8eb",
  ink: "#191f28",
  ink2: "#333d4b",
  muted: "#6b7684",
  accent: "#3182f6",
  up: "#028450",
};

const STATS: { value: string; label: string }[] = [
  { value: "7,000+", label: "US & Canadian stocks scanned nightly" },
  { value: "15 min", label: "intraday price pulse in market hours" },
  { value: "PT-1", label: "paper-trading account tracked against SPY" },
  { value: "DCF", label: "fair value range for each stock" },
];

const STACK = ["Python", "GitHub Actions", "Next.js", "Vercel"];

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 72px",
          background: C.bg,
          fontFamily: "Plex",
          color: C.ink,
        }}
      >
        {/* 머리: 로고 · 이름 | 주소 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="48" height="48" viewBox="0 0 28 28">
              <rect x="1" y="1" width="26" height="26" rx="7" fill={C.accent} />
              <path d="M7 18 L12 13 L15.5 16.5 L21 10" fill="none" stroke="#ffffff" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 600 }}>
              PT-1
              <span style={{ color: C.muted, fontWeight: 400, marginLeft: 14 }}>Quant Dashboard</span>
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 24, color: C.muted }}>seancho.vercel.app</div>
        </div>

        {/* 큰 글 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 64, fontWeight: 600, lineHeight: 1.12, letterSpacing: -1.5 }}>
            <span>A live quant system for</span>
            <span style={{ color: C.accent }}>US &amp; Canadian stocks</span>
          </div>
          <div style={{ display: "flex", fontSize: 28, color: C.ink2, lineHeight: 1.4 }}>
            Self-built and running daily — screening, paper trading, valuation.
          </div>
        </div>

        {/* 숫자 네 칸 */}
        <div style={{ display: "flex", gap: 16 }}>
          {STATS.map((s) => (
            <div key={s.value}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "18px 22px",
                background: C.panel,
                borderRadius: 18,
              }}>
              <span style={{ fontSize: 36, fontWeight: 600, color: C.ink }}>{s.value}</span>
              <span style={{ fontSize: 19, color: C.muted, lineHeight: 1.3 }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* 기술 */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 20, color: C.ink2 }}>
          {STACK.map((name) => (
            <span key={name}
              style={{ display: "flex", padding: "6px 16px", border: `2px solid ${C.line}`, borderRadius: 999 }}>
              {name}
            </span>
          ))}
          <span style={{ display: "flex", marginLeft: "auto", color: C.muted }}>Research &amp; paper trading only</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Plex", data: regular, style: "normal", weight: 400 },
        { name: "Plex", data: semibold, style: "normal", weight: 600 },
      ],
    },
  );
}
