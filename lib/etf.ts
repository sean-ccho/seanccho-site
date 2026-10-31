import { readFile } from "node:fs/promises";
import { DASHBOARD_TAG } from "./dashboard";

// Project_1 밤 실행(screener.etf_scan)이 dashboard.json 과 같은 브랜치에 올리는 파일 (2026-10-28)
export const DEFAULT_ETF_URL = "https://raw.githubusercontent.com/sean-ccho/Project_1/dashboard-data/etf.json";
// ETF 상세 (설명 · 상위 10개 보유 종목 · 섹터 비중 · 자산 구성 · 채권 등급, 2026-10-29) — 줄을 펼칠 때만 /api/etf 로 받는다
export const DEFAULT_ETF_DETAIL_URL = "https://raw.githubusercontent.com/sean-ccho/Project_1/dashboard-data/etf_detail.json";

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
  top10_weight?: number | null; // 상위 10개 보유 종목 비중 합 (10-29 부터)
  // 상위 10개 보유 종목의 경기순환/방어 × 내수/글로벌 비중 — top = 60% 넘는 칸 · 'mixed'. 아는 종목이 절반 안 되면 null
  // basis: 'full' = 전체 보유 종목 (SEC N-PORT, as_of = 공시 기준일, from = 빌려 온 같은 지수 ETF), 'top10' = 상위 10개 (10-30 부터)
  style_mix?: {
    mix: Record<string, number>;
    top: string;
    covered: number;
    basis?: "full" | "top10";
    as_of?: string | null;
    from?: string;
  } | null;
};

export type EtfGroup = { key: string; ko: string; en: string; tickers: string[] };

/** 같은 지수(same) · 거의 같은 것(similar)을 담는 ETF 묶음. */
export type EtfTwin = { key: string; ko: string; en: string; kind: "same" | "similar"; tickers: string[] };

/** 역할별 기본 1개 — 후보 중 운용자산 10억 이상에서 보수 최저. alts = 나머지 후보 (보수 싼 순). */
export type EtfRole = { key: string; ko: string; en: string; pick: string; alts: string[] };

export type EtfPicks = { roles: EtfRole[]; momentum: string[] };

export type EtfHolding = { s: string; n: string | null; w: number };

export type EtfDetail = {
  desc: string | null; // 영어 (Yahoo) — 캐나다 상장은 없음
  holdings: EtfHolding[]; // 상위 10개 (금 · 가상자산 · 일부 채권은 빈 목록)
  sectors: Record<string, number> | null; // Yahoo 섹터 이름 → 비중
  assets: { stock: number; bond: number; cash: number; other: number } | null;
  ratings: Record<string, number> | null; // 채권 ETF 만 — aaa … below_b · other + us_government(겹침)
};

export type EtfData = {
  generated_at: string;
  as_of: string | null;
  risk_free: string;
  benchmark: string;
  groups: EtfGroup[];
  twins?: EtfTwin[]; // 10-29 부터
  picks?: EtfPicks;
  items: EtfItem[];
};

type EtfDetailFile = { generated_at: string; items: Record<string, EtfDetail> };

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

/** etf_detail.json 에서 ETF 하나 — ETF_DETAIL_FILE 이 있으면 로컬 파일. 없거나 못 읽으면 null. 절대 throw 하지 않는다. */
export async function getEtfDetail(ticker: string): Promise<EtfDetail | null> {
  try {
    const file = process.env.ETF_DETAIL_FILE;
    let data: EtfDetailFile;
    if (file) {
      data = JSON.parse(await readFile(file, "utf8")) as EtfDetailFile;
    } else {
      const res = await fetch(process.env.ETF_DETAIL_URL || DEFAULT_ETF_DETAIL_URL, {
        next: { revalidate: 1800, tags: [DASHBOARD_TAG] },
      });
      if (!res.ok) return null;
      data = (await res.json()) as EtfDetailFile;
    }
    return data.items[ticker] ?? null;
  } catch (err) {
    console.error("[etf] 상세 읽기 실패", err);
    return null;
  }
}
