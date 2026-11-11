import type { About } from "@/lib/about";
import { spyBack } from "@/lib/bench";
import { bigUsd, fmtDate, money, moneyText, num, pct, tone } from "@/lib/format";
import { industry, sector, type Dict, type Lang } from "@/lib/i18n";
import { cmpText, compareVal, headlinePe } from "@/lib/market";
import { regionBasis } from "@/lib/stockStyle";
import type { Benchmark, LiveMark, TickerInfo, Valuation } from "@/lib/types";
import { BuyButton } from "./BuyDialog";
import { AboutText } from "./CompanyAbout";
import { Flash } from "./Flash";
import { Hint } from "./Hint";
import { Range52 } from "./InvestPanels";
import { LiveChip, LiveDot } from "./LiveMark";
import { StyleBadge } from "./StyleBadge";

/**
 * 종목 페이지 머리 카드 (2026-11-10 개편, 사용자 시안) — 위 줄(글자 칸 · 티커 · 회사 · 거래소 · 가격 · 매수)은 내려도 화면 위에
 * 붙고, 그 아래 업종 · 시총 · 경기 성격 → 판정 버튼 줄 → 52주 범위 · 기간 수익률 · PER · 다음 실적 → 회사 소개(두 줄).
 * 붙는 위 줄은 main 의 바로 아래 자식이어야 페이지 끝까지 붙어 있어서(sticky 는 부모 안에서만) 카드를 두 조각으로 그린다.
 */

export type VerdictItem = { k: string; v: React.ReactNode; kind?: "score" | "good" | "mid" | "bad" };

/** TradingView 심볼 앞 거래소 — 'NASDAQ:티커' → 'NASDAQ' (모르면 null). */
function exchangeOf(tv: string | null | undefined): string | null {
  const ex = tv?.split(":")[0]?.trim();
  if (!ex || ex === tv) return null;
  return ex === "AMEX" ? "NYSE American" : ex;
}

/** 52주 위치 → 저점 근처(20% 이하) · 중간 · 고점 근처(80% 이상). */
function posZone(pos: number): "low" | "mid" | "high" {
  return pos <= 0.2 ? "low" : pos >= 0.8 ? "high" : "mid";
}

