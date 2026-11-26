// 헬스체크(재무) 8개 항목 — Project_1 src/screener/health_score.py 의 ITEMS 와 같은 기준 · 점수 (표시 전용, 2026-11-25).
// 밤 실행은 점수 · 등급 · 한 줄 설명만 보낸다. 항목마다 통과했는지는 종목 정보의 fundamentals 로 여기서 다시 매긴다.
// 사이트 파일 숫자는 반올림돼 있어서 (유동비율 · 부채비율 소수 둘째 자리, 나머지 넷째 자리) 반올림한 값이 기준과 똑같으면
// 통과인지 알 수 없다 — 예: 유동비율 1.003 → 1.0. 그런 항목은 밤 점수(health.score)와 맞는 쪽으로 정한다.

import type { Fundamentals, TickerInfo } from "./types";

export type HealthItemKey = "roe" | "de" | "rev" | "pm" | "eg" | "cr" | "fcf" | "inst";

export type HealthItemDef = {
  key: HealthItemKey;
  field: keyof Fundamentals;
  /** 기준 — gt 는 이보다 커야, lt 는 이보다 작아야 통과 */
  limit: number;
  pts: number;
  op: "gt" | "lt";
};

/** 점수 큰 순 (Project_1 ITEMS 순서 그대로) — 8개 합 100점. */
export const HEALTH_ITEMS: HealthItemDef[] = [
  { key: "roe", field: "roe", limit: 0.08, pts: 20, op: "gt" },
  { key: "de", field: "debt_to_equity", limit: 200, pts: 15, op: "lt" }, // Yahoo 는 % (200 = 2배)
  { key: "rev", field: "revenue_growth", limit: 0.03, pts: 15, op: "gt" },
  { key: "pm", field: "profit_margin", limit: 0.05, pts: 15, op: "gt" },
  { key: "eg", field: "earnings_growth", limit: 0.02, pts: 10, op: "gt" },
  { key: "cr", field: "current_ratio", limit: 1, pts: 10, op: "gt" },
  { key: "fcf", field: "free_cashflow", limit: 0, pts: 10, op: "gt" },
  { key: "inst", field: "institutional_pct", limit: 0.6, pts: 5, op: "gt" },
];
export const HEALTH_KEYS: HealthItemKey[] = HEALTH_ITEMS.map((d) => d.key);
/** 받은 항목이 이보다 적으면 점수 없음 ('자료 부족') — Project_1 MIN_ITEMS. */
export const HEALTH_MIN_ITEMS = 5;

/** 회사 재무가 없는 지수 ETF (Project_1 config INDICES) — 매수 후보에 '저점 반등'으로 들어오기도 한다. */
const INDEX_ETFS = new Set(["SPY", "QQQ", "IWM"]);
export function isIndexEtf(ticker: string): boolean {
  return INDEX_ETFS.has(ticker);
}

export type ItemState = "pass" | "fail" | "none";
/** edge = 반올림한 값이 기준과 똑같아서 밤 점수로 통과 · 미달을 정한 항목 (화면에 '살짝 넘음'). */
export type HealthItem = { def: HealthItemDef; value: number | null; state: ItemState; edge: boolean };
export type HealthBreakdown = {
  items: HealthItem[];
  byKey: Record<HealthItemKey, HealthItem>;
  /** 받은 항목 수 · 받은 항목 만점 · 통과한 점수 · 점수 (받은 항목이 5개 미만이면 null) */
  got: number;
  possible: number;
  earned: number;
  score: number | null;
};

/** Python math.floor(earned * 100 / possible + 0.5) 와 같은 반올림. */
function scoreOf(earned: number, possible: number): number {
  return Math.floor((earned * 100) / possible + 0.5);
}

function tally(items: HealthItem[]) {
  let got = 0;
  let possible = 0;
  let earned = 0;
  for (const it of items) {
    if (it.state === "none") continue;
    got += 1;
    possible += it.def.pts;
    if (it.state === "pass") earned += it.def.pts;
  }
  return { got, possible, earned };
}

