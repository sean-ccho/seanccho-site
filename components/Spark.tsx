/**
 * 목록 미니 차트 (2026-11-06) — 주봉 1년 흐름. Project_1 market_summary.weekly_spark 가 싣는 모양 글자를 푼다:
 * 한 글자 = 한 주 (금요일 마감 종가, 마지막 주는 마지막 봉), SPARK_ALPHABET 순서로 그 기간 최저 0 ~ 최고 63.
 * 52주가 안 되는 종목(상장 1년 안)은 오른쪽에 붙여 그린다 — 빈 왼쪽 = 아직 상장 전.
 * 선 색 = 첫 주보다 마지막 주가 높으면 오름(--up), 낮으면 내림(--down). 상태 없는 순수 그림이라 서버 · 브라우저 어디서나 쓴다.
 * 자료가 없으면 같은 폭의 빈칸 (목록 칸이 흔들리지 않게).
 */
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
const TOP = ALPHABET.length - 1;
const WEEKS = 52;

export type SparkTone = "up" | "down" | "flat";

/** 모양 글자 → 0~63 단계 (모르는 글자는 버린다). */
export function sparkLevels(s: string | null | undefined): number[] {
  if (!s) return [];
  const out: number[] = [];
  for (const ch of s) {
    const v = ALPHABET.indexOf(ch);
    if (v >= 0) out.push(v);
  }
  return out;
}

export function sparkTone(lv: number[]): SparkTone {
  if (lv.length < 2) return "flat";
  const d = lv[lv.length - 1] - lv[0];
  return d > 0 ? "up" : d < 0 ? "down" : "flat";
}

export function Spark({ s, label, w = 64, h = 26, className }: {
  s: string | null | undefined;
  /** 읽어 주는 글자 (t.list.spark) — 없으면 그림은 화면 읽기에서 숨긴다 */
  label?: (tone: SparkTone) => string;
  w?: number;
  h?: number;
  className?: string;
}) {
  const lv = sparkLevels(s);
  const cls = `spark-w${className ? ` ${className}` : ""}`;
  if (lv.length < 2) return <span className={`${cls} spark-w--none`} style={{ width: w, height: h }} aria-hidden="true" />;
  const slots = Math.max(WEEKS, lv.length);
  const off = slots - lv.length;
  const pad = 2;
  const x = (i: number) => ((off + i) / (slots - 1)) * w;
  const y = (v: number) => pad + (1 - v / TOP) * (h - pad * 2);
  const d = lv.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const tone = sparkTone(lv);
  return (
    <svg className={`${cls} spark-w--${tone}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      {...(label ? { role: "img", "aria-label": label(tone) } : { "aria-hidden": true })}>
      <path d={d} />
    </svg>
  );
}
