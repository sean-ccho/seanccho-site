import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import type { EtfData } from "./etf";
import { todayToronto } from "./format";
import { LIVE_BASE, newer, overlayInfo, quoteOf, type LiveData, type LiveQuotes } from "./liveShared";
import type { MacroData, MacroKey } from "./macro";
import type { Account, Benchmark, CurvePoint, DashboardCore, LiveMark, MarketSummary, Position, SqueezeItem, TickerInfo } from "./types";

export { LIVE_BASE, newer, overlayInfo, quoteOf };
export type { LiveData, LiveQuotes };

/**
 * 장중 숫자 (2026-11-09) — Project_1 장중 펄스(src/web_export/intraday_pulse.py)가 월~금 09:45~15:45 15분마다와
 * 16:20(마감 펄스)에 live-data 브랜치에 올리는 live.json · quotes.json. 표시 전용이다. (서버 전용 — 브라우저 공용은 liveShared)
 *
 * 밤 데이터 위에 덮어쓰기만 한다 — 각 데이터는 자기 밤 날짜보다 펄스 날짜가 새로울 때만 덮어써서, 밤 분석이 그날 것으로
 * 바뀌면 저절로 확정값으로 돌아간다. 상태 (LiveMark):
 *  - live    펄스가 오늘 것이고 40분 안 → 머리에 '장중 11:30 ET' (파란 점), 카드 '● 11:30'
 *  - closing 16:20 마감 펄스 (final) → '16:00 마감 · 잠정' (회색), 밤 분석이 그날 것으로 바뀔 때까지
 *  - 없음    주말 · 휴장 · 펄스 끊김(40분 넘음) · 펄스가 아직 없음 → 지금과 같은 화면
 *
 * 계산은 전부 Project_1 이 밤과 같은 함수로 한다 (사이트는 규칙을 다시 짜지 않는다). LIVE_DIR 가 있으면 로컬 폴더의 파일.
 */
export const LIVE_TAG = "live";
const LIVE_MAX_AGE_MIN = 40; // 펄스 두 번(15분 × 2) + raw 캐시 5분 + 여유 — 넘으면 펄스가 멈춘 것
const REVALIDATE = 60;

