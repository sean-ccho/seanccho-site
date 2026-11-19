import { readFile } from "node:fs/promises";
import path from "node:path";
import retro from "@/content/valueModelRetro.json";
import snapshot from "@/content/valueModelSnapshot.json";
import { DASHBOARD_TAG } from "./dashboard";
import { getLiveMark, getVmLiveRaw, newer } from "./live";
import type { LiveMark } from "./types";
import { UNIVERSE_BASE } from "./universe";

/**
 * 내계좌 › 예측 모델 (2026-11-11) — Project_1 web_export/value_model.py 가 매일 밤 universe-data 에 올리는 value_model.json.
 * 리서치 로직(품질 관문 5개 + 가격 관문)을 우리 대상(2026-11-12 부터 미국 상장 + TSX, 시총 US$10억 이상 —
 * 그 전엔 S&P 500 + 리서치 종목)에 적용한 결과 · 리서치 종목 비교 · 앞으로 기록. 출처 이름은 화면에 안 쓴다 (2026-11-16).
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
  alpha_author: number | null; // 리서치식(영구 성장 = 국채금리)
  drop: number | null; // 매수 기준가 ÷ 지금 − 1
  dd_3y: number | null; // 3년 고점 대비
  gates: { roe: Gate; roic: Gate; z: Gate; m: Gate; fcf: Gate; price: Gate };
  fails: string[];
  quality: boolean;
  pass: boolean;
  author: "coverage" | "research" | "screen" | null; // research = 리서치 노트에만 (커버리지 목록에 없음, 2026-11-12)
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
  live?: boolean; // 장중 — 가격 관련 칸이 지금 가격으로 바뀐 줄 (overlayVmLive)
  // 대상 넓히기 (2026-11-12) — 없으면 예전 파일(전부 우리 대상)
  own?: boolean; // 우리 대상(미국 + TSX, 시총 US$10억+) — false = 리서치 종목이라 비교용으로만 계산
  co?: string | null; // 같은 회사 찾기용 키 (리서치 'NAS: RCI' ↔ 우리 대상 TSX 쪽 같은 경우)
  // ROIC 의 부채 · 현금을 자료가 없어 0 으로 계산한 해 수 (2026-11-16 버그 ② 수정 — 빚 없는 회사는 Yahoo 에 줄 자체가 없다).
  // 없으면 전부 자료가 있었던 것.
  fill0?: { debt: number; cash: number; years: number } | null;
  // v3 수석 PM 관문 (2026-11-16) — 없으면 SBC · 희석주식수 자료 준비 중
  pm?: VmPm;
};

/** v3 수석 PM 관문 값 — ① SBC 차감 ② 회사 전체(EV) ③ 자본배분 (④ 업종 쏠림은 포트폴리오 단계). */
export type VmPm = {
  sbc_y: number | null; // 3년 평균 SBC ÷ 시총
  fcf_real_y: number | null; // (FCF − SBC) 3년 평균 ÷ 시총
  alpha_real: number | null; // SBC 차감 알파 (≥ 5%p)
  alpha_bear_real: number | null; // SBC 차감 하방 알파 (≥ 0, 포트폴리오 순서)
  ev_y: number | null; // (FCF − SBC + 세후 이자) ÷ EV
  alpha_ev: number | null; // EV 기준 알파 vs WACC (≥ 5%p)
  dil: number | null; // 최근 2년 희석주식수 연 증가율 (≤ 1%)
  sbc: boolean; ev: boolean; cap: boolean; // 관문 ① ② ③
  pass: boolean; // 시니어 후보 + ①②③ 모두 통과
  gaps: string[]; // 'sbc' = SBC 줄 없음 → 0 · 'shares' = 희석주식수 없음 · 분할로 보임
};

export type VmCoverage = {
  ticker: string; target: number | null; ccy: string; price: number | null; upside: number | null;
  rating?: string | null; // 매주 읽은 커버리지 목록이면 의견 (OVERWEIGHT 등)
};

