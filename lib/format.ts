// 숫자·날짜 표시 — 음수는 진짜 빼기 기호(−)를 쓴다. 날짜는 화면 언어(ko·en)에 맞춘다.

import type { Lang } from "./i18n";

const MINUS = "−";
const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type Tone = "up" | "down" | "flat";

export function tone(v: number | null | undefined): Tone {
  if (v == null || !Number.isFinite(v) || Math.abs(v) < 1e-9) return "flat";
  return v > 0 ? "up" : "down";
}

/** 0.053 → '+5.3%' (signed=false 면 부호는 음수만). */
export function pct(v: number | null | undefined, digits = 1, signed = true): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v * 100).toFixed(digits);
  if (Number(abs) === 0) return `${abs}%`;
  if (v < 0) return `${MINUS}${abs}%`;
  return signed ? `+${abs}%` : `${abs}%`;
}

/** 두 수익률 차이 → '+9.6%p'. */
export function pp(a: number | null | undefined, b: number | null | undefined, digits = 1): string {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return "—";
  const d = (a - b) * 100;
  const abs = Math.abs(d).toFixed(digits);
  if (Number(abs) === 0) return `${abs}%p`;
  return `${d > 0 ? "+" : MINUS}${abs}%p`;
}

/** 1234.5 → '$1,234.50' (digits 자리). */
export function usd(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const s = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${v < 0 ? MINUS : ""}$${s}`;
}

/** 큰 금액 → '$3.21B' · '$412M' · '−$1.2M'. */
export function bigUsd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const [n, unit] = a >= 1e12 ? [a / 1e12, "T"] : a >= 1e9 ? [a / 1e9, "B"] : a >= 1e6 ? [a / 1e6, "M"] : a >= 1e3 ? [a / 1e3, "K"] : [a, ""];
  return `${v < 0 ? MINUS : ""}$${n.toFixed(n >= 100 || unit === "" ? 0 : n >= 10 ? 1 : 2)}${unit}`;
}

/** 1.4083 → '1.41' (없으면 '—'). */
export function num(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v < 0 ? MINUS : ""}${Math.abs(v).toFixed(digits)}`;
}

/** 'YYYY-MM-DD' → '10월 13일' · 'Oct 13' (weekday 면 '10월 13일(화)' · 'Oct 13 (Tue)'). */
export function fmtDate(iso: string | null | undefined, lang: Lang, weekday = false): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (lang === "en") {
    const base = `${MONTHS_EN[m - 1]} ${d}`;
    return weekday ? `${base} (${WEEKDAYS_EN[wd]})` : base;
  }
  const base = `${m}월 ${d}일`;
  return weekday ? `${base}(${WEEKDAYS_KO[wd]})` : base;
}

/** 'YYYY-MM' 의 달 이름 — '10월' · 'Oct'. */
export function monthLabel(month: number, lang: Lang): string {
  return lang === "en" ? MONTHS_EN[month - 1] : `${month}월`;
}

/** ISO 시각 → 토론토 기준 '10월 15일 오전 2:22' · 'Oct 15, 2:22 AM'. */
export function fmtDateTime(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
    timeZone: "America/Toronto",
    month: lang === "en" ? "short" : "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(dt);
}

/** 'A+'·'A' 는 좋음, 'B'·'C' 는 보통, 나머지는 나쁨. */
export function gradeTone(grade: string | null | undefined): "good" | "mid" | "bad" | "none" {
  if (!grade) return "none";
  if (grade.startsWith("A")) return "good";
  if (grade.startsWith("B") || grade.startsWith("C")) return "mid";
  return "bad";
}

/** 야후 티커 → TradingView 링크. 'BRK-B' 같은 종류주는 TradingView 에서 'BRK.B' (하이픈이면 런던 종목이 열린다). */
export function tvUrl(ticker: string): string {
  const symbol = ticker.endsWith(".V")
    ? `TSXV:${ticker.slice(0, -2)}`
    : /^[A-Z]+-[A-Z]$/.test(ticker)
      ? ticker.replace("-", ".")
      : ticker;
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
}

/** 종목 상세 페이지 주소. */
export function stockHref(ticker: string): string {
  return `/quant/stock/${encodeURIComponent(ticker)}`;
}

/** 토론토 기준 오늘 'YYYY-MM-DD'. */
export function todayToronto(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
}
