import { readFile } from "node:fs/promises";
import { DASHBOARD_TAG } from "./dashboard";

// 오늘 탭 '경기 상태 · 금리 결정' (2026-10-30) — Project_1 screener/macro_scan.py 가 밤마다 만드는 macro.json.
export const DEFAULT_MACRO_URL = "https://raw.githubusercontent.com/sean-ccho/Project_1/dashboard-data/macro.json";

export type MacroStatus = "good" | "watch" | "bad";
export type MacroKey = "sahm" | "claims" | "curve" | "hy" | "spy200" | "cycdef";

/** 지표 하나. value · extra 의 뜻은 key 마다 다르다 (macro_scan.ind_*). history = 작은 차트용 [날짜, 값]. */
export type MacroIndicator = {
  key: MacroKey;
  group: "economy" | "market";
  date: string;
  value: number | null;
  extra: Record<string, number | string | null>;
  status: MacroStatus;
  history: [string, number][];
};

export type RateDecision = "hike" | "hold" | "cut" | "upcoming" | "pending";

/** FOMC 회의 — upper/lower = 결정 뒤 목표 범위 (예정 · 결과 대기면 null). sep = 경제 전망 같이 발표. */
export type FomcMeeting = {
  date: string;
  start: string;
  sep: boolean;
  url: string;
  decision: RateDecision;
  change_bp: number | null;
  upper: number | null;
  lower: number | null;
};

/** BoC 발표 — rate = 결정 뒤 기준금리. mpr = 통화정책보고서 같이 발표. */
export type BocMeeting = {
  date: string;
  mpr: boolean;
  url: string;
  decision: RateDecision;
  change_bp: number | null;
  rate: number | null;
};

export type MacroData = {
  schema: number;
  generated_at: string;
  as_of: string;
  indicators: MacroIndicator[];
  rates: {
    fomc?: { current: { upper: number; lower: number; date: string } | null; next: FomcMeeting | null; meetings: FomcMeeting[] };
    boc?: { current: { rate: number; date: string } | null; next: BocMeeting | null; meetings: BocMeeting[] };
  };
  errors: string[];
};

/** macro.json — MACRO_FILE 이 있으면 로컬 파일. 없거나 못 읽으면 null. 절대 throw 하지 않는다. */
export async function getMacro(): Promise<MacroData | null> {
  try {
    const file = process.env.MACRO_FILE;
    if (file) return JSON.parse(await readFile(file, "utf8")) as MacroData;
    const res = await fetch(process.env.MACRO_URL || DEFAULT_MACRO_URL, {
      next: { revalidate: 1800, tags: [DASHBOARD_TAG] },
    });
    if (!res.ok) {
      console.error(`[macro] ${res.status} ${res.statusText}`);
      return null;
    }
    return (await res.json()) as MacroData;
  } catch (err) {
    console.error("[macro] 읽기 실패", err);
    return null;
  }
}

/** 오늘(토론토)부터 그 날까지 며칠 — 지났으면 음수. */
export function daysUntil(iso: string, today: string): number {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