/**
 * 리서치 노트 (2026-11-12) — 리서치 종목의 두 번째 출처 (첫째는 커버리지 목록). Project_1 value_model.AUTHOR_RESEARCH +
 * 게시일 종가 → 지금 수익률(배당 포함) · 같은 기간 지수 · 목표가까지. 예전 파일에는 없다.
 */
export type VmResearch = {
  slug: string;
  url: string;
  date: string;
  ticker: string;
  kind: string; // 리서치 · 적정가 업데이트 · 특수상황 장문
  view: string; // 리서치 결론
  target: number | null; // 글의 목표가 · 기본 시나리오
  ccy: string;
  bench: string;
  price: number | null;
  ret: number | null;
  bench_ret: number | null;
  excess: number | null;
  upside: number | null;
};

/** 기록 묶음 — ours = v1 통과 · v2 = v2 통과(반증 조건에 걸리면 끝) · v1_top · v2_top = 매달 고른 상위 10 ·
 *  v3 = 수석 PM 10칸 포트폴리오의 종목 (빈칸 SPY 는 줄이 없다) · author = 리서치 종목(커버리지 + 리서치 노트). */
export type VmGroup = "ours" | "v2" | "v1_top" | "v2_top" | "v3" | "author";

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
    // 우리 대상 (2026-11-12) — 없으면 예전 S&P 500 + 리서치 종목
    universe?: { id?: string; mcap_min_usd?: number; markets?: string[]; size?: number; cadusd?: number; by_market?: Record<string, number> };
    beta_min?: number; // 베타 하한 (Project_1 BETA_RANGE[0]) — 없으면 BETA_FLOOR
  };
  funnel: Record<string, number>;
  fetch: Record<string, number>;
  rows: VmRow[];
  author: {
    as_of: string;
    src?: "page" | "code"; // page = 매주 읽은 커버리지 목록, code = 정리해 둔 목록
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
  /** 장중 (2026-11-18) — 가격 관련 칸 · 상위 10 · 통과 수를 지금 가격으로 덮었으면 그 표시 (overlayVmLive). */
  live?: LiveMark | null;
  // v3 수석 PM (2026-11-16) — 없으면 예전 파일
  v3?: {
    params: { slots: number; ind_cap: number; dil_max: number; alpha_min: number; bear_fcf_cut: number };
    top: string[]; // 10칸에 들어간 종목 (SBC 차감 하방 알파 큰 순) — 나머지 칸은 SPY
    ready: boolean; // SBC · 희석주식수 자료가 대상의 95% 이상 → 기록 중
    have: number | null;
    want: number | null;
    start: string | null; // 기록 시작일
  };
};

/**
 * 예측 모델 서브탭 (2026-11-12 밤 정리) — 주소 ?tab=. 분석가 보드(기본 — 주니어 · 시니어 · 수석 PM · 리서치 목록 + 성적표) ·
 * 문서 기록(규칙 · 회고 · 스크린 과거 목록 · 리서치 정리 1~8). 예전 주소(?tab=author · junior · senior · cmp, ?v=…)는 분석가 보드로.
 */
export type VmTab = "board" | "doc";

export const VM_TABS: VmTab[] = ["board", "doc"];

export function vmTab(tab: string | undefined, _v?: string | undefined): VmTab {
  return tab === "doc" ? "doc" : "board";
}

/**
 * 리서치 픽 회고 (2026-11-12, 한 번 계산한 고정 자료 content/valueModelRetro.json) — 리서치 노트가 나온 날로 돌아가
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
  alpha_author: number | null; // 리서치식 영구 성장(= 국채금리)
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

/** vm_live.json 한 줄 — 지금 가격으로 다시 낸 칸 (나머지는 밤 줄 그대로). g_price = 가격 관문. */
export type VmLiveRow = Pick<VmRow, "price" | "fcf_y" | "sh_y" | "irr" | "alpha" | "alpha_author" | "drop" | "implied_g"
  | "gap" | "alpha_bear" | "alpha_b06" | "pass" | "g_bear" | "pass_v2" | "sensitive" | "kill"> & { g_price: boolean };