async function readLive<T>(name: string): Promise<T | null> {
  try {
    const dir = process.env.LIVE_DIR;
    if (dir) return JSON.parse(await readFile(path.join(dir, name), "utf8")) as T;
    const res = await fetch(`${LIVE_BASE}/${name}`, { next: { revalidate: REVALIDATE, tags: [LIVE_TAG] } });
    if (!res.ok) return null; // 404 = 아직 펄스가 한 번도 없다
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[live] ${name} 읽기 실패`, err);
    return null;
  }
}

/** live.json (1분 캐시). 없거나 못 읽으면 null. */
export const getLiveData = cache(() => readLive<LiveData>("live.json"));
/** quotes.json (1분 캐시) — 종목별 장중 가격. 없거나 못 읽으면 null. */
export const getLiveQuotes = cache(() => readLive<LiveQuotes>("quotes.json"));

/** 'YYYY-MM-DDTHH:MM…' (토론토 시각으로 적힌 ISO) → 'HH:MM'. */
function hhmm(iso: string | null | undefined): string {
  return iso && iso.length >= 16 ? iso.slice(11, 16) : "";
}

/** 펄스 → 화면 상태. 장중 펄스가 오늘 것이 아니거나 40분 넘게 묵었으면 null (= 밤 숫자 그대로). */
export function liveMark(d: LiveData | null | undefined, now: number = Date.now()): LiveMark | null {
  if (!d || d.schema !== 1 || !d.day) return null;
  const s = d.session.us.state !== "holiday" && d.session.us.state !== "pre" ? d.session.us : d.session.ca;
  if (d.final) return { state: "closing", at: s.close, day: d.day, stamp: d.generated_at };
  const age = (now - Date.parse(d.generated_at)) / 60_000;
  if (d.day !== todayToronto() || !(age <= LIVE_MAX_AGE_MIN)) return null;
  return { state: "live", at: hhmm(s.as_of) || hhmm(d.generated_at), day: d.day, stamp: d.generated_at };
}

/** 지금 화면 상태 (요청마다 한 번 — 머리 · 페이지가 같이 쓴다). */
export const getLiveMark = cache(async () => liveMark(await getLiveData()));

/** 종목 하나 (전체분석 종목 파일 등) — 펄스가 그 밤 날짜보다 새것이면 장중 값으로. */
export async function liveInfo<T extends TickerInfo>(info: T, ticker: string, nightDate: string | null | undefined): Promise<T> {
  const [live, quotes, mark] = await Promise.all([getLiveData(), getLiveQuotes(), getLiveMark()]);
  if (!live || !newer(mark, nightDate)) return info;
  return overlayInfo(info, quoteOf(quotes, ticker), live.cands[ticker], mark);
}

function overlayAccount(a: Account, p: NonNullable<LiveData["pt1"]>, mark: LiveMark): Account {
  if (!p.live) return a;
  const byTicker = new Map(p.positions.map((x) => [x.ticker, x]));
  const positions: Position[] = a.positions.map((pos) => {
    const l = byTicker.get(pos.ticker);
    if (!l?.live) return pos;
    return { ...pos, price: l.price, chg: l.chg, return: l.return, highest_price: l.highest_price, value: l.value,
      spy_return: l.spy_return, exit: l.exit, days_held: l.days_held, live: mark };
  });
  let dollar = a.dollar;
  const d = p.dollar;
  if (dollar && d && d.equity != null) {
    const point: CurvePoint = { date: d.date, equity: d.equity, spy: d.spy_equity };
    dollar = {
      ...dollar,
      equity: d.equity,
      return: d.return,
      spy_equity: d.spy_equity,
      spy_return: d.spy_return,
      unrealized: dollar.unrealized != null && dollar.equity != null ? dollar.unrealized + (d.equity - dollar.equity) : null,
      curve: [...dollar.curve.filter((c) => c.date < d.date), point],
      live: mark,
    };
  }
  return { ...a, positions, dollar };
}

function overlaySpy(b: Benchmark | null | undefined, spy: { p: number | null } | undefined, day: string) {
  if (!b || spy?.p == null) return b;
  return { ...b, closes: [...b.closes.filter(([d]) => d < day), [day, spy.p] as [string, number]] };
}

function overlaySqueeze(sq: DashboardCore["squeeze"], live: LiveData["squeeze"]): DashboardCore["squeeze"] {
  if (!sq || !live) return sq;
  const byTicker = new Map(live.items.map((x) => [x.ticker, x]));
  const items: SqueezeItem[] = sq.items.map((it) => {
    const l = byTicker.get(it.ticker);
    return l?.live ? { ...it, status: l.status, price: l.price, ret_5d: l.ret_5d, vol_ratio: l.vol_ratio } : it;
  });
  return { ...sq, items };
}

/**
 * dashboard.json (또는 머리용 core) 에 장중 값 — PT-1 보유 · $5,000 계좌, 매수 후보, 종목 정보(stocks), SPY 종가,
 * 숏스퀴즈. bar_date · price_date 는 밤 값 그대로 둔다 (밤 날짜와 비교해 덮어쓸지 정하므로).
 */
export function overlayDashboard<T extends DashboardCore & { stocks?: Record<string, TickerInfo> }>(dash: T,
  d: LiveData | null, quotes: LiveQuotes | null, mark: LiveMark | null): T {
  if (!d || !newer(mark, dash.bar_date)) return dash;
  const pt1 = d.pt1;
  const out: T = {
    ...dash,
    live: mark,
    accounts: dash.accounts.map((a) => (pt1 && a.key === pt1.key ? overlayAccount(a, pt1, mark) : a)),
    candidates: dash.candidates.map((c) => overlayInfo(c, quoteOf(quotes, c.ticker), d.cands[c.ticker], mark)),
    benchmark: overlaySpy(dash.benchmark, d.indices.SPY, mark.day),
    squeeze: overlaySqueeze(dash.squeeze, d.squeeze),
  };
  if (dash.stocks) {
    out.stocks = Object.fromEntries(Object.entries(dash.stocks).map(([t, info]) =>
      [t, overlayInfo(info, quoteOf(quotes, t), d.cands[t], mark)]));
  }
  return out;
}

/** 오늘 탭 '시장 한눈에' — 시장 폭 · 목록 · 섹터를 장중 값으로 (실적 일정은 밤 그대로). */
export function overlayMarket(m: MarketSummary, d: LiveData | null, mark: LiveMark | null): MarketSummary {
  const lm = d?.market?.[m.market ?? "us"];
  if (!lm || !newer(mark, m.bar_date)) return m;
  return { ...m, ...lm, calendar: m.calendar, mega: m.mega, live: mark };
}

/** 경기 상태 — 시장 가격 지표(SPY 200일선 · 순환/방어)와 환율만 장중 값 (나머지 FRED 지표는 하루 단위). */
export function overlayMacro(m: MacroData, d: LiveData | null, mark: LiveMark | null): MacroData {
  if (!d?.macro || !mark) return m;
  const live = new Map(d.macro.indicators.map((i) => [i.key, i]));
  const keys: MacroKey[] = [];
  const indicators = m.indicators.map((i) => {
    const l = live.get(i.key);
    if (!l || !newer(mark, i.date)) return i;
    keys.push(i.key);
    return l;
  });
  const fx = d.macro.fx && newer(mark, m.fx?.date) ? d.macro.fx : m.fx;
  if (!keys.length && fx === m.fx) return m;
  return { ...m, indicators, fx, live: mark, live_keys: keys };
}

/** ETF 탭 — 가격 · 오늘 등락 · 기간 수익률 · 200일선 위 · 52주 고점 대비 (보수 · 보유 종목 · 추세 픽은 밤 그대로). */
export function overlayEtf(e: EtfData, d: LiveData | null, mark: LiveMark | null): EtfData {
  if (!d?.etf || !newer(mark, e.as_of)) return e;
  let n = 0;
  const items = e.items.map((it) => {
    const l = d.etf[it.ticker];
    if (!l || !(l.date > it.date)) return it;
    n++;
    return { ...it, date: l.date, price: l.price, chg: l.chg, ret: l.ret, above_200: l.above_200,
      high_52w_gap: l.high_52w_gap };
  });
  return n ? { ...e, items, live: mark } : e;
}