const cache = new WeakMap<TickerInfo, HealthBreakdown | null>();

/** 8개 항목 통과 · 미달 · 자료 없음 + 점수 계산 (종목 정보마다 한 번만 — 목록 수천 개를 여러 번 센다). */
export function healthBreakdown(info: TickerInfo | null | undefined): HealthBreakdown | null {
  if (!info?.fundamentals) return null;
  const hit = cache.get(info);
  if (hit !== undefined) return hit;
  const f = info.fundamentals;
  const items: HealthItem[] = HEALTH_ITEMS.map((def) => {
    const v = f[def.field];
    const value = typeof v === "number" && Number.isFinite(v) ? v : null;
    if (value == null) return { def, value, state: "none", edge: false };
    const ok = def.op === "gt" ? value > def.limit : value < def.limit;
    return { def, value, state: ok ? "pass" : "fail", edge: value === def.limit };
  });
  // 반올림 경계 — 기준과 똑같은 값은 '미달'로 두고, 밤 점수와 다르면 통과로 바꿔 맞춰 본다 (보통 0~1개)
  const published = info.health?.score ?? null;
  const edge = items.filter((it) => it.value != null && it.value === it.def.limit);
  if (published != null && edge.length > 0 && edge.length <= 3) {
    const t0 = tally(items);
    if (t0.got >= HEALTH_MIN_ITEMS && scoreOf(t0.earned, t0.possible) !== published) {
      for (let mask = 1; mask < 1 << edge.length; mask += 1) {
        edge.forEach((it, i) => {
          it.state = mask & (1 << i) ? "pass" : "fail";
        });
        const t = tally(items);
        if (scoreOf(t.earned, t.possible) === published) break;
        if (mask === (1 << edge.length) - 1) edge.forEach((it) => (it.state = "fail")); // 못 맞추면 처음대로
      }
    }
  }
  const t = tally(items);
  const byKey = Object.fromEntries(items.map((it) => [it.def.key, it])) as Record<HealthItemKey, HealthItem>;
  const out: HealthBreakdown = {
    items, byKey, ...t, score: t.got >= HEALTH_MIN_ITEMS ? scoreOf(t.earned, t.possible) : null,
  };
  cache.set(info, out);
  return out;
}

/** 고급 필터 '헬스체크 등급' — A 이상(A · A+) · B 이상 · D·F · 자료 부족(점수 없음). ETF 는 어디에도 안 든다. */
export type HealthPick = "a" | "b" | "df" | "na";
export const HEALTH_PICKS: HealthPick[] = ["a", "b", "df", "na"];

export function healthPickOk(info: TickerInfo | null | undefined, ticker: string, pick: HealthPick): boolean {
  const h = info?.health;
  if (!h || isIndexEtf(ticker)) return false;
  const g = h.grade ?? "";
  switch (pick) {
    case "a":
      return g.startsWith("A");
    case "b":
      return g.startsWith("A") || g === "B";
    case "df":
      return g === "D" || g === "F";
    case "na":
      return h.score == null;
  }
}

/** filters.fin 글자 → 고른 항목 키 (늘 점수 큰 순, 모르는 키는 버린다). */
export function finKeys(s: string): HealthItemKey[] {
  if (!s) return [];
  const set = new Set(s.split(","));
  return HEALTH_KEYS.filter((k) => set.has(k));
}

export function finJoin(keys: HealthItemKey[]): string {
  const set = new Set(keys);
  return HEALTH_KEYS.filter((k) => set.has(k)).join(",");
}

/** 고른 재무 항목을 모두 통과했나 (자료 없는 항목은 통과 아님). */
export function finOk(info: TickerInfo | null | undefined, keys: HealthItemKey[]): boolean {
  if (!keys.length) return true;
  const b = healthBreakdown(info);
  return Boolean(b) && keys.every((k) => b!.byKey[k].state === "pass");
}