export function StockHead({
  ticker, company, price, info, extra, held, about, barDate, valuation, verdict, earnings, bench, lang, t,
}: {
  ticker: string;
  company: string | null;
  price: number | null;
  info: TickerInfo | null; // 종목 정보 (dashboard 먼저, 없으면 전체분석)
  extra: { info: TickerInfo; market: string } | null; // 전체분석 종목 파일 — 하루 · 3달 · 1년 수익률 · 52주 범위 · 거래소
  held: boolean;
  about: About | null;
  barDate: string | null;
  valuation: Valuation | null | undefined;
  verdict: VerdictItem[];
  earnings: { v: React.ReactNode; soon: boolean } | null;
  bench: Benchmark | null | undefined;
  lang: Lang;
  t: Dict;
}) {
  const S = t.sp;
  const ret = extra?.info.ret_1d != null ? extra.info : null; // 기간 수익률은 전체분석 숫자 (그 밤 하루 수익률이 있을 때만)
  const live: LiveMark | null = info?.live ?? ret?.live ?? null;
  const r1 = ret?.ret_1d ?? null;
  const chg = r1 != null && price != null ? price - price / (1 + r1) : null;
  const exchange = exchangeOf(extra?.info.tv ?? info?.tv);
  const inSp500 = [extra?.market, info?.market].includes("sp500");
  const cap = info?.fundamentals?.market_cap != null ? moneyText(bigUsd(info.fundamentals.market_cap), ticker) : info?.market_cap
    ? moneyText(info.market_cap, ticker) : null;
  const range52 = info?.range_52w ?? extra?.info.range_52w ?? null;
  let pos = info?.position_52w ?? null;
  if (range52 && price != null && range52.high > range52.low) pos = (price - range52.low) / (range52.high - range52.low);
  if (pos != null) pos = Math.min(1, Math.max(0, pos));
  const pe = valuation ? headlinePe(valuation) : null;
  const peCmp = pe ? compareVal(pe.self, pe.ind) : null;

  const P = t.invest.periods;
  const live5 = !!live && Array.isArray(ret?.live_heat);
  const rets = ret
    ? [
        { k: P.d1, v: ret.ret_1d, n: 1, live: !!live },
        { k: P.w1, v: ret.ret_5d, n: 5, live: live5 },
        { k: P.m1, v: ret.ret_20d, n: 20 },
        { k: P.m3, v: ret.ret_63d, n: 63 },
        { k: P.y1, v: ret.ret_252d, n: 252 },
      ]
    : [];
  const meta = info
    ? [sector(lang, info.sector), industry(lang, info.industry), cap && t.common.marketCap(cap)].filter(Boolean).join(" · ")
    : "";

  return (
    <>
      {/* 위 줄 — 내려도 화면 위에 붙는다 (차트 · 지표를 보다가 바로 매수) */}
      <div className="sd-top">
        <span className="sd-ava" aria-hidden="true">{ticker.replace(/[^A-Z0-9]/g, "").slice(0, 1) || ticker.slice(0, 1)}</span>
        <div className="sd-id">
          <h1 className="tick sd-tick">{ticker}</h1>
          {company && <span className="sd-name">{company}</span>}
          <span className="sd-tags">
            {exchange && <span className="sd-tag">{exchange}</span>}
            {inSp500 && <span className="sd-tag sd-tag--idx">S&amp;P 500</span>}
            {held && <span className="badge badge--held">{t.common.held}</span>}
          </span>
        </div>
        <div className="sd-px">
          <span className="sd-px__line">
            <Flash v={price} className="num sd-px__v">{money(price, ticker)}</Flash>
            {chg != null && (
              <span className={`num sd-px__chg ${tone(r1)}`}>
                <span className="sd-px__abs">{chg > 0 ? "▲" : chg < 0 ? "▼" : ""} {num(Math.abs(chg), 2)} </span>
                <span className="sd-px__pct">{pct(r1, 2)}</span>
              </span>
            )}
          </span>
          <span className="sd-px__sub">
            {live ? <LiveChip mark={live} t={t} /> : barDate ? S.closeOf(fmtDate(barDate, lang)) : null}
          </span>
        </div>
        <span className="sd-top__buy">
          <BuyButton ticker={ticker} info={info} />
        </span>
      </div>

      <section className="sd-body" aria-label={company ?? ticker}>
        {(meta || info?.style) && (
          <p className="sd-meta">
            {/* 폰은 위 줄이 한 줄뿐이라 장중 · 마감 표시를 여기에 */}
            <span className="sd-meta__live">
              {live ? <LiveChip mark={live} t={t} /> : barDate ? S.closeOf(fmtDate(barDate, lang)) : null}
            </span>
            {meta}
            {info?.style && (info.style.cycle || info.style.region) && (
              <span className="sd-meta__style">
                <StyleBadge style={info.style} />
                {info.style.region && <span className="muted">{regionBasis(t, info.style)}</span>}
              </span>
            )}
          </p>
        )}

        {verdict.length > 0 && (
          <dl className="sd-verdict" aria-label={t.invest.quant}>
            {verdict.map((x) => (
              <div key={x.k} className={`sd-pill${x.kind ? ` sd-pill--${x.kind}` : ""}`}>
                <dt>{x.k}</dt>
                <dd>{x.v}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="sd-glance">
          {pos != null && info && (
            <div className="sd-cell sd-cell--r52">
              <span className="sd-cell__k">{t.invest.range52}</span>
              <Range52 ticker={ticker} info={{ ...info, range_52w: range52 }} price={price} t={t} />
              <Hint text={S.posHelp} className={`sd-postag sd-postag--${posZone(pos)}`}>
                {S.pos[posZone(pos)]} · {pct(pos, 0, false)}
              </Hint>
            </div>
          )}
          {rets.length > 0 && (
            <dl className="sd-rets" aria-label={t.invest.returns}>
              {rets.map((r) => (
                <div key={r.k} className="sd-ret">
                  <dt>{r.k}{r.live && <LiveDot mark={live} t={t} />}</dt>
                  <dd className={`num ${tone(r.v)}`}>{pct(r.v)}</dd>
                  <dd className="sd-ret__spy num">{t.invest.vsSpy(pct(spyBack(bench, r.n, r.live && live ? live.day : barDate)))}</dd>
                </div>
              ))}
            </dl>
          )}
          {pe && (
            <div className="sd-cell">
              <Hint text={t.invest.valHelp[pe.key]} className="sd-cell__k">{t.invest.valNames[pe.key]}</Hint>
              <b className="num sd-cell__v">{pe.self != null && pe.self > 0 ? num(pe.self, 1) : t.invest.valLoss}</b>
              {pe.ind != null && peCmp && (
                <span className="sd-cell__sub">{t.invest.vsInd(num(pe.ind, 1))} · {cmpText(peCmp, t)}</span>
              )}
            </div>
          )}
          {earnings && (
            <div className={`sd-cell${earnings.soon ? " sd-cell--soon" : ""}`}>
              <span className="sd-cell__k">{t.common.nextEarnings}</span>
              <b className="sd-cell__v">{earnings.v}</b>
            </div>
          )}
        </div>

        {about && (
          <div className="sd-about">
            <span className="sd-about__k">{S.about}</span>
            <div className="sd-about__body">
              <AboutText about={about} />
            </div>
          </div>
        )}
      </section>
    </>
  );
}
