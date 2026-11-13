// 국회의원 거래 신고 화면(/quant/congress, 2026-11-06)이 같이 쓰는 작은 계산 — 서버 · 브라우저 둘 다에서 쓴다 (서버 전용 import 없음).
import type { CongressSummary, CongressTrade } from "./types";

/** universe-data 의 congress_tickers.json — Project_1 data/congress_trades.py (종목별 1년 거래 + 90일 요약). */
export type CongressTickersFile = {
  as_of: string;
  tickers: Record<string, CongressTrade[]>;
  summary: Record<string, CongressSummary>;
};

export type CxMember = { name: string; party: string | null; state: string | null; leader: string | null };

/** 화면으로 넘기는 한 줄 — 의원은 번호(m)로, 원문 주소는 'YYYY/문서번호'(u)로 줄여서 (4천 줄이라). */
export type CxRow = {
  f: string; // 신고일
  d: string | null; // 거래일
  l: number | null; // 거래 → 신고 걸린 날
  t: string; // 티커
  m: number; // members 번호
  y: CongressTrade["type"];
  p: boolean; // 일부 매도
  a: string; // 자산 종류 (ST 주식 · OP 옵션 …)
  lo: number | null;
  hi: number | null;
  amt: string;
  o: CongressTrade["owner"];
  u: string;
};

const HOUSE_PDF = "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/";

/** 1년 전부 보기의 금액 하한 버튼 · 기간 버튼 (주소 ?min= · ?d= 도 이 값만 받는다). */
export const AMOUNTS = [0, 15_001, 50_001, 250_001, 1_000_001] as const;
export const PERIODS = [30, 90, 365] as const;

/**
 * 오늘 탭 칸 (2026-11-12 — 큰 금액 순 → 최근 신고 순으로 바꿈): 지난 30일 신고 중 금액 하한 $15K 이상을
 * 최근 신고 순으로, 한 의원은 TODAY_PER_MEMBER 줄까지 TODAY_N 줄. 1년 전부 보기를 같은 조건(30일 · $15K 이상)으로 열면
 * 같은 거래가 같은 순서로 나온다 (오늘 칸은 의원당 줄 수만 더 자른 것).
 */
export const TODAY_MIN = 15_001;
export const TODAY_N = 15;
export const TODAY_PER_MEMBER = 3;

/** 1년 전부 보기를 오늘 탭 칸과 같은 조건으로 여는 주소. */
export function sameListHref(days: number): string {
  return `/quant/congress?d=${days}&min=${TODAY_MIN}`;
}

/** 금액 하한 → 짧은 글자 ($15,001 → '$15K', $1,000,001 → '$1M'). */
export function amountText(v: number): string {
  return v >= 1_000_000 ? `$${(v - 1) / 1_000_000}M` : `$${Math.round((v - 1) / 1000)}K`;
}

type Sortable = { filed: string; low: number | null; ticker: string; date: string | null };

/**
 * 거래 순서 (2026-11-12) — 신고일 최근 → 금액 하한 큰 → 티커 → 거래일 최근.
 * 오늘 탭 칸(pickToday)과 1년 전부 보기(compactCongress)가 이 하나를 같이 써서, 같은 거래는 두 화면에서 같은 순서로 나온다.
 */
export function cmpRecent(a: Sortable, b: Sortable): number {
  return (
    b.filed.localeCompare(a.filed) ||
    (b.low ?? 0) - (a.low ?? 0) ||
    a.ticker.localeCompare(b.ticker) ||
    (b.date ?? "").localeCompare(a.date ?? "")
  );
}

/**
 * 거래일이 신고일보다 늦은 줄 — 원문 신고서에 날짜가 잘못 적힌 것 (2026-11-12 확인: 1년 4천여 줄 중 3건, PDF 를 직접 열어 보니
 * 적힌 그대로 — 예: 10/27 서명 신고서에 거래일 10/28, 2026-02 신고서에 거래일 12/26/2026). 이때는 '신고까지 며칠'을 쓰지 않는다.
 */
export function badTradeDate(date: string | null, filed: string): boolean {
  return !!date && date > filed;
}

/** 신고까지 걸린 날 중앙값용 — 날짜가 잘못 적힌 줄(음수)은 뺀다. */
export function validLags(xs: (number | null)[]): number[] {
  return xs.filter((x): x is number => x != null && x >= 0);
}

export function pdfUrl(tail: string): string {
  return /^https?:/.test(tail) ? tail : `${HOUSE_PDF}${tail}.pdf`;
}

/** 종목별 파일 → 의원 표 + 거래 줄 (신고일 최근 순). */
export function compactCongress(file: CongressTickersFile): { members: CxMember[]; rows: CxRow[] } {
  const members: CxMember[] = [];
  const idx = new Map<string, number>();
  const rows: CxRow[] = [];
  for (const [ticker, trades] of Object.entries(file.tickers)) {
    for (const x of trades) {
      const key = `${x.member}|${x.state ?? ""}`;
      let m = idx.get(key);
      if (m == null) {
        m = members.length;
        idx.set(key, m);
        members.push({ name: x.member, party: x.party, state: x.state, leader: x.leader });
      }
      const u = /ptr-pdfs\/(\d{4}\/\w+)\.pdf$/.exec(x.url)?.[1] ?? x.url;
      rows.push({
        f: x.filed, d: x.date, l: x.lag, t: ticker, m, y: x.type, p: x.partial, a: x.atype, lo: x.low, hi: x.high,
        amt: x.amount, o: x.owner, u,
      });
    }
  }
  rows.sort((a, b) => cmpRecent({ filed: a.f, low: a.lo, ticker: a.t, date: a.d }, { filed: b.f, low: b.lo, ticker: b.t, date: b.d }));
  return { members, rows };
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const k = s.length >> 1;
  return s.length % 2 ? s[k] : Math.round((s[k - 1] + s[k]) / 2);
}

/** 오늘(ISO)에서 n 일 전 ISO. */
export function daysAgo(today: string, n: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
