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
  dividend_yield: number | null;
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
  golden?: { rank: number; timeframes: GoldenTf[] } | null; // PT 골든크로스 목록 순위 (시장별, 0 이 맨 위)
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
};
