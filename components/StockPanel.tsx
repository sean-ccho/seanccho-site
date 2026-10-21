"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BuyButton } from "./BuyDialog";
import { ChartGrid, ExpandIcon, TF_CODE } from "./ChartGrid";
import { useChartPrefs } from "./ChartPrefs";
import { useT } from "./LangProvider";
import { PatternList, SignalChips } from "./StockChips";
import type { ChartSize } from "./StockControls";
import type { ScreenRow } from "@/lib/dashboard";
import { fmtDate, gradeTone, pct, stockHref, tone, tvUrl, universeHref, usd } from "@/lib/format";
import { healthDetail, sector, term } from "@/lib/i18n";
import type { TickerInfo, Timeframe } from "@/lib/types";

function earningsSoon(info: TickerInfo): boolean {
  return info.days_to_earnings != null && info.days_to_earnings >= 0 && info.days_to_earnings <= 14;
}

function Tile({ label, sub, subTone, children, cls }: {
  label: string;
  sub: React.ReactNode;
  subTone?: "warn";
  children: React.ReactNode;
  cls?: string;
}) {
  return (
    <div className="tile2">
      <dt className="tile2__label">
        {label}
        <span className="tile2__sub" style={subTone === "warn" ? { color: "var(--warn)" } : undefined}>{sub}</span>
      </dt>
      <dd className={`tile2__value num${cls ? ` ${cls}` : ""}`}>{children}</dd>
    </div>
  );
}

/** 핵심 숫자 8칸 (4 × 2) — 적합도·헬스·RSI·20일 / 실적일·매출·이익·순이익률. */
function Tiles({ info }: { info: TickerInfo }) {
  const { lang, t } = useT();
  const S = t.screen;
  const f = info.fundamentals;
  const rsi = info.rsi;
  const soon = earningsSoon(info);
  return (
    <dl className="tiles2">
      <Tile label={t.common.score} sub={term(lang, info.verdict) || "—"} cls="gold">
        ☆ {info.score?.toFixed(1) ?? "—"}
      </Tile>
      <Tile label={t.common.health} sub={S.tileHealthSub}>
        {info.health ? (
          <span className={`badge badge--${gradeTone(info.health.grade)}`}>
            {info.health.score} · {info.health.grade}
          </span>
        ) : (
          "—"
        )}
      </Tile>
      <Tile label="RSI" sub={rsi == null ? "—" : rsi >= 70 ? S.rsiHot : rsi <= 30 ? S.rsiCold : S.rsiMid}
        subTone={rsi != null && rsi >= 70 ? "warn" : undefined} cls={rsi != null && rsi >= 70 ? "warn" : undefined}>
        {rsi?.toFixed(0) ?? "—"}
      </Tile>
      <Tile label={t.common.ret20} sub={S.ret5(pct(info.ret_5d))} cls={tone(info.ret_20d)}>
        {pct(info.ret_20d)}
      </Tile>
      <Tile label={t.common.nextEarnings}
        sub={soon ? t.common.earningsSoon : info.days_to_earnings != null && info.earnings_date ? S.earningsIn(info.days_to_earnings) : "—"}
        subTone={soon ? "warn" : undefined} cls={soon ? "warn" : undefined}>
        {info.earnings_date ? fmtDate(info.earnings_date, lang) : t.common.tbd}
      </Tile>
      <Tile label={t.stock.revenueGrowth} sub={S.growthSub} cls={tone(f?.revenue_growth)}>
        {pct(f?.revenue_growth)}
      </Tile>
      <Tile label={t.stock.earningsGrowth} sub={S.growthSub} cls={tone(f?.earnings_growth)}>
        {pct(f?.earnings_growth)}
      </Tile>
      <Tile label={t.stock.profitMargin} sub={S.marginSub}>
        {pct(f?.profit_margin, 1, false)}
      </Tile>
    </dl>
  );
}

