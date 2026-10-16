// 스크리너 후보·차트 페이지가 같이 쓰는 필터·정렬 규칙 (화면 없음, 순수 함수).

import type { TickerInfo } from "./types";

export type ListRow = {
  ticker: string;
  held: boolean;
  market: string | null; // "sp500" | "nasdaq"
  info: TickerInfo | null;
  order: number; // 기본 순서 (시트 순서·후보 순위)
};

export type CrossFilter = "all" | "pt" | "golden" | "golden_soon" | "dead" | "dead_soon";
export type SortKey =
  | "default"
  | "score"
  | "health"
  | "volume"
  | "insider"
  | "golden"
  | "rsi"
  | "ret5"
  | "ret20"
  | "pos52"
  | "revenue"
  | "earnings"
  | "marketcap"
  | "ticker";

export const SORT_KEYS: SortKey[] = [
  "default", "score", "health", "volume", "insider", "golden", "rsi", "ret5", "ret20", "pos52", "revenue", "earnings",
  "marketcap", "ticker",
];

/** 처음 눌렀을 때 방향 — 대부분 높은 순, 실적 발표일·티커는 빠른/앞 순. */
export const DEFAULT_DIR: Record<SortKey, "desc" | "asc"> = {
  default: "asc", score: "desc", health: "desc", volume: "desc", insider: "desc", golden: "desc", rsi: "desc",
  ret5: "desc", ret20: "desc", pos52: "desc", revenue: "desc", earnings: "asc", marketcap: "desc", ticker: "asc",
};

export type Filters = {
  market: "all" | "sp500" | "nasdaq";
  heldOnly: boolean;
  aOnly: boolean;
  strategy: string; // "all" 또는 전략 이름
  cross: CrossFilter;
  insider: "all" | "buy" | "sell";
  pattern: string; // "all" 또는 패턴 이름
  q: string;
};

export const EMPTY_FILTERS: Filters = {
  market: "all", heldOnly: false, aOnly: false, strategy: "all", cross: "all", insider: "all", pattern: "all", q: "",
};

/** 크로스는 '크로스' 필터가 따로 있어서 패턴 목록에서는 뺀다. */
const CROSS_PATTERNS = new Set(["골든크로스", "골든크로스임박", "데드크로스", "데드크로스임박"]);

export function allPatterns(info: TickerInfo | null): string[] {
  if (!info) return [];
  return [...info.patterns.daily, ...info.patterns.weekly, ...info.patterns.monthly];
}

/** 차트 카드에 붙일 크로스 표시 — 봉마다 패턴 이름 + 이동평균 간격. */
export type CrossMark = { kind: "golden" | "golden_soon" | "dead" | "dead_soon"; tf: "daily" | "weekly" | "monthly"; gap: number | null };

export function crossMarks(info: TickerInfo | null): CrossMark[] {
  if (!info) return [];
  const out: CrossMark[] = [];
  for (const tf of ["daily", "weekly", "monthly"] as const) {
    const pats = info.patterns[tf];
    const gap = info.ma_gap?.[tf] ?? null;
    if (pats.includes("골든크로스임박")) out.push({ kind: "golden_soon", tf, gap });
    else if (pats.includes("골든크로스")) out.push({ kind: "golden", tf, gap });
    if (pats.includes("데드크로스임박")) out.push({ kind: "dead_soon", tf, gap });
    else if (pats.includes("데드크로스")) out.push({ kind: "dead", tf, gap });
  }
  return out;
}

function crossOk(row: ListRow, f: CrossFilter): boolean {
  if (f === "all") return true;
  if (f === "pt") return Boolean(row.info?.golden);
  return crossMarks(row.info).some((m) => m.kind === f);
}

function insiderOk(row: ListRow, f: Filters["insider"]): boolean {
  if (f === "all") return true;
  const s = row.info?.insider?.signal;
  return f === "buy" ? s === "buy" || s === "cluster_buy" : s === "sell";
}

/** 검색: 티커가 그 글자로 시작하거나 회사 이름이 그 글자로 시작 (대소문자 무시). */
export function matchesQuery(row: ListRow, q: string): boolean {
  const s = q.trim().toUpperCase();
  if (!s) return true;
  return row.ticker.toUpperCase().startsWith(s) || (row.info?.company ?? "").toUpperCase().startsWith(s);
}

/** except 에 적은 필터 하나는 빼고 검사 (패턴 버튼 옆 개수 세기용). */
export function passes(row: ListRow, f: Filters, except?: keyof Filters): boolean {
  const on = (k: keyof Filters) => k !== except;
  if (on("market") && f.market !== "all" && row.market !== f.market) return false;
  if (on("heldOnly") && f.heldOnly && !row.held) return false;
  if (on("aOnly") && f.aOnly && !(row.info?.health?.grade ?? "").startsWith("A")) return false;
  if (on("strategy") && f.strategy !== "all" && row.info?.strategy !== f.strategy) return false;
  if (on("cross") && !crossOk(row, f.cross)) return false;
  if (on("insider") && !insiderOk(row, f.insider)) return false;
  if (on("pattern") && f.pattern !== "all" && !allPatterns(row.info).includes(f.pattern)) return false;
  if (on("q") && !matchesQuery(row, f.q)) return false;
  return true;
}

function sortValue(row: ListRow, key: SortKey): number | string | null {
  const i = row.info;
  switch (key) {
    case "default":
      return row.order;
    case "score":
      return i?.score ?? null;
    case "health":
      return i?.health?.score ?? null;
    case "volume":
      return i?.vol_ratio ?? null;
    case "insider":
      return i?.insider?.signal ? (i.insider.net_value ?? 0) : null;
    case "golden":
      return i?.golden ? -i.golden.rank : null; // 목록 맨 위(0)가 가장 큰 값
    case "rsi":
      return i?.rsi ?? null;
    case "ret5":
      return i?.ret_5d ?? null;
    case "ret20":
      return i?.ret_20d ?? null;
    case "pos52":
      return i?.position_52w ?? null;
    case "revenue":
      return i?.fundamentals?.revenue_growth ?? null;
    case "earnings":
      return i?.days_to_earnings != null && i.days_to_earnings >= 0 ? i.days_to_earnings : null;
    case "marketcap":
      return i?.fundamentals?.market_cap ?? null;
    case "ticker":
      return row.ticker;
  }
}

/** 값이 없는 종목은 방향과 상관없이 맨 뒤, 같으면 기본 순서. */
export function sortRows(rows: ListRow[], key: SortKey, dir: "desc" | "asc"): ListRow[] {
  const sign = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    if (va == null && vb == null) return a.order - b.order;
    if (va == null) return 1;
    if (vb == null) return -1;
    const c = typeof va === "string" ? va.localeCompare(String(vb)) : va - (vb as number);
    return c !== 0 ? sign * c : a.order - b.order;
  });
}

/** 패턴 이름별 종목 수 (크로스 제외, 많은 순). */
export function patternCounts(rows: ListRow[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const p of new Set(allPatterns(r.info))) {
      if (!CROSS_PATTERNS.has(p)) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
