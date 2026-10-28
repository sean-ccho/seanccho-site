import type { Metadata } from "next";
import Link from "next/link";
import { InsiderBadge } from "@/components/InsiderBadge";
import { SecFlagList } from "@/components/SecFlags";
import { NoData } from "@/components/NoData";
import { StockCharts } from "@/components/StockCharts";
import { PatternList, SqzRows } from "@/components/StockChips";
import { chartIndex, getDashboard, stockInfo } from "@/lib/dashboard";
import { bigUsd, fmtDate, gradeTone, num, openinsiderUrl, pct, pp, tone, universeHref, usd } from "@/lib/format";
import { healthDetail, sector, term, type Dict } from "@/lib/i18n";
import { getT } from "@/lib/lang";
import { patternRowTitle } from "@/lib/patternHelp";
import type { Fundamentals } from "@/lib/types";
import { getUniverseStock } from "@/lib/universeServer";

export const revalidate = 1800;

type Props = { params: Promise<{ ticker: string }> };

function tickerOf(raw: string): string {
  return decodeURIComponent(raw).trim().toUpperCase();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: tickerOf((await params).ticker) };
}

function Stat({ label, children, cls, help }: { label: string; children: React.ReactNode; cls?: string; help?: string }) {
  return (
    <div className="stat">
      <dt title={help}>{label}</dt>
      <dd className={cls}>{children}</dd>
    </div>
  );
}

function FundamentalStats({ f, t }: { f: Fundamentals; t: Dict }) {
  return (
    <dl className="stats">
      <Stat label={t.stock.revenueGrowth} cls={`num ${tone(f.revenue_growth)}`}>{pct(f.revenue_growth)}</Stat>
      <Stat label={t.stock.earningsGrowth} cls={`num ${tone(f.earnings_growth)}`}>{pct(f.earnings_growth)}</Stat>
      <Stat label={t.stock.grossMargin} cls="num">{pct(f.gross_margin, 1, false)}</Stat>
      <Stat label={t.stock.profitMargin} cls="num">{pct(f.profit_margin, 1, false)}</Stat>
      <Stat label={t.stock.roe} cls="num">{pct(f.roe, 1, false)}</Stat>
      <Stat label={t.stock.debtToEquity} cls="num">
        {f.debt_to_equity != null ? t.stock.times(num(f.debt_to_equity / 100)) : "—"}
      </Stat>
      <Stat label={t.stock.currentRatio} cls="num">
        {f.current_ratio != null ? t.stock.times(num(f.current_ratio)) : "—"}
      </Stat>
      <Stat label={t.stock.fcf} cls={`num ${tone(f.free_cashflow)}`}>{bigUsd(f.free_cashflow)}</Stat>
      <Stat label={t.stock.ocf} cls="num">{bigUsd(f.operating_cashflow)}</Stat>
      <Stat label={t.stock.marketCap} cls="num">{bigUsd(f.market_cap)}</Stat>
      <Stat label={t.stock.dividend} cls="num">{pct(f.dividend_yield, 2, false)}</Stat>
      <Stat label={t.stock.shortFloat} cls="num">{pct(f.short_pct_float, 1, false)}</Stat>
      <Stat label={t.stock.institutional} cls="num">{pct(f.institutional_pct, 1, false)}</Stat>
    </dl>
  );
}

