import { readFile } from "node:fs/promises";
import path from "node:path";
import retro from "@/content/valueModelRetro.json";
import snapshot from "@/content/valueModelSnapshot.json";
import { DASHBOARD_TAG } from "./dashboard";
import { UNIVERSE_BASE } from "./universe";

/**
 * 내계좌 › 예측 모델 (2026-11-11) — Project_1 web_export/value_model.py 가 매일 밤 universe-data 에 올리는 value_model.json.
 * Baoro Research 블로그 로직(품질 관문 5개 + 가격 관문)을 우리 대상(2026-11-12 부터 미국 상장 + TSX, 시총 US$10억 이상 —
 * 그 전엔 S&P 500 + 저자 종목)에 적용한 결과 · 저자 종목 비교 · 앞으로 기록.
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
  author: "coverage" | "research" | "screen" | null; // research = 저자 리서치 글에만 (커버리지 페이지에 없음, 2026-11-12)
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
  // 대상 넓히기 (2026-11-12) — 없으면 예전 파일(전부 우리 대상)
  own?: boolean; // 우리 대상(미국 + TSX, 시총 US$10억+) — false = 저자 종목이라 비교용으로만 계산
  co?: string | null; // 같은 회사 찾기용 키 (저자 'NAS: RCI' ↔ 우리 대상 TSX 쪽 같은 경우)
};

export type VmCoverage = {
  ticker: string; target: number | null; ccy: string; price: number | null; upside: number | null;
  rating?: string | null; // 저자 사이트에서 읽은 목록이면 의견 (OVERWEIGHT 등)
};

/**
 * 저자 심층 리서치 글 (2026-11-12) — 저자 종목의 두 번째 출처 (첫째는 Coverage 페이지). Project_1 value_model.AUTHOR_RESEARCH +
 * 게시일 종가 → 지금 수익률(배당 포함) · 같은 기간 지수 · 목표가까지. 예전 파일에는 없다.
 */
export type VmResearch = {
  slug: string;
  url: string;
  date: string;
  ticker: string;
  kind: string; // 리서치 · 적정가 업데이트 · 특수상황 장문
  view: string; // 저자 결론
  target: number | null; // 글의 목표가 · 기본 시나리오
  ccy: string;
  bench: string;
  price: number | null;
  ret: number | null;
  bench_ret: number | null;
  excess: number | null;
  upside: number | null;
};

/** 기록 묶음 — ours = v1 통과 · v2 = v2 통과(반증 조건에 걸리면 끝) · v1_top · v2_top = 매달 고른 상위 10 · author = 저자 종목(커버리지 + 리서치 글). */
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
    // 우리 대상 (2026-11-12) — 없으면 예전 S&P 500 + 저자 종목
    universe?: { id?: string; mcap_min_usd?: number; markets?: string[]; size?: number; cadusd?: number; by_market?: Record<string, number> };
  };
  funnel: Record<string, number>;
  fetch: Record<string, number>;
  rows: VmRow[];
  author: {
    as_of: string;
    src?: "page" | "code"; // page = 저자 사이트 Coverage 페이지에서 매주 읽은 목록, code = 정리해 둔 목록
    coverage: VmCoverage[];
    screen: { ticker: string; date: string }[];
    research?: VmResearch[];
  };
  tracking: {
    start: string | null;
    rows: VmTrack[];
    summary: Partial<Record<VmGroup, VmSummary>>;
    warmup?: { have: number; want: number } | null; // 기록 준비 중 — 대상 재무를 95% 받기 전
  };
  v2?: {
    params: { bear_fcf_cut: number; sensitive_beta: number; top_n: number; theme_top: number; theme_warn: number };
    top: { v1: string[]; v2: string[] };
    theme: Record<string, number>; // v2 상위 theme_top 안 업종별 수
  };
};

/**
 * 예측 모델 서브탭 (2026-11-12 밤 정리) — 주소 ?tab=. 세 분석가(기본 — 주니어 · 시니어 · 저자 목록 + 성적표) · 문서 기록
 * (규칙 · 회고 · A-Series · 블로그 정리 1~8). 예전 주소(?tab=author · junior · senior · cmp, ?v=v1 · v2 · cmp)는 세 분석가로.
 */
export type VmTab = "board" | "doc";

export const VM_TABS: VmTab[] = ["board", "doc"];

export function vmTab(tab: string | undefined, _v?: string | undefined): VmTab {
  return tab === "doc" ? "doc" : "board";
}

/**
 * 저자 픽 회고 (2026-11-12, 한 번 계산한 고정 자료 content/valueModelRetro.json) — 저자가 글을 올린 날로 돌아가
 * 그날까지 공개된 연간 재무(결산 + 60일, 캐나다 90일) · 그날 주가 · 베타 · 국채금리로 v1 · v2 를 다시 돌린 결과.
 */
