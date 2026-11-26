import { sparkLevels } from "./Spark";

/**
 * 내계좌 보유 줄 1년 주봉 (2026-11-26) — 목록 미니 차트(Spark)와 같은 모양 글자(spark_w)에 '산 주'를 점으로 찍는다.
 * 산 주 앞은 옅은 회색, 산 주부터는 지금 손익 색(오름 · 내림). 점선 = 산 주 종가 높이 — 모양 글자는 값이 아니라
 * 모양만이라 매수가와 조금 다를 수 있다 (정확한 숫자는 옆 칸). 산 지 1년이 넘었으면 점 없이 전부 보유 색.
 * 한 글자 = 한 주(금요일 마감, 마지막 글자 = 마지막 봉의 주). 상태 없는 그림이라 서버 · 브라우저 어디서나 쓴다.
 */
const TOP = 63;
const WEEKS = 52;

/** 토~금을 한 주로 센 주 번호 (1970-01-03 토요일 = 0). */
function weekNo(iso: string): number | null {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(ms)) return null;
  return Math.floor((Math.round(ms / 86_400_000) - 2) / 7);
}

/** 산 주가 마지막 주에서 몇 주 전인지 (같은 주 = 0). 모르면 null. */
export function weeksSince(buyDate: string, end: string): number | null {
  const a = weekNo(buyDate);
  const b = weekNo(end);
  return a == null || b == null ? null : b - a;
}

export function HoldSpark({ s, buyDate, end, tone, label, w = 96, h = 26 }: {
  s: string | null | undefined;
  buyDate: string;
  /** 마지막 글자의 날짜 (밤 분석 봉 날짜) */
  end: string;
  tone: "up" | "down" | "flat";
  label: string;
  w?: number;
  h?: number;
}) {
  const lv = sparkLevels(s);
  if (lv.length < 2) return null;
  const pad = 3;
  const slots = Math.max(WEEKS, lv.length);
  const off = slots - lv.length;
  const x = (i: number) => pad + ((off + i) / (slots - 1)) * (w - pad * 2);
  const y = (v: number) => pad + (1 - v / TOP) * (h - pad * 2);
  const ago = buyDate ? weeksSince(buyDate, end) : null;
  // 산 주가 그림 안이면 그 자리, 1년(그림)보다 앞이면 처음부터 보유, 마지막 봉 뒤(오늘 산 줄)면 마지막 점
  const raw = ago == null ? 0 : lv.length - 1 - ago;
  const inside = ago != null && raw >= 0;
  const bi = Math.min(Math.max(raw, 0), lv.length - 1);
  const path = (from: number, to: number) =>
    lv.slice(from, to + 1).map((v, k) => `${k ? "L" : "M"}${x(from + k).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const by = y(lv[bi]);
  return (
    <svg className={`hold-spark hold-spark--${tone}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      {inside && bi > 0 && <path className="hold-spark__pre" d={path(0, bi)} />}
      {inside && <line className="hold-spark__level" x1={x(bi)} x2={w - pad} y1={by} y2={by} />}
      {bi < lv.length - 1 && <path className="hold-spark__post" d={path(bi, lv.length - 1)} />}
      {inside && <circle className="hold-spark__dot" cx={x(bi)} cy={by} r={2.5} />}
    </svg>
  );
}
