"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { BuyButton } from "./BuyDialog";
import { ChartGrid } from "./ChartGrid";
import { InsiderBadge } from "./InsiderBadge";
import { useT } from "./LangProvider";
import { SignalChips } from "./StockChips";
import { StockControls, useStockList } from "./StockControls";
import { bigUsd, fmtDate, gradeTone, num, pct, stockHref, tone, tvUrl, usd } from "@/lib/format";
import { healthDetail, sector, term, type Dict, type Lang } from "@/lib/i18n";
import { crossMarks, type ListRow, type SortKey } from "@/lib/stockList";
import type { Candidate, ChartImages } from "@/lib/types";

type Props = { candidates: Candidate[]; images: Record<string, ChartImages> };

function soon(c: Candidate): boolean {
  return c.days_to_earnings != null && c.days_to_earnings >= 0 && c.days_to_earnings <= 14;
}

/** 목록 오른쪽 숫자 — 지금 정렬 기준 값을 보여 준다 (기본은 매수 적합도). */
function sortFigure(c: Candidate, key: SortKey, t: Dict, lang: Lang): string {
  switch (key) {
    case "health":
      return c.health ? `${c.health.score} · ${c.health.grade}` : "—";
    case "volume":
      return c.vol_ratio != null ? `${num(c.vol_ratio, 1)}×` : "—";
    case "insider":
      return c.insider?.signal ? bigUsd(c.insider.net_value) : "—";
    case "golden":
      return c.golden ? `#${c.golden.rank + 1}` : "—";
    case "rsi":
      return c.rsi?.toFixed(0) ?? "—";
    case "ret5":
      return pct(c.ret_5d);
    case "ret20":
      return pct(c.ret_20d);
    case "pos52":
      return pct(c.position_52w, 0, false);
    case "revenue":
      return pct(c.fundamentals?.revenue_growth);
    case "earnings":
      return c.earnings_date ? fmtDate(c.earnings_date, lang) : t.common.tbd;
    case "marketcap":
      return bigUsd(c.fundamentals?.market_cap);
    default:
      return `★ ${c.score?.toFixed(1) ?? "—"}`;
  }
}