export type RetroEvent = {
  ticker: string;
  date: string;
  kind: string;
  years: number; // 그날 쓸 수 있던 연간 재무 해 수
  price: number | null;
  buy: number | null;
  alpha: number | null;
  alpha_author: number | null; // 저자식 영구 성장(= 국채금리)
  alpha_bear: number | null;
  beta: number;
  rf: number;
  gates: { roe: Gate; roic: Gate; z: Gate; m: Gate; fcf: Gate; price: Gate; bear: Gate };
  fails: string[];
  quality: boolean;
  pass: boolean;
  pass_v2: boolean;
  pass_nocv: boolean; // 변동계수 조건만 뺐을 때
  ret: number | null; // 그날 → prices_to (배당 포함)
  bench: string;
  bench_ret: number | null;
  excess: number | null;
  note: string;
};

/** 매달 1일 결과 — cells 한 글자 = 한 달: V 시니어 통과 · P 주니어만 · q 품질만 · $ 가격만 · . 둘 다 탈락 · - 재무 부족. */
export type RetroGrid = { ticker: string; group: "coverage" | "research" | "screen"; cells: string; posted: string[] };

export type ValueModelRetro = {
  schema: number;
  made: string;
  prices_to: string;
  months: string[];
  events: RetroEvent[];
  grid: RetroGrid[];
  method: { lag_us: number; lag_ca: number; years_now: number };
};

export const VM_RETRO = retro as unknown as ValueModelRetro;

/**
 * 밤 실행 결과(live=true) — 없으면 스냅샷(live=false). 파일은 있는데 계산된 종목이 0개면(2026-11-12 밤 — Yahoo 종목 정보가 막혀 513종목 전부 '데이터 없음')
 * 빈 표 대신 스냅샷을 보여 주고 failed = 그 실행 날짜 (탭 줄에 '밤 계산 실패' 표시).
 */
export async function getValueModel(): Promise<{ model: ValueModel; live: boolean; failed?: string }> {
  let failed: string | undefined;
  try {
    const dir = process.env.UNIVERSE_DIR;
    let m: ValueModel | null = null;
    if (dir) {
      m = JSON.parse(await readFile(path.join(dir, "value_model.json"), "utf8")) as ValueModel;
    } else {
      const res = await fetch(`${UNIVERSE_BASE}/value_model.json`, { next: { revalidate: 1800, tags: [DASHBOARD_TAG] } });
      if (res.ok) m = (await res.json()) as ValueModel;
    }
    if (m) {
      if ((m.funnel?.computed ?? 0) > 0 && m.rows?.length) return { model: m, live: true };
      failed = m.generated?.slice(0, 10) || m.date;
    }
  } catch {
    // 아래 스냅샷
  }
  return { model: snapshot as unknown as ValueModel, live: false, failed };
}

/** 저자 블로그 새 글 · 커버리지 변경 감지 — Project_1 web_export/blog_watch.py (매주 한 번, 2026-11-11). */
export type BlogPost = { slug: string; url: string; title: string; lastmod: string; seen?: string | null };

export type BlogCoverageDiff = {
  added: { ticker: string; exch?: string; symbol?: string; rating?: string | null; target?: number | null }[];
  removed: { ticker: string; target?: number | null }[];
  target: { ticker: string; ours: number; now: number }[];
  rating: { ticker: string; before: string; now: string }[];
};

export type BlogWatch = {
  schema: number;
  checked: string | null; // 마지막으로 사이트맵 · 커버리지를 둘 다 받은 날 (온타리오)
  attempted: string | null;
  next: string | null;
  every_days: number;
  analyzed_as_of: string;
  analyzed_posts: number; // 위 1~8절에 정리한 글 수
  coverage_as_of: string; // 코드에 넣어 둔 저자 커버리지 기준일
  posts_total: number;
  new_posts: BlogPost[]; // 정리 안 된 새 글
  edited_posts: BlogPost[]; // 정리한 뒤 고친 글
  coverage_diff: BlogCoverageDiff | null;
  errors: string[];
  blog_url: string;
  coverage_url: string;
};

/** 밤 실행 결과 — 아직 없으면(첫 확인 전) null. */
export async function getBlogWatch(): Promise<BlogWatch | null> {
  try {
    const dir = process.env.UNIVERSE_DIR;
    if (dir) return JSON.parse(await readFile(path.join(dir, "blog_watch.json"), "utf8")) as BlogWatch;
    const res = await fetch(`${UNIVERSE_BASE}/blog_watch.json`, { next: { revalidate: 1800, tags: [DASHBOARD_TAG] } });
    if (res.ok) return (await res.json()) as BlogWatch;
  } catch {
    // 아래 null
  }
  return null;
}
