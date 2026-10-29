// dashboard.json 의 모양 — Project_1 의 src/web_export/dashboard.py 가 만든다 (schema 1).

export type Timeframe = "1H" | "4H" | "Daily" | "Weekly" | "Monthly";

export const TIMEFRAMES: Timeframe[] = ["1H", "4H", "Daily", "Weekly", "Monthly"];

export type Health = {
  score: number | null;
  grade: string | null;
  detail: string | null;
};

/** yfinance 값 그대로 — 성장률·마진·ROE·비중은 0.165 = 16.5%, 부채비율은 % (32 = 0.32배), 현금흐름·시총은 달러. */
export type Fundamentals = {
  revenue_growth: number | null;
  earnings_growth: number | null;
  gross_margin: number | null;
  profit_margin: number | null;
  roe: number | null;
  debt_to_equity: number | null;
  current_ratio: number | null;
  free_cashflow: number | null;
  operating_cashflow: number | null;
  market_cap: number | null;
  // 배당 둘은 yfinance 정보가 아니라 일봉 배당 기록으로 계산 — 최근 1년 실제로 준 것 (0 = 그동안 배당 없음)
  dividend_yield: number | null; // 1년 배당 합계 ÷ 지금 가격 (0.064 = 6.4%)
  annual_dividend?: number | null; // 1주당 1년 배당 합계 (달러) — 2026-10-29 실행부터
  short_pct_float: number | null;
  institutional_pct: number | null;
};

/** openinsider 90일 요약. signal 이 null 이면 그 기간 거래 없음. */
export type Insider = {
  buys: number;
  sells: number;
  net_value: number | null;
  last_date: string | null;
  signal: "cluster_buy" | "buy" | "sell" | null;
};

export type TickerInfo = {
  company: string | null;
  market: string | null;
  sector: string | null;
  price: number | null;
  strategy: string | null;
  score: number | null;
  verdict: string | null;
  action: string | null;
  health: Health | null;
  market_cap: string | null;
  rsi: number | null;
  ret_5d: number | null;
  ret_20d: number | null;
  earnings_date: string | null;
  days_to_earnings: number | null;
  patterns: { daily: string[]; weekly: string[]; monthly: string[] };
  // 아래는 2026-10-16 부터 — 그 전 dashboard.json 에는 없다
  position_52w?: number | null;
  atr_pct?: number | null;
  rel_market?: number | null;
  rel_sector?: number | null;
  fundamentals?: Fundamentals;
  insider?: Insider | null;
  vol_ratio?: number | null; // 오늘 거래량 ÷ 20일 평균
  ma_gap?: { daily: number | null; weekly: number | null; monthly: number | null };
  // 예고 — 진행 중인 주·월봉이 지금 가격으로 끝나면 바뀌는 교차 라벨 ('골든크로스' 등, 2026-10-28 부터). 표시 전용 (필터 · 점수에 안 씀)
  preview?: { weekly: string | null; monthly: string | null };
  golden?: { rank: number; timeframes: GoldenTf[] } | null; // PT 골든크로스 목록 순위 (시장별, 0 이 맨 위)
  sec_flags?: SecFlag[]; // SEC 공시 경고 (2026-10-17 부터, Project_1 screener/sec_filings.py)
  short?: ShortInfo | null; // 공매도 (FINRA, 2026-10-17 부터)
  squeeze?: "fire" | "fuel" | null; // 숏스퀴즈 감시 상태
  isb?: IsbInfo | null; // ISB 라벨 최근 날짜 (2026-10-20 부터, Project_1 web_export/isb_signals.py) — {} = 계산했지만 최근 없음
  sqzmom?: SqzInfo | null; // SQZ 모멘텀 일·주·월 (2026-10-20 부터, Project_1 web_export/sqz_signals.py) — 표시 전용
  // 아래는 전체분석(universe-data, Project_1 run_universe_scan.py)에만 있다
  tv?: string | null; // TradingView 심볼 (거래소 접두어 포함, 예: NASDAQ:AAPL)
  first_date?: string; // 신규 상장 — 첫 거래일 (일봉 120개 미만이라 점수가 없다)
  listed_days?: number | null; // 신규 상장 — 상장 후 거래일 수
  ret_since_listing?: number | null; // 신규 상장 — 첫날 종가 대비
};

