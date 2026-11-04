import type { Metadata } from "next";
import Link from "next/link";
import { BuyButton } from "@/components/BuyDialog";
import { AboutText } from "@/components/CompanyAbout";
import { Dot, Icon } from "@/components/Icon";
import { InsiderBadge } from "@/components/InsiderBadge";
import { AnalystCard, ReturnsStrip, StockGlance, ValuationCard } from "@/components/InvestPanels";
import { QuarterCard } from "@/components/QuarterCharts";
import { SecFlagList } from "@/components/SecFlags";
import { NoData } from "@/components/NoData";
import { StockCharts } from "@/components/StockCharts";
import { PatternList, SqzRows } from "@/components/StockChips";
import { StyleBadge } from "@/components/StyleBadge";
import { getAbout } from "@/lib/about";
import { chartIndex, getDashboard, stockInfo } from "@/lib/dashboard";
import { daysBetween, isSoon } from "@/lib/earnings";
import { bigUsd, dividendOf, fmtDate, gradeTone, num, openinsiderUrl, pct, pp, todayToronto, tone, universeHref, usd } from "@/lib/format";
import { healthDetail, industry, sector, term, type Dict } from "@/lib/i18n";
import { getT } from "@/lib/lang";
import { patternRowTitle } from "@/lib/patternHelp";
import { regionBasis } from "@/lib/stockStyle";
import type { Fundamentals } from "@/lib/types";
import { getUniverseExtras, getUniverseStock } from "@/lib/universeServer";

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
  const div = dividendOf(f);
  return (
    <dl className="stats stats--kv">
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
      <Stat label={t.stock.dividend} cls="num" help={t.stock.dividendHelp}>{pct(div.y, 2, false)}</Stat>
      <Stat label={t.stock.annualDividend} cls="num" help={t.stock.annualDividendHelp}>
        {div.a == null ? "—" : div.a > 0 ? t.stock.perShare(usd(div.a)) : t.common.noDividend}
      </Stat>
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
  const dashInfo = stockInfo(data, ticker);
  const [info, about, uni] = await Promise.all([
    dashInfo ?? getUniverseStock(ticker),
    getAbout(ticker, lang), // 회사 소개 — 전체분석 종목 파일에만 있다
    getUniverseExtras(ticker), // 투자자 한눈에 (2026-11-03) — 하루 · 3달 · 1년 수익률 · 52주 범위 · 밸류에이션 · 애널리스트 · 분기 실적
  ]);
  const detail = uni?.detail ?? null;
  // 기간 수익률 · 52주 범위는 전체분석 숫자 (dashboard 종목도 같은 밤 일봉) — 그 밤 실행에 하루 수익률이 없으면 안 보인다
  const retInfo = uni?.info.ret_1d != null ? uni.info : null;
  const range52 = info?.range_52w ?? uni?.info.range_52w ?? null;
  const showGlance = !!info && (range52 != null || !!detail?.valuation || !!detail?.analyst);
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
  const earnIn = daysBetween(todayToronto(), info?.earnings_date);
  const soon = isSoon(earnIn);
  const move = info?.earnings_move ?? null;

  // 머리 아래 한 줄 판정 — 값이 있는 것만 (전체분석에만 있는 종목은 판정·추천이 없다)
  const strip: { k: string; v: React.ReactNode; cls?: string }[] = [];
  if (info) {
    if (info.verdict) strip.push({ k: t.stock.verdict, v: term(lang, info.verdict) });
    if (info.action) strip.push({ k: t.stock.action, v: term(lang, info.action) });
    if (info.strategy) strip.push({ k: t.stock.strategy, v: term(lang, info.strategy) });
    if (info.score != null) strip.push({ k: t.common.score, v: `★ ${info.score.toFixed(1)}`, cls: "num gold" });
    if (info.health) {
      strip.push({
        k: t.common.health,
        v: <span className={`badge badge--${gradeTone(info.health.grade)}`}>{info.health.score} · {info.health.grade}</span>,
      });
    }
  }
  // 다음 실적 — '한눈에' 줄이 있으면 거기, 없으면(그 밤 숫자가 아직 없음) 예전처럼 판정 줄 끝에
  const earnCell = info && {
    v: info.earnings_date
      ? `${fmtDate(info.earnings_date, lang)}${earnIn != null && earnIn >= 0 ? ` ${t.common.inDays(earnIn)}` : ""}`
      : t.common.tbd,
    cls: soon ? "kv-strip__soon" : undefined,
  };
  if (earnCell && !showGlance) strip.push({ k: t.common.nextEarnings, ...earnCell });

  return (
    <main className="container container--wide page stock-page">
      <p className="small stock-back">
        <Link className="link-strong" href="/quant/candidates">
          {t.stock.back}
        </Link>
        {toUniverse}
      </p>

      {/* 티커 · 회사 · 가격 · 매수 — 내려도 화면 위에 붙어 있다 (차트·지표를 보다가 바로 매수) */}
      <div className="stock-bar">
        <h1 className="tick stock-bar__tick">{ticker}</h1>
        {company && <span className="stock-bar__name">{company}</span>}
        {holdings.length > 0 && <span className="badge badge--held">{t.common.held}</span>}
        <span className="stock-bar__right">
          <span className="num stock-bar__px">{usd(price)}</span>
          {retInfo?.ret_1d != null ? (
            <span className={`num small ${tone(retInfo.ret_1d)}`}>
              {pct(retInfo.ret_1d, 2)} {t.invest.day}
            </span>
          ) : info?.ret_20d != null && (
            <span className={`num small ${tone(info.ret_20d)}`}>
              {pct(info.ret_20d)} {t.screen.d20}
            </span>
          )}
          <BuyButton ticker={ticker} info={info ?? null} />
        </span>
      </div>

      <div className="stock-head">
        {info && (
          <p className="stock-head__meta">
            {[
              sector(lang, info.sector),
              industry(lang, info.industry),
              info.market === "sp500" ? "S&P 500" : info.market === "nasdaq" ? term(lang, "나스닥·NYSE") : null,
              info.market_cap && t.common.marketCap(info.market_cap),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        {/* 경기순환/방어 × 내수/글로벌 — 근거(SEC 10-K 미국 매출 비중 · 추정)를 글로 */}
        {info?.style && (info.style.cycle || info.style.region) && (
          <p className="small">
            <StyleBadge style={info.style} />{" "}
            <span className="muted">
              {[info.style.cycle && t.style.cycle[info.style.cycle], info.style.region && t.style.region[info.style.region]]
                .filter(Boolean).join(" · ")}
              {info.style.region ? ` — ${regionBasis(t, info.style)}` : ""}
            </span>
          </p>
        )}
        {/* 한눈에 (2026-11-03) — 52주 범위 · PER · 목표주가 · 의견 · 다음 실적, 그 아래 기간 수익률 | 퀀트 판정 */}
        {info && showGlance && (
          <StockGlance info={{ ...info, range_52w: range52 }} price={price} valuation={detail?.valuation}
            analyst={detail?.analyst} earnings={earnCell} t={t} />
        )}
        <div className="glance-pair">
          {retInfo && <ReturnsStrip info={retInfo} bench={data.benchmark} asOf={uni?.barDate ?? null} t={t} />}
          {strip.length > 0 && (
            <dl className="kv-strip" aria-label={t.invest.quant}>
              {strip.map((x) => (
                <div key={x.k}>
                  <dt>{x.k}</dt>
                  <dd className={x.cls}>{x.v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      <section className="card" aria-labelledby="chart-title">
        <h2 id="chart-title" className="sr-only">
          {t.stock.chartTitle}
        </h2>
        <StockCharts ticker={ticker} images={images} info={info} />
      </section>

      {holdings.length > 0 && (
        <section className="card" aria-labelledby="pt-title">
          <h2 id="pt-title" style={{ fontSize: 19 }}>
            {t.stock.pt}
          </h2>
          {holdings.map(({ label, p }) => (
            <dl key={label} className="stats stats--kv">
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

      {/* 회사 소개 — 차트 바로 아래 (2026-11-03: 처음 보는 종목이 많아 '무슨 회사인지'부터) */}
      {about && (
        <section className="card" aria-labelledby="about-title">
          <h2 id="about-title" style={{ fontSize: 19 }}>
            {t.about.title}
          </h2>
          <div className="about">
            <AboutText about={about} />
          </div>
        </section>
      )}

      {/* 밸류에이션 · 애널리스트 · 분기 실적 (2026-11-03) */}
      {(detail?.valuation || detail?.analyst) && (
        <div className="row">
          {detail.valuation && <ValuationCard v={detail.valuation} lang={lang} t={t} />}
          {detail.analyst && <AnalystCard a={detail.analyst} price={price} t={t} />}
        </div>
      )}
      {detail?.quarters && (detail.quarters.eps.length > 0 || detail.quarters.revenue.length > 0) && (
        <QuarterCard eps={detail.quarters.eps} revenue={detail.quarters.revenue}
          next={{ ...detail.quarters.next, date: detail.quarters.next.date ?? info?.earnings_date ?? null }} />
      )}

      {info && (
        <section className="card" aria-labelledby="key-title">
          <h2 id="key-title" style={{ fontSize: 19 }}>
            {t.stock.key}
          </h2>
          <dl className="stats stats--kv">
            <Stat label={t.stock.rsi} cls="num">
              <span style={{ color: (info.rsi ?? 0) >= 70 ? "var(--warn)" : undefined }}>
                {info.rsi?.toFixed(0) ?? "—"}
                {(info.rsi ?? 0) >= 70 ? t.common.overheated : ""}
              </span>
            </Stat>
            {/* 5일 · 20일 수익률 · 52주 위치는 위 기간 수익률 · 52주 범위와 겹쳐서, 그 줄이 있으면 뺀다 */}
            {!retInfo && <Stat label={t.stock.ret5} cls={`num ${tone(info.ret_5d)}`}>{pct(info.ret_5d)}</Stat>}
            {!retInfo && <Stat label={t.common.ret20} cls={`num ${tone(info.ret_20d)}`}>{pct(info.ret_20d)}</Stat>}
            {!(showGlance && range52) && (
              <Stat label={t.stock.pos52} cls="num" help={t.stock.pos52Help}>
                {pct(info.position_52w, 0, false)}
              </Stat>
            )}
            <Stat label={t.stock.atr} cls="num">{pct(info.atr_pct, 1, false)}</Stat>
            <Stat label={t.stock.relMarket} cls={`num ${tone(info.rel_market)}`}>{pct(info.rel_market)}</Stat>
            <Stat label={t.stock.relSector} cls={`num ${tone(info.rel_sector)}`}>{pct(info.rel_sector)}</Stat>
            {move && (
              <Stat label={t.earn.colMove} cls="num"
                help={t.earn.badgeTitle(move.n, pct(move.avg, 1, false), pct(move.worst), move.timing ? t.earn.timing[move.timing] : "")}>
                ±{pct(move.avg, 1, false)} · {pct(move.worst)}
              </Stat>
            )}
          </dl>
          {info.health?.detail && (
            <p className="small muted" style={{ margin: "10px 0 0" }}>
              {t.common.financials}: {healthDetail(lang, info.health.detail)}
            </p>
          )}
        </section>
      )}

      {info && (
        <div className="row">
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
          {info.sqzmom && (
            <section className="card" aria-labelledby="sqz-title">
              <h2 id="sqz-title" style={{ fontSize: 19 }}>
                {t.list.sqz}
              </h2>
              <SqzRows info={info} />
              <p className="tiny muted" style={{ margin: "8px 0 0" }}>{t.list.sqzNote}</p>
            </section>
          )}
        </div>
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

      {info && ("insider" in info || "short" in info) && (
        <div className="row">
          {"insider" in info && (
            <section className="card" aria-labelledby="ins-title">
              <div className="section-head">
                <h2 id="ins-title">{t.stock.insider}</h2>
                <p>{t.stock.insiderSub}</p>
              </div>
              {info.insider ? (
                <dl className="stats stats--kv">
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
          {"short" in info && (
            <section className="card" aria-labelledby="short-title">
              <div className="section-head">
                <h2 id="short-title">{t.squeeze.statTitle}</h2>
                <p>{t.squeeze.statSub}</p>
              </div>
              {info.short ? (
                <dl className="stats stats--kv">
                  <Stat label={t.squeeze.colShort} cls={`num${info.short.high ? " down" : ""}`}>{pct(info.short.pct, 1, false)}</Stat>
                  <Stat label={t.squeeze.colDtc} cls={`num${info.short.high ? " down" : ""}`}>
                    {info.short.dtc != null ? t.squeeze.dtc(num(info.short.dtc, 1)) : "—"}
                  </Stat>
                  <Stat label={t.squeeze.colChange} cls={`num ${tone(info.short.change)}`}>{pct(info.short.change, 0)}</Stat>
                  <Stat label={t.squeeze.title}>
                    {info.squeeze ? (info.squeeze === "fire" ? <><Icon name="flame" size={14} /> {t.squeeze.badgeFire}</> : t.squeeze.badgeFuel) : "—"}
                  </Stat>
                  <Stat label={t.squeeze.asOfLabel}>{fmtDate(info.short.settle, lang)}</Stat>
                </dl>
              ) : (
                <p className="muted" style={{ margin: "8px 0 0" }}>{t.squeeze.none}</p>
              )}
              <p className="tiny muted" style={{ margin: "10px 0 0" }}>{t.squeeze.dtcHelp}</p>
            </section>
          )}
        </div>
      )}

      {info && "sec_flags" in info && (
        <section className="card" aria-labelledby="sec-title">
          <div className="section-head">
            <h2 id="sec-title">{t.sec.title}</h2>
            <p>{t.sec.sub}</p>
          </div>
          <SecFlagList flags={info.sec_flags ?? []} />
          <p className="tiny muted sec-legend">
            {(["red", "orange", "yellow"] as const).map((k) => (
              <span key={k}><Dot tone={k} />{t.sec.help[k]}</span>
            ))}
          </p>
        </section>
      )}

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