/** vm_live.json (Project_1 장중 펄스 — value_model.live_model). model_date = 덮어쓸 밤 파일의 날짜. */
export type VmLive = {
  schema: number; generated_at: string; day: string; final: boolean; as_of: string | null; model_date: string;
  rows: Record<string, VmLiveRow>;
  top: { v1: string[]; v2: string[] };
  counts: { pass: number; pass_v2: number; rows: number; priced: number };
};

/**
 * 예측 모델 장중 (2026-11-18, 사용자: '가격 관련 값 전부 장중') — 펄스가 그 밤 모델보다 새 날이고, vm_live 가 그 펄스 날 ·
 * 그 밤 모델로 만든 것일 때만 덮는다 (quotes 날짜 확인과 같은 규칙). 바뀌는 것: 가격 · FCF 수익률 · 알파 · 필요한 하락 ·
 * 시장 가정 성장 · 괴리 · 하방 알파 · 가격 관문 · 주니어/시니어 통과 · 반증 · 상위 10 · 통과 수.
 * 그대로: 품질 관문 · 매수 기준가 · 적정가 범위 · 수석 PM(v3) · 성적표 · 기록 · 가격 관문 통과 수(전체 대상은 밤 파일에 다 없다).
 */
export function overlayVmLive(m: ValueModel, vl: VmLive | null, mark: LiveMark | null): ValueModel {
  if (!vl || !vl.rows || !newer(mark, m.date) || vl.day !== mark.day || vl.model_date !== m.date) return m;
  const rows = m.rows.map((r) => {
    const l = vl.rows[r.ticker];
    if (!l) return r;
    const { g_price, ...rest } = l;
    return { ...r, ...rest, gates: { ...r.gates, price: g_price }, live: true };
  });
  return {
    ...m, rows, live: mark,
    funnel: { ...m.funnel, pass: vl.counts.pass, pass_v2: vl.counts.pass_v2 },
    v2: m.v2 ? { ...m.v2, top: vl.top } : m.v2,
  };
}

/**
 * 밤 실행 결과(live=true) — 없으면 스냅샷(live=false). 파일은 있는데 계산된 종목이 0개면(2026-11-12 밤 — Yahoo 종목 정보가 막혀 513종목 전부 '데이터 없음')
 * 빈 표 대신 스냅샷을 보여 주고 failed = 그 실행 날짜 (탭 줄에 '밤 계산 실패' 표시), failedFunnel = 그 밤 파일의 계산 수
 * (자료 상태 표시 '계산된 종목 0/513', 2026-11-13).
 */
export async function getValueModel(): Promise<{
  model: ValueModel; live: boolean; failed?: string; failedFunnel?: Record<string, number> | null;
}> {
  let failed: string | undefined;
  let failedFunnel: Record<string, number> | null = null;
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
      if ((m.funnel?.computed ?? 0) > 0 && m.rows?.length) {
        const [vl, mark] = await Promise.all([getVmLiveRaw(), getLiveMark()]);
        return { model: overlayVmLive(seniorRule(m), vl as VmLive | null, mark), live: true };
      }
      failed = m.generated?.slice(0, 10) || m.date;
      failedFunnel = m.funnel ?? null;
    }
  } catch {
    // 아래 스냅샷
  }
  return { model: seniorRule(snapshot as unknown as ValueModel), live: false, failed, failedFunnel };
}

/** 시니어 통과 = 주니어 통과 + 하방 관문 + 반증 없음 (2026-11-17). 그 전 밤 파일은 pass_v2 가 반증을 안 봐서 매출 감소에 걸린
 *  VIPS 가 시니어 통과로 나왔다 — 읽을 때 맞춘다 (새 파일은 이미 맞춰져 있어 그대로). */
function seniorRule(m: ValueModel): ValueModel {
  if (!m.rows?.some((r) => r.pass_v2 && r.kill?.length)) return m;
  return { ...m, rows: m.rows.map((r) => (r.pass_v2 && r.kill?.length ? { ...r, pass_v2: false } : r)) };
}