/** TradingView 'Squeeze Momentum [LazyBear]' (기본값) — 숏스퀴즈(squeeze)와 다른 것. */
export type SqzTf = "D" | "W" | "M";
export type SqzDot = "black" | "gray" | "blue"; // 검은 십자 = 스퀴즈 중 · 회색 = 풀림 · 파랑 = 둘 다 아님
export type SqzColor = "lime" | "green" | "red" | "maroon" | ""; // 막대 색 (값이 아직 없으면 "")
/**
 * 마지막 끝난 봉 기준. run = 검은 십자가 그 봉까지 몇 봉째 (검정 아니면 0), val_pct = 막대 값 ÷ 종가 × 100.
 * color_run = 막대가 지금 색으로 몇 봉째 (2026-10-21 부터 — 그 전 데이터엔 없음).
 * fire = 최근 3봉 안 검은 십자 → 회색 (ago 0 = 마지막 끝난 봉, run = 풀리기 전 눌린 봉 수, color = 풀린 봉 막대 색).
 * lime = 최근 3봉 안 눌린 채로 막대가 연두로 바뀐 봉. live = 아직 안 끝난 이번 주·이번 달 봉 (일봉은 없음). 없으면 키가 빠진다.
 */
export type SqzState = {
  date: string;
  dot: SqzDot;
  run: number;
  color: SqzColor;
  color_run?: number;
  val: number | null;
  val_pct: number | null;
  fire?: { ago: number; run: number; color: SqzColor };
  lime?: { ago: number };
  live?: { date: string; dot: SqzDot; color: SqzColor; val: number | null };
};
export type SqzInfo = Partial<Record<SqzTf, SqzState>>;

/** TradingView ISB(Institutional Buy & Sell) 차트 라벨 — BUY·REV · ◇ BOTTOM · ◆ TOP · EXIT. */
export type IsbLabel = "rev" | "bottom" | "top" | "exit";
/** 그 라벨이 마지막으로 찍힌 봉 — date = 봉의 마지막 거래일, ago = 마지막 끝난 봉에서 몇 봉 전 (0 = 그 봉). */
export type IsbHit = { date: string; ago: number };
/** D = 일봉(최근 63봉 안), W = 주봉(최근 26봉 안). 라벨이 없는 주기·라벨은 빠진다. */
export type IsbInfo = { D?: Partial<Record<IsbLabel, IsbHit>>; W?: Partial<Record<IsbLabel, IsbHit>> };

/** 공매도 — pct 는 유통주식 대비(0.18 = 18%), dtc = 되사기 일수(공매도 잔고 ÷ 하루 평균 거래량), settle = FINRA 결제일. */
export type ShortInfo = { pct: number | null; dtc: number | null; change: number | null; settle: string | null; high: boolean };

export type SqueezeItem = {
  ticker: string;
  name: string | null;
  status: "fire" | "fuel";
  price: number | null;
  short_pct: number | null;
  short_basis: string | null; // float(유통주식 대비) · shares_out(발행주식 대비)
  dtc: number | null;
  si_change: number | null; // 직전 보고 대비 공매도 잔고 변화
  ret_5d: number | null;
  vol_ratio: number | null;
};

/** SEC 공시 경고 하나 — 같은 종류는 가장 최근 공시 기준으로 묶여 있다. */
export type SecFlag = {
  code: string; // restatement · delisting · bankruptcy · late_filing · auditor · offering · officer · insider_sale_plan · listing_transfer
  label: string; // 한국어 이름 (Project_1 이 붙임)
  severity: "red" | "orange" | "yellow";
  date: string; // 가장 최근 공시일 YYYY-MM-DD
  form: string;
  count: number; // 기간 안 건수
  url: string; // SEC 공시 폴더
};

/** gap < 0 이면 교차 임박 (단기 MA 가 장기 MA 아래 5% 이내), ≥ 0 이면 방금 교차. */
export type GoldenTf = { tf: "daily" | "weekly" | "monthly"; gap: number | null };

export type GoldenItem = { ticker: string; timeframes: GoldenTf[] };

export type ExitLevels = {
  up: number | null;
  up_tag: string | null;
  down: number | null;
  down_tag: string | null;
  next: { day: number; side: "up" | "down"; price: number | null; tag: string } | null;
};

export type Position = {
  ticker: string;
  company: string | null;
  sector: string | null;
  strategy: string | null;
  star_rating: string | null;
  entry_date: string;
  entry_price: number;
  highest_price: number | null;
  price: number | null;
  return: number | null;
  days_held: number;
  shares: number | null;
  value: number | null;
  spy_return: number | null;
  defer_count: number;
  exit: ExitLevels;
  health: Health | null;
  market_cap: string | null;
};

export type TradeHistoryItem = {
  ticker: string;
  exit_date: string;
  return: number;
  exit_reason: string | null;
};

export type TradeSummary = {
  count: number;
  wins: number;
  win_rate: number | null;
  avg_return: number | null;
  first_entry: string | null;
  by_reason: { reason: string; count: number; avg_return: number }[];
  history: TradeHistoryItem[];
  recent: {
    ticker: string;
    entry_date: string;
    exit_date: string;
    return: number | null;
    exit_reason: string | null;
    strategy: string | null;
    holding_days: number | null;
  }[];
};

