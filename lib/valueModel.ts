import { readFile } from "node:fs/promises";
import path from "node:path";
import snapshot from "@/content/valueModelSnapshot.json";
import { DASHBOARD_TAG } from "./dashboard";
import { UNIVERSE_BASE } from "./universe";

/**
 * 내계좌 › 예측 모델 (2026-11-11) — Project_1 web_export/value_model.py 가 매일 밤 universe-data 에 올리는 value_model.json.
 * Baoro Research 블로그 로직(품질 관문 5개 + 가격 관문)을 S&P 500 + 저자 커버리지에 적용한 결과와 앞으로 기록.
 * 아직 없거나 못 읽으면 2026-11-11 에 로컬에서 만든 스냅샷(content/valueModelSnapshot.json)을 보여 주고 live=false.
 * 로컬 확인: UNIVERSE_DIR 폴더의 value_model.json.
 */

/** 관문 결과 — true 통과 · false 탈락 · null 판단 불가(자기자본 음수의 ROE 등, 통과로 친다). */
export type Gate = boolean | null;

export type VmRow = {
  ticker: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  ccy: string | null;
  price: number | null;
  buy: number | null; // 매수 기준가 — 가격 관문을 딱 통과하는 주가
  z: number | null; // Altman Z
  m: number | null; // Beneish M
  fcf_years: number | null;
  fetched: string | null; // 재무를 받은 날
  roe: number | null;
  roe_cv: number | null;
  roic: number | null;
  roic_cv: number | null;
  wacc: number | null;
  beta: number | null;
  ke: number | null; // 요구수익률
  g1: number | null; // 첫 5년 성장률
  fcf_y: number | null; // 3년 평균 FCF 수익률
  sh_y: number | null; // 주주환원 수익률
  irr: number | null; // 기대수익률
  alpha: number | null; // 기대수익률 − 요구수익률
  alpha_author: number | null; // 저자식(영구 성장 = 국채금리)
  drop: number | null; // 매수 기준가 ÷ 지금 − 1
  dd_3y: number | null; // 3년 고점 대비
  gates: { roe: Gate; roic: Gate; z: Gate; m: Gate; fcf: Gate; price: Gate };
  fails: string[];
  quality: boolean;
  pass: boolean;
  author: "coverage" | "screen" | null;
  // v2 (schema 2, 2026-11-11) — 없으면 예전 파일
  implied_g?: number | null; // 지금 주가가 가정하는 영구 성장률
  gap?: number | null; // 실제 매출 성장(g1) − 시장 가정 성장
  alpha_bear?: number | null; // FCF −30% · 성장 0 이하에서의 알파
  alpha_b06?: number | null; // 베타 하한 0.6 일 때의 알파
  g_bear?: boolean;
  pass_v2?: boolean;
  sensitive?: boolean; // v1 통과인데 베타 0.6 이면 탈락
  rev_down?: boolean | null; // 최근 분기 · 연간 매출 둘 다 감소
  kill?: string[]; // v2 반증 조건 (걸리면 v2 기록 종료)
};

export type VmCoverage = { ticker: string; target: number; ccy: string; price: number | null; upside: number | null };

/** 기록 묶음 — ours = v1 통과 · v2 = v2 통과(반증 조건에 걸리면 끝) · v1_top · v2_top = 매달 고른 상위 10 · author = 저자 커버리지. */
export type VmGroup = "ours" | "v2" | "v1_top" | "v2_top" | "author";

export type VmTrack = {
  ticker: string;
  group: VmGroup;
  since: string;
  entry: number | null;
  bench: string;
  ret: number | null;
  bench_ret: number | null;
  excess: number | null;
  passing: boolean;
  exit?: string | null; // 끝낸 날 (v2 반증 조건 · 상위 묶음 월 교체)
  reason?: string | null;
};

export type VmSummary = { n: number; ret?: number; excess?: number; beat?: number; open?: number };

export type ValueModel = {
  schema: number;
  date: string;
  generated: string;
  params: {
    rf: number; rf_src: string; erp: number; term_g: number; alpha_min: number; stage1_years: number;
    roe_min: number; roic_min: number; cv_max: number; altman_min: number; beneish_max: number;
  };
  funnel: Record<string, number>;
  fetch: Record<string, number>;
  rows: VmRow[];
  author: { as_of: string; coverage: VmCoverage[]; screen: { ticker: string; date: string }[] };
  tracking: { start: string | null; rows: VmTrack[]; summary: Partial<Record<VmGroup, VmSummary>> };
  v2?: {
    params: { bear_fcf_cut: number; sensitive_beta: number; top_n: number; theme_top: number; theme_warn: number };
    top: { v1: string[]; v2: string[] };
    theme: Record<string, number>; // v2 상위 theme_top 안 업종별 수
  };
};

export type VmView = "v1" | "v2" | "cmp";

export function vmView(v: string | undefined): VmView {
  return v === "v2" || v === "cmp" ? v : "v1";
}

/** 밤 실행 결과(live=true) — 없으면 스냅샷(live=false). */
export async function getValueModel(): Promise<{ model: ValueModel; live: boolean }> {
  try {
    const dir = process.env.UNIVERSE_DIR;
    if (dir) {
      return { model: JSON.parse(await readFile(path.join(dir, "value_model.json"), "utf8")) as ValueModel, live: true };
    }
    const res = await fetch(`${UNIVERSE_BASE}/value_model.json`, { next: { revalidate: 1800, tags: [DASHBOARD_TAG] } });
    if (res.ok) return { model: (await res.json()) as ValueModel, live: true };
  } catch {
    // 아래 스냅샷
  }
  return { model: snapshot as unknown as ValueModel, live: false };
}
