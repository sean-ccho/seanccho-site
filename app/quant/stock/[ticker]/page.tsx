import type { Metadata } from "next";
import Link from "next/link";
import { getAbout } from "@/lib/about";
import { spyBack } from "@/lib/bench";
import { InsiderCongressCard } from "@/components/CongressSection";
import { AnalystCard, ValuationCard } from "@/components/InvestPanels";
import { MoveWhy, VolumeLine } from "@/components/MoveWhy";
import { NoData } from "@/components/NoData";
import { QuarterCard } from "@/components/QuarterCharts";
import { FinCard, SecCard, SourcesCard, SqzCard, TechCard } from "@/components/StockCards";
import { StockCharts } from "@/components/StockCharts";
import { StockHead, type VerdictItem } from "@/components/StockHead";
import { chartIndex, getDashboard, stockInfo } from "@/lib/dashboard";
import { daysBetween, isSoon } from "@/lib/earnings";
import { fmtDate, gradeTone, isCadListing, pct, pp, todayToronto, tone, universeHref, usd } from "@/lib/format";
import { term } from "@/lib/i18n";
import { getT } from "@/lib/lang";
import type { Valuation } from "@/lib/types";
import { getCongressFeed, getIndVal, getUniverseExtras, getUniverseStock } from "@/lib/universeServer";

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

/** 장중 — 가격에 비례하는 밸류에이션(PER · 선행 PER · PEG · PSR · PBR)을 지금 가격 ÷ 밤 가격만큼. 업종 중앙값 · EV/EBITDA 는 그대로. */
function scaleValuation(v: Valuation, s: number): Valuation {
  const k = (x: number | null) => (x == null ? x : x * s);
  return { ...v, pe: k(v.pe), fpe: k(v.fpe), peg: k(v.peg), ps: k(v.ps), pb: k(v.pb) };
}

/**
 * 종목 상세 (2026-11-10 개편, 사용자 시안) — 머리 카드 아래 3칸 격자를 줄마다:
 *   ① 차트(2칸) | 밸류에이션 · 애널리스트(1칸)
 *   ② SQZ 모멘텀 | 차트 패턴 · 핵심 지표 | 분기 실적
 *   ③ 핵심 재무 요약 · 거래량 · 왜 움직였나 + 뉴스(2칸) | 내부자 · 국회의원 · SEC 공시 · 자료 출처(1칸)
 *      — 캐나다 상장처럼 오른쪽이 짧으면 재무 | 내부자 · 자료 출처, 그 아래 왜 움직였나 한 줄 전체
 * 줄은 flex — 없는 카드는 빠지고 남은 카드가 폭을 나눠 갖는다, 좁은 화면은 한 줄에 하나씩.
 */
