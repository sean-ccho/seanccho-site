// 숫자·날짜 표시 — 음수는 진짜 빼기 기호(−)를 쓴다.

const MINUS = "−";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

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

/** 'YYYY-MM-DD' → '10월 13일' (weekday 면 '10월 13일(화)'). */
export function dateKo(iso: string | null | undefined, weekday = false): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  const base = `${m}월 ${d}일`;
  if (!weekday) return base;
  return `${base}(${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}

/** ISO 시각 → 토론토 기준 '10월 15일 오전 2:22'. */
export function dateTimeKo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "America/Toronto",
    month: "long",
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

export function tvUrl(ticker: string): string {
  const symbol = ticker.endsWith(".V") ? `TSXV:${ticker.slice(0, -2)}` : ticker;
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
}
