// dashboard.json 의 모양 — Project_1 의 src/web_export/dashboard.py 가 만든다 (schema 1).

export type Timeframe = "1H" | "4H" | "Daily" | "Weekly" | "Monthly";

export const TIMEFRAMES: Timeframe[] = ["1H", "4H", "Daily", "Weekly", "Monthly"];

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  "1H": "1시간",
  "4H": "4시간",
  Daily: "일봉",
  Weekly: "주봉",
  Monthly: "월봉",
};

export type Health = {
  score: number | null;
  grade: string | null;
  detail: string | null;
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
};

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
};