/** 후보 목록(왼쪽) + 고른 종목 상세·차트(오른쪽). 좁은 화면에서는 위아래로 쌓인다. */
export function CandidatesView({ candidates, images }: Props) {
  const { lang, t } = useT();
  const rows = useMemo<ListRow[]>(
    () => candidates.map((c, i) => ({ ticker: c.ticker, held: c.held, market: c.market, info: c, order: i })),
    [candidates],
  );
  const ctl = useStockList(rows);
  const [sel, setSel] = useState(candidates[0]?.ticker ?? "");
  const detailRef = useRef<HTMLElement>(null);

  const shown = ctl.shown;
  const curRow = shown.find((r) => r.ticker === sel) ?? shown[0] ?? null;
  const cur = curRow ? candidates[curRow.order] : null;

  const pick = (ticker: string) => {
    setSel(ticker);
    if (window.matchMedia("(max-width: 940px)").matches) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <>
      <StockControls ctl={ctl} idPrefix="cand" />

      <div className="cand-layout">
        <section className="card cand-list" aria-label={t.cands.list}>
          {shown.length === 0 && <p className="empty">{t.list.empty}</p>}
          {shown.map((r) => {
            const c = candidates[r.order];
            const marks = crossMarks(c);
            return (
              <button key={c.ticker} type="button" className="cand-item" aria-pressed={cur?.ticker === c.ticker}
                onClick={() => pick(c.ticker)}>
                <span className="num small muted">{r.order + 1}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span className="tick" style={{ fontSize: 15 }}>
                      {c.ticker}
                    </span>
                    <span className="cand-item__name">{c.company}</span>
                  </span>
                  <span className="cand-item__badges">
                    {c.strategy && <span className="chip">{term(lang, c.strategy)}</span>}
                    {c.health && (
                      <span className={`badge badge--${gradeTone(c.health.grade)}`}>
                        {c.health.score} · {c.health.grade}
                      </span>
                    )}
                    {marks.some((m) => m.kind.startsWith("golden")) && <span className="badge badge--good">▲ {t.list.crossGolden}</span>}
                    {marks.some((m) => m.kind.startsWith("dead")) && <span className="badge badge--bad">▼ {t.list.crossDead}</span>}
                    {soon(c) && <span className="badge badge--warn">{t.common.earningsSoon}</span>}
                    {(() => {
                      // SEC 공시 경고 — 가장 심한 것 하나만 (자세한 건 오른쪽 상세·종목 페이지)
                      const f = (c.sec_flags ?? []).find((x) => x.severity !== "yellow");
                      return f ? (
                        <span className={`badge ${f.severity === "red" ? "badge--bad" : "badge--warn"}`} title={t.sec.title}>
                          {f.severity === "red" ? "🔴" : "🟠"} {t.sec.codes[f.code] ?? f.label}
                        </span>
                      ) : null;
                    })()}
                    {c.squeeze && (
                      <span className={`badge ${c.squeeze === "fire" ? "badge--bad" : "badge--warn"}`}>
                        {c.squeeze === "fire" ? t.squeeze.badgeFire : t.squeeze.badgeFuel}
                      </span>
                    )}
                    {c.held && <span className="badge badge--held">{t.common.held}</span>}
                  </span>
                </span>
                <span className="num" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                  {sortFigure(c, ctl.sort, t, lang)}
                </span>
              </button>
            );
          })}
        </section>

        {cur && (
          <section className="card cand-detail" ref={detailRef} aria-labelledby="detail-title" style={{ scrollMarginTop: 16 }}>
            <div className="chart-section__head">
              <h2 id="detail-title" className="tick" style={{ fontSize: 26 }}>
                {cur.ticker}
              </h2>
              <span style={{ color: "var(--ink-2)" }}>{cur.company}</span>
              {cur.held && <span className="badge badge--held">{t.common.held}</span>}
              <span className="chart-section__price">
                <span className="num" style={{ fontSize: 22, fontWeight: 600 }}>
                  {usd(cur.price)}
                </span>
              </span>
            </div>
            <div className="small muted" style={{ marginTop: 2 }}>
              {[
                sector(lang, cur.sector),
                cur.market_cap && t.common.marketCap(cur.market_cap),
                term(lang, cur.strategy),
                term(lang, cur.action),
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>

            <dl className="stats">
              <div className="stat">
                <dt>{t.common.score}</dt>
                <dd className="num">★ {cur.score?.toFixed(1) ?? "—"}</dd>
              </div>
              <div className="stat">
                <dt>{t.common.health}</dt>
                <dd>
                  {cur.health ? (
                    <span className={`badge badge--${gradeTone(cur.health.grade)}`} style={{ fontSize: 14 }}>
                      {cur.health.score} · {cur.health.grade}
                    </span>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="stat">
                <dt>RSI</dt>
                <dd className="num" style={{ color: (cur.rsi ?? 0) >= 70 ? "var(--warn)" : undefined }}>
                  {cur.rsi?.toFixed(0) ?? "—"}
                  {(cur.rsi ?? 0) >= 70 ? t.common.overheated : ""}
                </dd>
              </div>
              <div className="stat">
                <dt>{t.common.ret20}</dt>
                <dd className={`num ${tone(cur.ret_20d)}`}>{pct(cur.ret_20d)}</dd>
              </div>
              <div className="stat">
                <dt>{t.common.nextEarnings}</dt>
                <dd style={{ color: soon(cur) ? "var(--warn)" : undefined }}>
                  {cur.earnings_date
                    ? `${fmtDate(cur.earnings_date, lang)}${cur.days_to_earnings != null ? ` ${t.common.inDays(cur.days_to_earnings)}` : ""}`
                    : t.common.tbd}
                </dd>
              </div>
            </dl>

            {cur.fundamentals && (
              <dl className="stats" style={{ marginTop: 8 }}>
                <div className="stat">
                  <dt>{t.stock.revenueGrowth}</dt>
                  <dd className={`num ${tone(cur.fundamentals.revenue_growth)}`}>{pct(cur.fundamentals.revenue_growth)}</dd>
                </div>
                <div className="stat">
                  <dt>{t.stock.earningsGrowth}</dt>
                  <dd className={`num ${tone(cur.fundamentals.earnings_growth)}`}>{pct(cur.fundamentals.earnings_growth)}</dd>
                </div>
                <div className="stat">
                  <dt>{t.stock.profitMargin}</dt>
                  <dd className="num">{pct(cur.fundamentals.profit_margin, 1, false)}</dd>
                </div>
                <div className="stat">
                  <dt>{t.stock.insider}</dt>
                  <dd>
                    <InsiderBadge insider={cur.insider} />
                  </dd>
                </div>
              </dl>
            )}

            <div className="chart-meta" style={{ marginTop: 10 }}>
              <SignalChips info={cur} />
            </div>
            {cur.health?.detail && (
              <p className="small muted" style={{ margin: "8px 0 0" }}>
                {t.common.financials}: {healthDetail(lang, cur.health.detail)}
              </p>
            )}

            <div className="small" style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: "2px 18px" }}>
              <span>
                <span className="muted">{t.common.dailyPatterns}</span>{" "}
                {cur.patterns.daily.map((p) => term(lang, p)).join(" · ") || "—"}
              </span>
              <span>
                <span className="muted">{t.common.weeklyPatterns}</span>{" "}
                {cur.patterns.weekly.map((p) => term(lang, p)).join(" · ") || "—"}
              </span>
              {cur.patterns.monthly.length > 0 && (
                <span>
                  <span className="muted">{t.common.monthlyPatterns}</span>{" "}
                  {cur.patterns.monthly.map((p) => term(lang, p)).join(" · ")}
                </span>
              )}
            </div>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4 }}>
              <Link className="link-strong" href={stockHref(cur.ticker)}>
                {t.common.details}
              </Link>
              <a className="link-strong" href={tvUrl(cur.ticker)} target="_blank" rel="noopener noreferrer">
                {t.common.tvOpen}
              </a>
              <BuyButton ticker={cur.ticker} info={cur} />
            </div>
            <ChartGrid key={cur.ticker} ticker={cur.ticker} images={images[cur.ticker]} tfs={ctl.tfs} info={cur} size={ctl.size} />
          </section>
        )}
      </div>
    </>
  );
}