function externalLinks(ticker: string): { label: string; href: string }[] {
  const q = encodeURIComponent(ticker);
  return [
    { label: "Yahoo Finance", href: `https://finance.yahoo.com/quote/${q}` },
    { label: "Finviz", href: `https://finviz.com/quote.ashx?t=${q}` },
    { label: "openinsider", href: openinsiderUrl(ticker) },
    { label: "SEC EDGAR", href: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${q}&type=10-Q` },
  ];
}

export default async function StockPage({ params }: Props) {
  const [data, { lang, t }, { ticker: raw }] = await Promise.all([getDashboard(), getT(), params]);
  if (!data) return <NoData />;
  const ticker = tickerOf(raw);
  // 후보·차트·보유가 아닌 종목은 전체분석(universe-data)에서 — 캡처가 없어 차트는 TradingView 실시간
  const info = stockInfo(data, ticker) ?? (await getUniverseStock(ticker));
  const holdings = data.accounts.flatMap((a) =>
    a.positions.filter((p) => p.ticker === ticker).map((p) => ({ label: term(lang, a.label), p })),
  );
  const images = chartIndex(data)[ticker];

  const uniHref = universeHref(ticker);
  const toUniverse = uniHref && (
    <>
      {" · "}
      <Link className="link-strong" href={uniHref}>
        {t.stock.toUniverse}
      </Link>
    </>
  );
  if (!info && holdings.length === 0) {
    return (
      <main className="container page">
        <section className="card empty">
          <h1 style={{ fontSize: 20 }}>
            <span className="tick">{ticker}</span> — {t.stock.notFoundTitle}
          </h1>
          <p style={{ margin: "8px 0 0" }}>{t.stock.notFoundBody}</p>
          <p style={{ margin: "12px 0 0" }}>
            <Link className="link-strong" href="/quant/candidates">
              {t.stock.back}
            </Link>
            {toUniverse}
          </p>
        </section>
      </main>
    );
  }

  const company = info?.company ?? holdings[0]?.p.company ?? null;
  const price = info?.price ?? holdings[0]?.p.price ?? null;
  const soon = info?.days_to_earnings != null && info.days_to_earnings >= 0 && info.days_to_earnings <= 14;

  return (
    <main className="container container--wide page">
      <div className="page-title">
        <p className="small" style={{ margin: "0 0 6px" }}>
          <Link className="link-strong" href="/quant/candidates">
            {t.stock.back}
          </Link>
          {toUniverse}
        </p>
        <div className="chart-section__head">
          <h1 className="tick" style={{ fontSize: 32 }}>
            {ticker}
          </h1>
          {company && <span style={{ color: "var(--ink-2)", fontSize: 17 }}>{company}</span>}
          {holdings.length > 0 && <span className="badge badge--held">{t.common.held}</span>}
          <span className="chart-section__price">
            <span className="num" style={{ fontSize: 26, fontWeight: 600 }}>
              {usd(price)}
            </span>
          </span>
        </div>
        {info && (
          <p>
            {[
              sector(lang, info.sector),
              info.market === "sp500" ? "S&P 500" : info.market === "nasdaq" ? term(lang, "나스닥·NYSE") : null,
              info.market_cap && t.common.marketCap(info.market_cap),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>

      {holdings.length > 0 && (
        <section className="card" aria-labelledby="pt-title">
          <h2 id="pt-title" style={{ fontSize: 19 }}>
            {t.stock.pt}
          </h2>
          {holdings.map(({ label, p }) => (
            <dl key={label} className="stats">
              <Stat label={t.stock.ptAcct(label)} cls={`num ${tone(p.return)}`}>
                {pct(p.return)}
              </Stat>
              <Stat label={t.stock.entry} cls="num">
                {usd(p.entry_price)} · {fmtDate(p.entry_date, lang)}
              </Stat>
              <Stat label={t.stock.since}>{t.holdings.dayN(p.days_held)}</Stat>
              <Stat label={t.common.vsSpy} cls={`num ${tone(p.return != null && p.spy_return != null ? p.return - p.spy_return : null)}`}>
                {pp(p.return, p.spy_return)}
              </Stat>
              <Stat label="▼ / ▲" cls="num">
                <span className="down">{usd(p.exit.down)}</span> / {p.exit.up != null ? <span className="up">{usd(p.exit.up)}</span> : "—"}
              </Stat>
            </dl>
          ))}
        </section>
      )}

      {info && (
        <section className="card" aria-labelledby="key-title">
          <h2 id="key-title" style={{ fontSize: 19 }}>
            {t.stock.key}
          </h2>
          <dl className="stats">
            <Stat label={t.common.score} cls="num">★ {info.score?.toFixed(1) ?? "—"}</Stat>
            <Stat label={t.common.health}>
              {info.health ? (
                <span className={`badge badge--${gradeTone(info.health.grade)}`} style={{ fontSize: 14 }}>
                  {info.health.score} · {info.health.grade}
                </span>
              ) : (
                "—"
              )}
            </Stat>
            <Stat label={t.stock.verdict}>{term(lang, info.verdict) || "—"}</Stat>
            <Stat label={t.stock.action}>{term(lang, info.action) || "—"}</Stat>
            <Stat label={t.stock.strategy}>{term(lang, info.strategy) || "—"}</Stat>
            <Stat label={t.stock.rsi} cls="num">
              <span style={{ color: (info.rsi ?? 0) >= 70 ? "var(--warn)" : undefined }}>
                {info.rsi?.toFixed(0) ?? "—"}
                {(info.rsi ?? 0) >= 70 ? t.common.overheated : ""}
              </span>
            </Stat>
            <Stat label={t.stock.ret5} cls={`num ${tone(info.ret_5d)}`}>{pct(info.ret_5d)}</Stat>
            <Stat label={t.common.ret20} cls={`num ${tone(info.ret_20d)}`}>{pct(info.ret_20d)}</Stat>
            <Stat label={t.stock.pos52} cls="num" help={t.stock.pos52Help}>
              {pct(info.position_52w, 0, false)}
            </Stat>
            <Stat label={t.stock.atr} cls="num">{pct(info.atr_pct, 1, false)}</Stat>
            <Stat label={t.stock.relMarket} cls={`num ${tone(info.rel_market)}`}>{pct(info.rel_market)}</Stat>
            <Stat label={t.stock.relSector} cls={`num ${tone(info.rel_sector)}`}>{pct(info.rel_sector)}</Stat>
            <Stat label={t.common.nextEarnings}>
              <span style={{ color: soon ? "var(--warn)" : undefined }}>
                {info.earnings_date
                  ? `${fmtDate(info.earnings_date, lang)}${info.days_to_earnings != null ? ` ${t.common.inDays(info.days_to_earnings)}` : ""}`
                  : t.common.tbd}
              </span>
            </Stat>
          </dl>
          {info.health?.detail && (
            <p className="small muted" style={{ margin: "10px 0 0" }}>
              {t.common.financials}: {healthDetail(lang, info.health.detail)}
            </p>
          )}
        </section>
      )}

      {info?.fundamentals && (
        <section className="card" aria-labelledby="fund-title">
          <div className="section-head">
            <h2 id="fund-title">{t.stock.fundamentals}</h2>
            <p>{t.stock.fundSub}</p>
          </div>
          <FundamentalStats f={info.fundamentals} t={t} />
        </section>
      )}

      {info && "insider" in info && (
        <section className="card" aria-labelledby="ins-title">
          <div className="section-head">
            <h2 id="ins-title">{t.stock.insider}</h2>
            <p>{t.stock.insiderSub}</p>
          </div>
          {info.insider ? (
            <dl className="stats">
              <Stat label={t.stock.signal}>
                <InsiderBadge insider={info.insider} />
              </Stat>
              <Stat label={t.stock.buys} cls="num">{info.insider.buys}</Stat>
              <Stat label={t.stock.sells} cls="num">{info.insider.sells}</Stat>
              <Stat label={t.stock.net} cls={`num ${tone(info.insider.net_value)}`}>{bigUsd(info.insider.net_value)}</Stat>
              <Stat label={t.stock.lastTrade}>{info.insider.last_date ? fmtDate(info.insider.last_date, lang) : "—"}</Stat>
            </dl>
          ) : (
            <p className="muted" style={{ margin: "8px 0 0" }}>
              {t.stock.insiderNone}
            </p>
          )}
          {/* 요약은 90일 숫자뿐 — 누가·언제·얼마에 샀는지는 openinsider 회사 페이지에서 (조회 안 한 종목도) */}
          <p style={{ margin: "10px 0 0" }}>
            <a className="link-strong small" href={openinsiderUrl(ticker)} target="_blank" rel="noopener noreferrer"
              title={t.insider.openHelp}>
              {t.insider.open}
            </a>
          </p>
        </section>
      )}

      {info && "short" in info && (
        <section className="card" aria-labelledby="short-title">
          <div className="section-head">
            <h2 id="short-title">{t.squeeze.statTitle}</h2>
            <p>{t.squeeze.statSub}</p>
          </div>
          {info.short ? (
            <dl className="stats">
              <Stat label={t.squeeze.colShort} cls={`num${info.short.high ? " down" : ""}`}>{pct(info.short.pct, 1, false)}</Stat>
              <Stat label={t.squeeze.colDtc} cls={`num${info.short.high ? " down" : ""}`}>
                {info.short.dtc != null ? t.squeeze.dtc(num(info.short.dtc, 1)) : "—"}
              </Stat>
              <Stat label={t.squeeze.colChange} cls={`num ${tone(info.short.change)}`}>{pct(info.short.change, 0)}</Stat>
              <Stat label={t.squeeze.title}>
                {info.squeeze ? (info.squeeze === "fire" ? t.squeeze.badgeFire : t.squeeze.badgeFuel) : "—"}
              </Stat>
              <Stat label={t.squeeze.asOfLabel}>{fmtDate(info.short.settle, lang)}</Stat>
            </dl>
          ) : (
            <p className="muted" style={{ margin: "8px 0 0" }}>{t.squeeze.none}</p>
          )}
          <p className="tiny muted" style={{ margin: "10px 0 0" }}>{t.squeeze.dtcHelp}</p>
        </section>
      )}

      {info && "sec_flags" in info && (
        <section className="card" aria-labelledby="sec-title">
          <div className="section-head">
            <h2 id="sec-title">{t.sec.title}</h2>
            <p>{t.sec.sub}</p>
          </div>
          <SecFlagList flags={info.sec_flags ?? []} />
          <p className="tiny muted" style={{ margin: "10px 0 0" }}>{t.sec.help}</p>
        </section>
      )}

      {info && (
        <section className="card" aria-labelledby="pat-title">
          <h2 id="pat-title" style={{ fontSize: 19 }}>
            {t.stock.patterns}
          </h2>
          <dl className="stats">
            <Stat label={t.common.dailyPatterns} help={patternRowTitle(t, "daily")}>
              <PatternList list={info.patterns.daily} tf="daily" />
            </Stat>
            <Stat label={t.common.weeklyPatterns} help={patternRowTitle(t, "weekly")}>
              <PatternList list={info.patterns.weekly} tf="weekly" preview={info.preview?.weekly} />
            </Stat>
            <Stat label={t.common.monthlyPatterns} help={patternRowTitle(t, "monthly")}>
              <PatternList list={info.patterns.monthly} tf="monthly" preview={info.preview?.monthly} />
            </Stat>
          </dl>
        </section>
      )}

      {info?.sqzmom && (
        <section className="card" aria-labelledby="sqz-title">
          <h2 id="sqz-title" style={{ fontSize: 19 }}>
            {t.list.sqz}
          </h2>
          <SqzRows info={info} />
          <p className="tiny muted" style={{ margin: "8px 0 0" }}>{t.list.sqzNote}</p>
        </section>
      )}

      <section className="card" aria-labelledby="chart-title">
        <h2 id="chart-title" style={{ fontSize: 19, marginBottom: 10 }}>
          {t.stock.chartTitle}
        </h2>
        <StockCharts ticker={ticker} images={images} info={info} />
      </section>

      <section className="card" aria-labelledby="links-title">
        <h2 id="links-title" style={{ fontSize: 19 }}>
          {t.stock.links}
        </h2>
        <div className="links" style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {externalLinks(ticker).map((l) => (
            <a key={l.href} className="btn" href={l.href} target="_blank" rel="noopener noreferrer">
              {l.label} ↗
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
