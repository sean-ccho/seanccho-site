// 자료 상태 (2026-11-13) — 밤 자료가 '몇 개 중 몇 개를 받았나'로 정상 · 일부만 · 실패.
// 11-12 밤 예측 모델은 야후가 막아 계산 0/513 이었는데 작업 · 파일 시각은 멀쩡해서 눈으로는 알 수 없었다.
// - 전체분석 미국 · 캐나다 · 예측 모델 · 국회의원 거래: Project_1 이 universe-data 에 올리는 data_status.json
//   (web_export/data_status.py — 지난 밤 숫자도 같이). 실패면 Project_1 이 ntfy 로 알린다.
// - 매수 후보(dashboard.json) · ETF(etf.json): Run Screener 가 그 점검보다 늦게 만들어서 그 파일을 읽을 때 여기서 센다.
// 색 규칙은 여기 한 곳 (Project_1 row_level 은 알림용으로 같은 규칙).

// 타입만 가져온다 (etf · valueModel 은 서버 전용 모듈 — 이 파일은 브라우저 표시 칩도 쓴다)
import type { EtfData } from "./etf";
import type { Dashboard, TickerInfo, UniverseMarket } from "./types";
import type { ValueModel } from "./valueModel";

export type DsLevel = "green" | "yellow" | "red";

/** 칸 하나 — want 가 있으면 got/want 비율, 없으면 0개 · 지난 밤(prev) 대비로 본다. */
export type DsRow = {
  key: string;
  label: string;
  got: number;
  want?: number;
  floor?: number; // got/want 가 이보다 낮으면 일부만 (없으면 0.95)
  zero_red?: boolean; // want 없이도 0개면 실패 (종목 수 등)
  prev?: number; // 지난 밤 got
};

/** 자료 파일 하나 — missing = 파일 없음 · stale = 이번 밤 파일이 아님 (그 단계가 실패해 전날 것이 남음). */
export type DsFile = {
  label: string;
  date?: string | null;
  generated?: string | null;
  rows: DsRow[];
  missing?: boolean;
  stale?: boolean;
};

export type DataStatus = { schema: number; generated: string; date: string | null; files: Record<string, DsFile> };

/** 지난 밤의 이 비율 밑이면 일부만 (Project_1 DROP 과 같은 값). */
export const DS_DROP = 0.8;
const FLOOR_FULL = 0.95;
const FLOOR_PART = 0.9;
const LEVELS: DsLevel[] = ["green", "yellow", "red"];

export function rowLevel(r: DsRow): DsLevel {
  if (r.want != null) {
    if (r.want > 0 && r.got === 0) return "red";
    if (r.want > 0 && r.got / r.want < (r.floor ?? FLOOR_FULL)) return "yellow";
    return "green";
  }
  if (r.got === 0 && r.zero_red) return "red";
  if (r.prev && r.got < DS_DROP * r.prev) return "yellow";
  return "green";
}

export function worstLevel(levels: DsLevel[]): DsLevel {
  return levels.reduce<DsLevel>((a, b) => (LEVELS.indexOf(b) > LEVELS.indexOf(a) ? b : a), "green");
}

export function fileLevel(f: DsFile): DsLevel {
  if (f.missing || f.stale) return "red";
  return worstLevel(f.rows.map(rowLevel));
}

/** 그 파일 색을 정한 칸 (가장 나쁜 것 중 앞) — 표시 글에 쓴다. 정상이면 null. */
export function worstRow(f: DsFile): DsRow | null {
  const lv = fileLevel(f);
  if (lv === "green") return null;
  return f.rows.find((r) => rowLevel(r) === lv) ?? null;
}

const pick = <T,>(xs: (T | null | undefined)[]) => xs.filter((x): x is T => x != null);

/** 종목 목록 칸 (Project_1 stock_rows 와 같은 칸) — None 이면 그 칸을 못 받은 것 ({} 는 계산했지만 없음). */
export function stockRows(items: (TickerInfo | null | undefined)[], opts: { insider: boolean }): DsRow[] {
  const xs = pick(items);
  const n = xs.length;
  const cnt = (f: (x: TickerInfo) => boolean) => xs.filter(f).length;
  const rows: DsRow[] = [
    { key: "items", label: "종목", got: n, zero_red: true },
    { key: "price", label: "가격", got: cnt((x) => x.price != null), want: n, floor: FLOOR_FULL },
    { key: "isb", label: "ISB 라벨", got: cnt((x) => x.isb != null), want: n, floor: FLOOR_FULL },
    { key: "sqz", label: "SQZ 모멘텀", got: cnt((x) => x.sqzmom != null), want: n, floor: FLOOR_FULL },
    { key: "mcap", label: "시가총액", got: cnt((x) => x.fundamentals?.market_cap != null), want: n, floor: FLOOR_PART },
  ];
  if (opts.insider) rows.push({ key: "insider", label: "내부자 거래", got: cnt((x) => x.insider != null), want: n, floor: FLOOR_PART });
  return rows;
}