/** 일·주·월봉 패턴 세 칸 (▲ 상승 · ▼ 하락 · ◆ 중립). */
function Patterns({ info }: { info: TickerInfo }) {
  const { t } = useT();
  const rows = [
    { label: t.common.dailyPatterns, list: info.patterns.daily },
    { label: t.common.weeklyPatterns, list: info.patterns.weekly },
    { label: t.common.monthlyPatterns, list: info.patterns.monthly },
  ];
  return (
    <div className="sp-patterns">
      {rows.map((r) => (
        <div key={r.label} className="sp-pat">
          <span className="sp-pat__label">{r.label}</span>
          <span className="sp-pat__v"><PatternList list={r.list} /></span>
        </div>
      ))}
    </div>
  );
}

/** '쭉 내려 보기'용 한 줄 요약 — 타일 대신 칩으로 (종목이 많아도 덜 길게). */
function CompactChips({ ticker, info }: { ticker: string; info: TickerInfo }) {
  const { lang, t } = useT();
  const soon = earningsSoon(info);
  return (
    <>
      <div className="chart-meta">
        <span className="chip">
          {t.common.score} <span className="num gold" style={{ fontWeight: 600 }}>☆ {info.score?.toFixed(1) ?? "—"}</span>
        </span>
        {info.health && (
          <span className={`badge badge--${gradeTone(info.health.grade)}`}>{t.charts.healthChip(info.health.score, info.health.grade)}</span>
        )}
        <span className="chip">
          RSI{" "}
          <span className="num" style={{ fontWeight: 600, color: (info.rsi ?? 0) >= 70 ? "var(--warn)" : "var(--ink)" }}>
            {info.rsi?.toFixed(0) ?? "—"}
          </span>
        </span>
        <span className="chip" style={soon ? { color: "var(--warn)", borderColor: "var(--warn)" } : undefined}>
          {t.charts.earnings} {info.earnings_date ? fmtDate(info.earnings_date, lang) : t.common.tbd}
          {info.days_to_earnings != null && info.earnings_date ? ` ${t.common.inDays(info.days_to_earnings)}` : ""}
        </span>
        <SignalChips ticker={ticker} info={info} />
      </div>
      <div className="sp-patline small">
        <span><span className="muted">{t.common.dailyPatterns}</span> <PatternList list={info.patterns.daily} /></span>
        <span><span className="muted">{t.common.weeklyPatterns}</span> <PatternList list={info.patterns.weekly} /></span>
        {info.patterns.monthly.length > 0 && (
          <span><span className="muted">{t.common.monthlyPatterns}</span> <PatternList list={info.patterns.monthly} /></span>
        )}
      </div>
    </>
  );
}