export type CurvePoint = { date: string; equity: number | null; spy: number | null };

export type DollarAccount = {
  initial: number;
  start: string;
  equity: number | null;
  return: number | null;
  spy_equity: number | null;
  spy_return: number | null;
  cash: number | null;
  realized: number | null;
  unrealized: number | null;
  mdd: number | null;
  spy_mdd: number | null;
  curve: CurvePoint[];
};

export type Account = {
  key: string;
  label: string;
  positions: Position[];
  trades: TradeSummary;
  dollar: DollarAccount | null;
  /** 청산 거래 전부 (최근 먼저) — 거래로그 페이지 (2026-10-17 부터). */
  log?: TradeLogItem[];
  /** 시트 거래로그 탭과 같은 매수·매도 줄 (2026-10-17 부터). */
  sheet_log?: SheetLogRow[];
};

export type TradeLogItem = {
  ticker: string;
  sector: string | null;
  strategy: string | null;
  star: string | null;
  ccs: number | null;
  entry_date: string;
  exit_date: string;
  entry_price: number | null;
  exit_price: number | null;
  return: number | null;
  holding_days: number | null;
  exit_reason: string | null;
  spy_return: number | null;
  vs_spy: number | null;
  // $5,000 계좌 기준 (2026-10-17 부터) — return·vs_spy 도 이 기준 (편도 0.1% 포함)
  shares?: number | null;
  cost?: number | null;
  proceeds?: number | null;
  pnl?: number | null;
  cash_after?: number | null;
};

/** 구글 시트 거래로그 탭과 같은 줄 ($5,000 계좌 기준, 계좌 배분 순서). */
export type SheetLogRow = {
  date: string;
  side: "buy" | "sell";
  ticker: string;
  sector: string;
  shares: number;
  price: number | null;
  amount: number | null;
  pnl: number | null;
  ret: number | null;
  days: number | null;
  cash_after: number | null;
  strategy: string | null;
  star: string;
  ccs: number | null;
  reason: string;
  spy: number | null;
  vs_spy: number | null;
};

/** 전체차트 — 이미지만 (종목 정보는 stocks 맵). */
export type AllChartMarket = {
  key: string;
  label: string;
  captured_at: string | null;
  items: { ticker: string; held: boolean; images: ChartImages }[];
};

export type Candidate = TickerInfo & { ticker: string; held: boolean };

export type ChartImages = Partial<Record<Timeframe, string>>;

export type ChartItem = {
  ticker: string;
  held: boolean;
  info: TickerInfo | null;
  images: ChartImages;
};

export type ChartMarket = {
  key: string;
  label: string;
  captured_at: string | null;
  items: ChartItem[];
};

export type Dashboard = {
  schema: number;
  generated_at: string;
  bar_date: string | null;
  price_date: string | null;
  repo: string;
  max_positions: number;
  accounts: Account[];
  candidates: Candidate[];
  charts: ChartMarket[];
  /** 후보·보유·차트 종목의 정보 (종목 상세 페이지용, 2026-10-16 부터). */
  stocks?: Record<string, TickerInfo>;
  /** 시장별 PT 골든크로스 목록 (2026-10-16 부터). */
  golden_cross?: Record<string, GoldenItem[]>;
  /** SPY 배당 조정 일봉 종가 6년 — 매매일지·내계좌의 '같은 기간 SPY' (2026-10-16 부터). */
  benchmark?: Benchmark | null;
  /** 전체차트 — 두 분석 시트의 모든 종목 (2026-10-17 부터). */
  all_charts?: AllChartMarket[];
  /** 숏스퀴즈 감시 (🔥 진행 가능 · 대기, 2026-10-17 부터). */
  squeeze?: { settle: string | null; items: SqueezeItem[] };
};

export type Benchmark = { ticker: string; closes: [string, number][] };

/** 전체분석 — 필터 없이 시장 전체 (Project_1 universe-data 브랜치, 브라우저가 직접 받는다). */
export type UniverseKey = "sp500" | "nasdaq" | "new";
/** 전체분석 위 탭 — all = S&P 500 + 나스닥·NYSE 를 합쳐서 (파일은 시장마다 따로). */
export type UniverseTab = "all" | UniverseKey;

export type UniverseMarket = {
  schema: number;
  generated_at: string;
  bar_date: string | null;
  key: UniverseKey;
  label: string;
  counts: { listed: number; analyzed?: number; young?: number; no_data?: number };
  golden: GoldenItem[];
  items: Record<string, TickerInfo>;
};