/** 리서치 새 노트 · 커버리지 변경 감지 — Project_1 밤 실행 (매주 한 번, 2026-11-11). 화면엔 제목 · 링크를 안 쓴다. */
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
  coverage_as_of: string; // 코드에 넣어 둔 커버리지 기준일
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

// ── 적정가 범위 (2026-11-17, 예측 모델 페이지에만 · 표시 전용)

/** 2단계 DCF 현재가치 배수 — Project_1 value_model.pv_factor 와 같은 식: 현금 수익률 1 이 years 년 g1, 그 뒤 g2 로 자랄 때
 *  할인율 r 에서의 현재가치. */
export function pvFactor(r: number, g1: number, g2: number, years = 5): number {
  let v = 0;
  let cf = 1;
  for (let t = 1; t <= years; t++) {
    cf *= 1 + g1;
    v += cf / (1 + r) ** t;
  }
  return v + (cf * (1 + g2)) / (r - g2) / (1 + r) ** years;
}

export type FairRange = { low: number; base: number };

/**
 * 적정가 범위 — 기대수익률이 요구수익률(Ke)과 똑같아지는 주가 (알파 0). 매수 기준가는 같은 식을 Ke + 5%p 로 한 값이라 늘 더 낮다.
 * 기본 = 지금 가정 (3년 평균 FCF, 첫 years 년은 매출 성장 g1, 그 뒤 term_g), 하방 = 시니어 하방 관문과 같은 가정
 * (FCF −bearCut · 첫 years 년 성장 0 이하). 가정 하나에 크게 흔들려 목표가로 쓰지 않는다 — 과거 시험에서 '적정가보다 싼'
 * 종목을 사도 SPY 를 이기지 못했다. FCF 가 마이너스이거나 값이 없으면 null.
 */
export function fairRange(r: VmRow, p: { term_g: number; stage1_years: number }, bearCut: number): FairRange | null {
  const { price, fcf_y: y, ke, g1 } = r;
  if (price == null || y == null || ke == null || g1 == null || !(y > 0) || !(ke > p.term_g + 0.005)) return null;
  const years = p.stage1_years || 5;
  const base = price * y * pvFactor(ke, g1, p.term_g, years);
  const low = price * y * (1 - bearCut) * pvFactor(ke, Math.min(g1, 0), p.term_g, years);
  return Number.isFinite(base) && Number.isFinite(low) && base > 0 ? { low, base } : null;
}

// ── 베타 하한 (2026-11-17, 표시 전용)

/** 베타 하한 — Project_1 value_model.BETA_RANGE[0]. 계산한 베타가 이보다 낮으면 이 값으로 자른다 (params.beta_min 이 오면 그 값). */
export const BETA_FLOOR = 0.3;

/**
 * 베타 하한에 걸린 종목인가 — 해운 · 원자재처럼 S&P 와 따로 움직이는 종목은 베타가 0 근처라 하한에서 잘린다. 그러면 요구수익률이
 * 가장 낮게(국채 + 하한 × ERP) 잡혀 적정가 · 매수 기준가가 높게 나온다. 베타가 낮다는 건 S&P 와 같이 안 움직인다는 뜻이지
 * 이익이 안정적이라는 뜻이 아니다 (예: 2026-11 STNG — Yahoo 5년 베타 −0.14, 2016~2021 6년 중 5년 적자).
 */
export function betaAtFloor(r: VmRow | null | undefined, floor = BETA_FLOOR): boolean {
  return r?.beta != null && r.beta <= floor + 1e-6;
}

/** 베타 1(시장 평균 위험)로 다시 계산한 적정가 범위 — 베타 하한 종목 옆에 비교용으로만 보인다. */
export function fairRangeAtBeta1(
  r: VmRow, p: { rf: number; erp: number; term_g: number; stage1_years: number }, bearCut: number,
): FairRange | null {
  return fairRange({ ...r, ke: p.rf + p.erp }, p, bearCut);
}