/** 멀티차트 칸 — 고른 봉 태그 · TradingView · 전체 화면(되는 브라우저만). */
function ChartPanel({ ticker, row, tfs, size }: { ticker: string; row: ScreenRow; tfs: Timeframe[]; size: ChartSize }) {
  const { t } = useT();
  const { mode } = useChartPrefs();
  const S = t.screen;
  const ref = useRef<HTMLDivElement>(null);
  const [canFull, setCanFull] = useState(false);
  const [isFull, setIsFull] = useState(false);

  // 아이폰 사파리처럼 요소 전체 화면이 안 되는 브라우저에서는 버튼을 숨긴다 (서버 렌더는 숨긴 채로)
  useEffect(() => {
    setCanFull(Boolean(document.fullscreenEnabled));
    const sync = () => setIsFull(document.fullscreenElement != null && document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void ref.current?.requestFullscreen().catch(() => setCanFull(false));
  };

  return (
    <div className="sp-charts" ref={ref}>
      <div className="sp-charts__head">
        <h3>{S.chartsTitle}</h3>
        <span className="sp-charts__tfs">
          {tfs.map((k) => (
            <span key={k} className="tf-tag">{TF_CODE[k]}</span>
          ))}
        </span>
        <span className="tiny muted sp-charts__sub">{mode === "live" ? S.chartsSubLive : S.chartsSub}</span>
        <span className="sp-charts__tools">
          <a className="btn btn--small" href={tvUrl(ticker, row.info?.tv)} target="_blank" rel="noopener noreferrer">
            TradingView ↗
          </a>
          {canFull && (
            <button type="button" className="btn btn--small" onClick={toggleFull} aria-pressed={isFull}>
              {isFull ? S.exitFullscreen : S.fullscreen} <ExpandIcon shrink={isFull} />
            </button>
          )}
        </span>
      </div>
      <ChartGrid key={ticker} ticker={ticker} images={row.images} tfs={tfs} info={row.info} size={size} />
    </div>
  );
}

/** 종목 한 개 — '한 종목씩'(오른쪽 상세: 타일·패턴 칸) · '쭉 내려 보기'(칩 한 줄) 둘 다 같은 머리와 차트. */
export function StockPanel({ row, mode, tfs, size, showMarket, headingId, detail }: {
  row: ScreenRow;
  mode: "deck" | "stack";
  tfs: Timeframe[];
  size: ChartSize;
  showMarket: boolean;
  headingId: string;
  /** 제목 티커를 상세 페이지로 (전체분석 안 — 그 밖의 화면에서는 전체분석으로). */
  detail?: boolean;
}) {
  const { lang, t } = useT();
  const S = t.screen;
  const info = row.info;
  const facts = info
    ? [sector(lang, info.sector), info.market_cap && t.common.marketCap(info.market_cap)].filter(Boolean).join(" · ")
    : "";
  return (
    <>
      <div className="sp-head">
        <div className="sp-id">
          <h2 id={headingId} className="sp-ticker">
            <Link href={(!detail && universeHref(row.ticker)) || stockHref(row.ticker)}>{row.ticker}</Link>
          </h2>
          {info?.company && <span className="sp-company">{info.company}</span>}
          {row.held && <span className="badge badge--held">{t.common.held}</span>}
          {info?.listed_days != null && <span className="chip">{t.universe.listed(info.listed_days)}</span>}
          {showMarket && row.market && (
            <span className="chip">{row.market === "sp500" ? "S&P 500" : term(lang, "나스닥·NYSE")}</span>
          )}
        </div>
        {info?.price != null && (
          <div className="sp-price">
            <span className="num sp-price__v">{usd(info.price)}</span>
            {info.ret_20d != null && (
              <span className={`num sp-price__chg ${tone(info.ret_20d)}`}>
                {info.ret_20d > 0 ? "▲" : info.ret_20d < 0 ? "▼" : ""} {pct(info.ret_20d)} <span className="muted">{S.d20}</span>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="sp-meta">
        <span className="sp-meta__facts">
          {facts && <span>{facts}</span>}
          {info?.strategy && <span className="sp-meta__strat">{term(lang, info.strategy)}</span>}
          {info?.action && <span className="badge badge--good">{term(lang, info.action)}</span>}
        </span>
        <span className="sp-actions">
          <Link className="link-strong small" href={stockHref(row.ticker)}>
            {t.common.details}
          </Link>
          <BuyButton ticker={row.ticker} info={info} />
        </span>
      </div>

      {!info && <p className="small muted" style={{ margin: "8px 0 0" }}>{t.charts.noSummary}</p>}

      {info && mode === "deck" && (
        <>
          <Tiles info={info} />
          <div className="sp-signals">
            <div className="chart-meta" style={{ marginTop: 0 }}>
              <SignalChips ticker={row.ticker} info={info} />
            </div>
            {info.health?.detail && (
              <span className="sp-fin">
                {t.common.financials}: {healthDetail(lang, info.health.detail)}
              </span>
            )}
          </div>
          <Patterns info={info} />
        </>
      )}
      {info && mode === "stack" && <CompactChips ticker={row.ticker} info={info} />}

      <ChartPanel ticker={row.ticker} row={row} tfs={tfs} size={size} />
    </>
  );
}
