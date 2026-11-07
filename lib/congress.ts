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
  rows.sort((a, b) => b.f.localeCompare(a.f) || (b.lo ?? 0) - (a.lo ?? 0));
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
