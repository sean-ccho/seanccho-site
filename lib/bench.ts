import type { Benchmark } from "./types";

// 같은 기간 SPY 수익률 — dashboard.json 의 benchmark (SPY 배당 조정 종가, Project_1 이 매일 넣는다).
// 매수일 종가 → 매도일(없으면 마지막) 종가. 각 날짜 이전 마지막 거래일 기준 (Project_1 benchmarks.spy_window_return 과 같음).

function closeOn(b: Benchmark, iso: string): number | null {
  const c = b.closes;
  if (!c.length || iso < c[0][0]) return null;
  let lo = 0;
  let hi = c.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (c[mid][0] <= iso) lo = mid;
    else hi = mid - 1;
  }
  return c[lo][1];
}

/** from 종가 → to 종가 (to 가 없으면 가장 최근) SPY 수익률. 모르면 null. */
export function spyReturn(b: Benchmark | null | undefined, from: string, to?: string | null): number | null {
  if (!b || !from) return null;
  const a = closeOn(b, from);
  const z = to ? closeOn(b, to) : b.closes.at(-1)?.[1] ?? null;
  return a && z ? z / a - 1 : null;
}

/** 벤치마크 마지막 날짜. */
export function benchEnd(b: Benchmark | null | undefined): string | null {
  return b?.closes.at(-1)?.[0] ?? null;
}

/** 장중 SPY 가격을 오늘 날짜의 종가처럼 붙인다 — 종목 실시간가와 같은 시점으로 SPY 대비를 비교하려고.
 * 오늘 종가가 이미 있으면(밤 실행 뒤) 그대로 둔다. 배당 조정은 과거 값만 바꾸므로 최신 가격을 그대로 붙여도 맞다. */
export function withLiveClose(b: Benchmark | null, live: number | null, today: string): Benchmark | null {
  if (!b || live == null) return b;
  const end = benchEnd(b);
  if (end != null && end >= today) return b;
  return { ...b, closes: [...b.closes, [today, live]] };
}