export default async function StockPage({ params }: Props) {
  const [data, { lang, t }, { ticker: raw }] = await Promise.all([getDashboard(), getT(), params]);
  if (!data) return <NoData />;
  const ticker = tickerOf(raw);
  const cad = isCadListing(ticker); // 캐나다 상장 — 내부자는 ceo.ca 링크, 공매도는 Yahoo 잔고 (2026-11-05)
  // 후보·차트·보유가 아닌 종목은 전체분석(universe-data)에서 — 캡처가 없어 차트는 TradingView 실시간
  const dashInfo = stockInfo(data, ticker);
  const [info, about, uni, feed] = await Promise.all([
    dashInfo ?? getUniverseStock(ticker),
    getAbout(ticker, lang), // 회사 소개 — 전체분석 종목 파일에만 있다
    getUniverseExtras(ticker), // 하루 · 3달 · 1년 수익률 · 52주 범위 · 밸류에이션 · 애널리스트 · 분기 실적 · 국회의원
    cad ? null : getCongressFeed(), // 국회의원 거래 — 기능이 켜진 뒤에만 (없으면 그 칸이 빠진다)
  ]);
  // 장중(2026-11-09, lib/live.ts) — PER · PSR · PBR · PEG 는 가격에 비례해서 장중 가격 비율로 (EV/EBITDA 는 부채가 섞여 그대로)
  const scale = uni?.info.live_scale ?? info?.live_scale ?? null;
  const detail = uni?.detail && scale && uni.detail.valuation
    ? { ...uni.detail, valuation: scaleValuation(uni.detail.valuation, scale) }
    : uni?.detail ?? null;
  // 밸류에이션 '다른 업종과 비교' (2026-11-09) — 그 시장 market.json 의 업종 · 섹터 · 시장 전체 중앙값 (없으면 고르기 없음)
  const indVal = detail?.valuation ? await getIndVal(uni?.market) : null;
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

  // 판정 버튼 줄 — 값이 있는 것만 (전체분석에만 있는 종목은 판정·추천이 없다)
  const verdict: VerdictItem[] = [];
  if (info) {
    if (info.verdict) verdict.push({ k: t.stock.verdict, v: term(lang, info.verdict) });
    if (info.action) verdict.push({ k: t.stock.action, v: term(lang, info.action) });
    if (info.strategy) verdict.push({ k: t.stock.strategy, v: term(lang, info.strategy) });
    if (info.score != null) verdict.push({ k: t.common.score, v: `★ ${info.score.toFixed(1)}`, kind: "score" });
    if (info.health) {
      const g = gradeTone(info.health.grade);
      verdict.push({ k: t.common.health, v: `${info.health.score} · ${info.health.grade}`, kind: g === "none" ? undefined : g });
    }
  }
  const earnings = info && {
    v: info.earnings_date
      ? `${fmtDate(info.earnings_date, lang)}${earnIn != null && earnIn >= 0 ? ` ${t.common.inDays(earnIn)}` : ""}`
      : t.common.tbd,
    soon: isSoon(earnIn),
  };
  const hasRets = uni?.info.ret_1d != null;
  const quarters = detail?.quarters && (detail.quarters.eps.length > 0 || detail.quarters.revenue.length > 0) ? detail.quarters : null;
  const moveInfo = uni?.info ?? info;
  // SEC 공시는 미국 제도 — 캐나다 상장은 칸째 뺀다 ('경고할 공시 없음'으로 읽히지 않게)
  const showSec = !!info && "sec_flags" in info && !cad;
  // 내부자 · 국회의원 — 내부자를 조회한 종목 · 캐나다(ceo.ca 링크) · 국회의원 자료가 있는 미국 종목 (InsiderCongressCard 와 같은 조건)
  const showIns = !!info && ("insider" in info || cad || !!feed);
  // 오른쪽 기둥에 SEC 공시나 국회의원 표가 있으면(미국 상장) 두 기둥, 아니면(캐나다 등) 왜 움직였나를 한 줄 전체로
  const sideHeavy = showSec || (showIns && !!feed && !cad);
  const moveWhy = moveInfo && (
    <MoveWhy ticker={ticker} info={moveInfo} barDate={uni?.barDate ?? null}
      spyDay={cad ? null : spyBack(data.benchmark, 1, uni?.info.live?.day ?? uni?.barDate ?? null)}
      indexLabel="SPY" lang={lang} t={t} />
  );
  const sources = <SourcesCard ticker={ticker} cad={cad} barDate={uni?.barDate ?? data.bar_date} lang={lang} t={t} />;

  return (
    <main className="container container--wide page stock-page sd-page">
      <p className="small stock-back">
        <Link className="link-strong" href="/quant/candidates">
          {t.stock.back}
        </Link>
        {toUniverse}
      </p>

      <StockHead ticker={ticker} company={company} price={price} info={info} extra={uni ? { info: uni.info, market: uni.market } : null}
        held={holdings.length > 0} about={about} barDate={uni?.barDate ?? data.bar_date} valuation={detail?.valuation}
        verdict={verdict} earnings={earnings} bench={data.benchmark} lang={lang} t={t} />

      {/* ① 차트 | 밸류에이션 · 애널리스트 */}
      <div className="sd-row">
        <section className="card sd-card sd-w2 sd-chart" aria-labelledby="chart-title">
          <h2 id="chart-title" className="sr-only">
            {t.stock.chartTitle}
          </h2>
          <StockCharts ticker={ticker} images={images} info={info} />
          {moveInfo && <VolumeLine info={moveInfo} lang={lang} t={t} />}
        </section>
        {(detail?.valuation || detail?.analyst) && (
          <div className="sd-w1 sd-stack">
            {detail.valuation && (
              <ValuationCard v={detail.valuation} groups={indVal} fallbackSector={info?.sector ?? null} selfLabel={ticker}
                lang={lang} t={t} />
            )}
            {detail.analyst && <AnalystCard a={detail.analyst} price={price} t={t} ticker={ticker} />}
          </div>
        )}
      </div>

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

      {/* ② SQZ 모멘텀 | 차트 패턴 · 핵심 지표 | 분기 실적 */}
      {(info || quarters) && (
        <div className="sd-row">
          {info?.sqzmom && <SqzCard info={info} t={t} className="sd-w1" />}
          {info && <TechCard info={info} showRet={!hasRets} lang={lang} t={t} className="sd-w1" />}
          {quarters && (
            <QuarterCard eps={quarters.eps} revenue={quarters.revenue} className="sd-w1"
              next={{ ...quarters.next, date: quarters.next.date ?? info?.earnings_date ?? null }} />
          )}
        </div>
      )}

      {/* ③ 미국 상장 — 두 기둥: 핵심 재무 요약 · 거래량 · 왜 움직였나 + 뉴스 | 내부자 · 국회의원 · SEC 공시 · 자료 출처.
          종목마다 길이가 달라서(뉴스 · 의원 신고 · 공시 수) 카드를 늘리지 않고 기둥마다 제 높이로 (sd-row--free). */}
      {sideHeavy ? (
        <div className="sd-row sd-row--free">
          {(info?.fundamentals || moveInfo) && (
            <div className="sd-w2 sd-stack">
              {info?.fundamentals && <FinCard info={info} ticker={ticker} cad={cad} lang={lang} t={t} />}
              {moveWhy}
            </div>
          )}
          <div className="sd-w1 sd-stack">
            {info && showIns && <InsiderCongressCard ticker={ticker} info={info} trades={uni?.congress ?? []} feed={feed} cad={cad}
              lang={lang} t={t} />}
            {info && showSec && <SecCard flags={info.sec_flags ?? []} ticker={ticker} lang={lang} t={t} />}
            {sources}
          </div>
        </div>
      ) : (
        <>
          {/* ③ 캐나다 상장 등 오른쪽이 짧을 때 — 재무 | 내부자 · 자료 출처, 그 아래 왜 움직였나 한 줄 전체 */}
          <div className="sd-row">
            {info?.fundamentals && <FinCard info={info} ticker={ticker} cad={cad} lang={lang} t={t} className="sd-w2" />}
            <div className="sd-w1 sd-stack">
              {info && showIns && <InsiderCongressCard ticker={ticker} info={info} trades={uni?.congress ?? []} feed={feed}
                cad={cad} lang={lang} t={t} />}
              {sources}
            </div>
          </div>
          {moveWhy}
        </>
      )}
    </main>
  );
}