/**
 * 매수 후보 · 1차 선별 (dashboard.json) — 종목 정보 칸 + 매수 후보 수. 내부자는 1차 선별 · 전체차트에만 있는 종목이
 * 원래 안 받아서(약 30%) 보지 않는다.
 */
export function dashboardStatus(d: Pick<Dashboard, "generated_at" | "bar_date" | "candidates" | "stocks">): DsFile {
  const stocks = Object.values(d.stocks ?? {});
  return {
    label: "매수 후보 · 1차 선별",
    date: d.bar_date,
    generated: d.generated_at,
    rows: [{ key: "cands", label: "매수 후보", got: d.candidates?.length ?? 0, zero_red: true }, ...stockRows(stocks, { insider: false })],
  };
}

/** ETF 탭 (etf.json) — ETF 수 · 가격. */
export function etfStatus(e: EtfData | null): DsFile {
  if (!e) return { label: "ETF", rows: [], missing: true };
  const n = e.items.length;
  return {
    label: "ETF",
    date: e.as_of,
    generated: e.generated_at ?? null,
    rows: [
      { key: "items", label: "ETF", got: n, zero_red: true },
      { key: "price", label: "가격", got: e.items.filter((x) => x.price != null).length, want: n, floor: FLOOR_FULL },
    ],
  };
}

/**
 * 예측 모델 — 계산된 종목 ÷ 대상, 기록 준비 중이면 재무 받은 종목 ÷ 기준. 밤 파일이 계산 0 이라 스냅샷으로 대신 보여 줄 때는
 * failed = 그 밤 파일의 funnel (getValueModel).
 */
export function valueModelStatus(m: ValueModel | null, live: boolean, failedFunnel?: Record<string, number> | null): DsFile {
  const label = "예측 모델";
  if (!live) {
    if (!failedFunnel) return { label, rows: [], missing: true };
    return { label, rows: [{ key: "computed", label: "계산된 종목", got: failedFunnel.computed ?? 0, want: failedFunnel.universe ?? 0, floor: 0.5 }] };
  }
  const f = m?.funnel ?? {};
  const rows: DsRow[] = [{ key: "computed", label: "계산된 종목", got: f.computed ?? 0, want: f.universe ?? 0, floor: 0.5 }];
  const w = m?.tracking?.warmup;
  if (w) rows.push({ key: "warmup", label: "재무 받은 종목 (기록 준비 중)", got: w.have, want: w.want, floor: 1 });
  return { label, date: m?.date ?? null, generated: m?.generated ?? null, rows };
}

/** 칸 글 — '계산된 종목 0/513' · '종목 4,815 (지난 밤 5,000)'. */
export function rowText(r: DsRow): string {
  const n = (v: number) => v.toLocaleString("en-US");
  if (r.want != null) return `${r.label} ${n(r.got)}/${n(r.want)}`;
  return `${r.label} ${n(r.got)}${r.prev != null ? ` (지난 밤 ${n(r.prev)})` : ""}`;
}

/** 파일이 왜 그 색인지 한 줄 — 정상이면 빈 글. */
export function fileReason(f: DsFile): string {
  if (f.missing) return "파일 없음";
  if (f.stale) return "이번 밤 자료 아님";
  const r = worstRow(f);
  return r ? rowText(r) : "";
}

/** 전체분석 시장 파일 이름 (Project_1 data_status.py US_FILES · 캐나다와 같은 말). */
const UNIVERSE_LABEL: Record<string, string> = {
  sp500: "전체분석 · S&P 500", nasdaq: "전체분석 · 나스닥·NYSE", new: "전체분석 · 신규상장", extra: "전체분석 · 번외",
  ca: "전체분석 · 캐나다",
};

/** 전체분석 시장 파일 하나 — 화면이 받은 목록에서 바로 센다 (캐나다 · 번외는 내부자를 안 모은다). */
export function universeFileStatus(d: Pick<UniverseMarket, "key" | "bar_date" | "generated_at" | "items">): DsFile {
  return {
    label: UNIVERSE_LABEL[d.key] ?? d.key,
    date: d.bar_date,
    generated: d.generated_at ?? null,
    rows: stockRows(Object.values(d.items ?? {}), { insider: d.key !== "ca" && d.key !== "extra" }),
  };
}
