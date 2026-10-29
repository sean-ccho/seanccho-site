import { readFile } from "node:fs/promises";
import { DASHBOARD_TAG } from "./dashboard";

// Project_1 밤 실행(screener.etf_scan)이 dashboard.json 과 같은 브랜치에 올리는 파일 (2026-10-28)
export const DEFAULT_ETF_URL = "https://raw.githubusercontent.com/sean-ccho/Project_1/dashboard-data/etf.json";

export type EtfCross = { label: string | null; gap: number | null };

export type EtfItem = {
  ticker: string;
  group: string;
  name: string | null;
  family: string | null;
  category: string | null;
  currency: string | null;
  expense: number | null; // 연 보수 (소수 — 0.000945 = 0.0945%)
  aum: number | null; // 운용자산 (그 ETF 통화)
  yield: number | null; // 배당률 (소수)
  inception: string | null;
  date: string;
  price: number | null; // 분할만 반영 종가 (차트와 같은 가격)
  ret: { w1: number | null; m1: number | null; m3: number | null; m6: number | null; y1: number | null; ytd: number | null };
  above_200: boolean | null;
  trend_12m: boolean | null; // 1년 수익 > 단기 국채(BIL) 1년 수익
  high_52w_gap: number | null;
  vol: number | null; // 63일 연율 변동성
  mdd_1y: number | null;
  corr_spy: number | null;
  cross: { daily: EtfCross; weekly: EtfCross; monthly: EtfCross };
};

export type EtfGroup = { key: string; ko: string; en: string; tickers: string[] };

export type EtfData = {
  generated_at: string;
  as_of: string | null;
  risk_free: string;
  benchmark: string;
  groups: EtfGroup[];
  items: EtfItem[];
};

/** etf.json — ETF_FILE 이 있으면 로컬 파일, 아니면 ETF_URL(기본: GitHub raw). dashboard.json 과 같은 캐시 태그로 같이 비운다. 못 읽으면 null. */
export async function getEtf(): Promise<EtfData | null> {
  try {
    const file = process.env.ETF_FILE;
    if (file) {
      return JSON.parse(await readFile(file, "utf8")) as EtfData;
    }
    const res = await fetch(process.env.ETF_URL || DEFAULT_ETF_URL, {
      next: { revalidate: 1800, tags: [DASHBOARD_TAG] },
    });
    if (!res.ok) {
      console.error(`[etf] ${res.status} ${res.statusText}`);
      return null;
    }
    return (await res.json()) as EtfData;
  } catch (err) {
    console.error("[etf] 읽기 실패", err);
    return null;
  }
}
