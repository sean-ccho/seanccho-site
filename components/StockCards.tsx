import { bigUsd, ceoCaUrl, dividendOf, fmtDate, money, moneyText, num, openinsiderUrl, pct, tmxUrl, tone } from "@/lib/format";
import { healthDetail, marketName, type Dict, type Lang } from "@/lib/i18n";
import type { SecFlag, TickerInfo } from "@/lib/types";
import { Hint } from "./Hint";
import { Dot, Icon } from "./Icon";
import { PatternBadges, SqzAlignedChips, SqzCompact } from "./StockChips";

/*
 * 종목 페이지 카드들 (2026-11-10 개편, 사용자 시안) — 서버 컴포넌트. 카드마다 className 으로 격자 폭(sd-w1 · sd-w2)을 받는다.
 *  · SqzCard     SQZ 모멘텀 — 일 · 주 · 월 한 줄씩
 *  · TechCard    차트 패턴 · 핵심 지표 — 패턴 배지 + RSI · ATR · 시장/섹터 대비 + 실적 다음 날 움직임
 *  · FinCard     핵심 재무 요약 — 8칸 (매출 · 이익 성장, 마진, ROE, 부채, 현금흐름, 배당, 공매도)
 *  · SecCard     SEC 공시 · 위험 신호 — 경고마다 무슨 공시인지 한 줄
 *  · SourcesCard 자료 출처 · 바로가기
 * 숫자 · 글자는 전부 Project_1 밤 데이터 그대로 — 시안의 평가 문구(견고 · 극도로 안전 · 반등 시그널 등)는 근거가 없어 쓰지 않는다.
 */

type TileProps = { k: React.ReactNode; v: React.ReactNode; cls?: string; cap?: React.ReactNode; help?: string };

function Tile({ k, v, cls, cap, help }: TileProps) {
  return (
    <div className="sd-tile">
      <dt>{help ? <Hint text={help}>{k}</Hint> : k}</dt>
      <dd className={`sd-tile__v${cls ? ` ${cls}` : ""}`}>{v}</dd>
      {cap && <dd className="sd-tile__cap">{cap}</dd>}
    </div>
  );
}

export function SqzCard({ info, t, className = "" }: { info: TickerInfo; t: Dict; className?: string }) {
  return (
    <section className={`card sd-card ${className}`} aria-labelledby="sqz-title">
      <div className="sd-card__head">
        <h2 id="sqz-title">{t.list.sqz}</h2>
        <SqzAlignedChips info={info} />
      </div>
      <SqzCompact info={info} />
      <p className="tiny muted sd-note">{t.list.sqzNote}</p>
    </section>
  );
}

/** RSI 구간 — 70 이상 과열 · 60~70 과열 쪽 · 40~60 중간 · 30~40 과매도 쪽 · 30 이하 과매도. */
function rsiZone(v: number): keyof Dict["sp"]["rsiCap"] {
  return v >= 70 ? "over" : v >= 60 ? "nearOver" : v > 40 ? "mid" : v > 30 ? "nearUnder" : "under";
}

/**
 * 차트 패턴 · 핵심 지표. showRet = 머리에 기간 수익률 줄이 없을 때(그 밤 숫자가 아직 없음) 5일 · 20일 수익률과 52주 위치를 여기.
 */
export function TechCard({ info, showRet, lang, t, className = "" }: {
  info: TickerInfo; showRet: boolean; lang: Lang; t: Dict; className?: string;
}) {
  const S = t.sp;
  const rsi = info.rsi;
  const zone = rsi != null ? rsiZone(rsi) : null;
  const mkt = marketName(lang, info.market);
  const move = info.earnings_move ?? null;
  return (
    <section className={`card sd-card ${className}`} aria-labelledby="tech-title">
      <div className="sd-card__head">
        <h2 id="tech-title">{S.techTitle}</h2>
      </div>
      <PatternBadges info={info} none={S.patNone} />
      <dl className="sd-tiles sd-tiles--2">
        <Tile k={S.rsiTitle} v={rsi != null ? num(rsi, 1) : "—"}
          cls={zone === "over" ? "sd-warn" : zone === "under" ? "down" : undefined} cap={zone ? S.rsiCap[zone] : null} />
        <Tile k={t.stock.atr} v={pct(info.atr_pct, 1, false)} cap={S.atrCap} />
        <Tile k={t.stock.relMarket} v={pct(info.rel_market)} cls={tone(info.rel_market)}
          cap={mkt ? S.relMarketCap(mkt) : S.relMarketCapAny} />
        <Tile k={t.stock.relSector} v={pct(info.rel_sector)} cls={tone(info.rel_sector)} cap={S.relSectorCap} />
        {showRet && <Tile k={S.ret5} v={pct(info.ret_5d)} cls={tone(info.ret_5d)} />}
        {showRet && <Tile k={S.ret20} v={pct(info.ret_20d)} cls={tone(info.ret_20d)} />}
        {showRet && info.position_52w != null && (
          <Tile k={t.stock.pos52} v={pct(info.position_52w, 0, false)} help={t.stock.pos52Help} />
        )}
      </dl>
      {move && (
        <div className="sd-earn" title={t.earn.badgeTitle(move.n, pct(move.avg, 1, false), pct(move.worst),
          move.timing ? t.earn.timing[move.timing] : "")}>
          <span className="sd-earn__k">
            {S.earnTitle}{move.timing ? ` · ${t.invest.timing[move.timing]}` : ""}
          </span>
          <b className="num">{S.earnAvg(pct(move.avg, 1, false))}</b>
          <span className="small muted">{S.earnRange(pct(move.worst), pct(move.best), move.n)}</span>
        </div>
      )}
    </section>
  );
}

/** 핵심 재무 요약 — 8칸 + 맨 아래 기관 보유 · 헬스체크 근거. 금액은 그 종목 통화 (캐나다 상장은 C$). */
export function FinCard({ info, ticker, cad, lang, t, className = "" }: {
  info: TickerInfo; ticker: string; cad: boolean; lang: Lang; t: Dict; className?: string;
}) {
  const f = info.fundamentals;
  if (!f) return null;
  const S = t.sp;
  const T = t.stock;
  const div = dividendOf(f);
  const big = (v: number | null | undefined) => moneyText(bigUsd(v), ticker);
  const times = (v: number | null | undefined, k = 1) => (v != null ? T.times(num(v / k)) : "—");
  // 공매도 — FINRA(미국) · Yahoo(캐나다) 잔고가 있으면 그것 (되사기 · 직전 대비까지), 없으면 Yahoo 유통주식 대비
  const sh = info.short ?? null;
  const shortPct = sh?.pct ?? f.short_pct_float;
  const shortCap = sh
    ? sh.dtc != null
      ? sh.change != null ? S.shortCap(num(sh.dtc, 1), pct(sh.change, 0)) : S.shortCapDtc(num(sh.dtc, 1))
      : null
    : f.short_pct_float != null ? S.shortCapYahoo : null;
  const foot = [
    f.institutional_pct != null ? S.inst(pct(f.institutional_pct, 1, false)) : null,
    info.health?.detail ? S.healthWhy(healthDetail(lang, info.health.detail)) : null,
  ].filter(Boolean);
  return (
    <section className={`card sd-card ${className}`} aria-labelledby="fin-title">
      <div className="sd-card__head">
        <h2 id="fin-title">{S.finTitle}</h2>
        <span className="sd-head-note">{S.finSub}</span>
      </div>
      <dl className="sd-tiles sd-tiles--4">
        <Tile k={T.revenueGrowth} v={pct(f.revenue_growth)} cls={tone(f.revenue_growth)} cap={S.yoyCap} />
        <Tile k={T.earningsGrowth} v={pct(f.earnings_growth)} cls={tone(f.earnings_growth)} cap={S.yoyCap} />
        <Tile k={T.grossMargin} v={pct(f.gross_margin, 1, false)}
          cap={f.profit_margin != null ? S.netMarginCap(pct(f.profit_margin, 1, false)) : null} />
        <Tile k={T.roe} v={pct(f.roe, 1, false)} cap={S.roeCap} />
        <Tile k={T.debtToEquity} v={times(f.debt_to_equity, 100)}
          cap={f.current_ratio != null ? S.currentCap(times(f.current_ratio)) : null} />
        <Tile k={T.fcf} v={big(f.free_cashflow)} cls={tone(f.free_cashflow)}
          cap={f.operating_cashflow != null ? S.ocfCap(big(f.operating_cashflow)) : null} />
        <Tile k={S.divTitle} help={T.annualDividendHelp}
          v={div.a == null ? "—" : div.a > 0 ? money(div.a, ticker, 2) : t.common.noDividend}
          cap={div.a && div.y != null ? S.divYieldCap(pct(div.y, 2, false)) : null} />
        <Tile k={S.shortTitle} help={sh?.settle && !cad ? `${S.shortHelp(fmtDate(sh.settle, lang))}\n${t.squeeze.dtcHelp}` : t.squeeze.dtcHelp}
          v={<>
            {pct(shortPct, 1, false)}
            {info.squeeze && (
              <span className={`badge ${info.squeeze === "fire" ? "badge--bad" : "badge--warn"} sd-tile__badge`}>
                {info.squeeze === "fire" && <Icon name="flame" size={12} />}
                {info.squeeze === "fire" ? t.squeeze.badgeFire : t.squeeze.badgeFuel}
              </span>
            )}
          </>}
          cls={sh?.high ? "down" : undefined} cap={shortCap} />
      </dl>
      {foot.length > 0 && <p className="tiny muted sd-note">{foot.join(" · ")}</p>}
    </section>
  );
}

const SEC_BADGE = { red: "badge--bad", orange: "badge--warn", yellow: "badge--mid" } as const;

/** SEC 공시 · 위험 신호 — 경고마다 이름 · 날짜 · 양식 · 무슨 공시인지 · 원문. 미국 상장만 (캐나다는 카드째 뺀다). */
export function SecCard({ flags, ticker, lang, t }: { flags: SecFlag[]; ticker: string; lang: Lang; t: Dict }) {
  const S = t.sp;
  const all = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(ticker)}&owner=include&count=40`;
  return (
    <section className="card sd-card" aria-labelledby="sec-title">
      <div className="sd-card__head">
        <h2 id="sec-title">{S.secTitle}</h2>
        {flags.length > 0 && <span className="sd-badge sd-badge--warn">{t.common.count(flags.length)}</span>}
      </div>
      <p className="sd-sub">{t.sec.sub}</p>
      {flags.length ? (
        <ul className="sd-sec">
          {flags.map((f) => (
            <li key={f.code} className={`sd-sec__item sd-sec__item--${f.severity}`}>
              <p className="sd-sec__top">
                <span className={`badge ${SEC_BADGE[f.severity]}`}><Dot tone={f.severity} />{t.sec.codes[f.code] ?? f.label}</span>
                <span className="small muted num">
                  {fmtDate(f.date, lang)} · {f.form}{f.count > 1 ? ` · ${t.sec.count(f.count)}` : ""}
                </span>
              </p>
              <p className="small sd-sec__desc">
                {S.secDesc[f.code]}
                {f.url && (
                  <>
                    {" "}
                    <a className="link-strong" href={f.url} target="_blank" rel="noopener noreferrer">{t.sec.open}</a>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted" style={{ margin: "8px 0 0" }}>{t.sec.none}</p>
      )}
      <p className="sd-note small">
        <a className="link-strong" href={all} target="_blank" rel="noopener noreferrer">{S.secAll}</a>
      </p>
    </section>
  );
}

/** 바깥 링크 — 캐나다 상장은 Finviz · openinsider · SEC 대신 ceo.ca(토론 · SEDI 내부자) · TMX Money. */
function externalLinks(ticker: string, cad: boolean): { label: string; href: string }[] {
  const q = encodeURIComponent(ticker);
  if (cad) {
    return [
      { label: "Yahoo Finance", href: `https://finance.yahoo.com/quote/${q}` },
      { label: "ceo.ca", href: ceoCaUrl(ticker) },
      { label: "TMX Money", href: tmxUrl(ticker) },
    ];
  }
  return [
    { label: "Yahoo Finance", href: `https://finance.yahoo.com/quote/${q}` },
    { label: "Finviz", href: `https://finviz.com/quote.ashx?t=${q}` },
    { label: "openinsider", href: openinsiderUrl(ticker) },
    { label: "SEC EDGAR", href: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${q}&type=10-Q` },
  ];
}

/** 자료 출처 · 바로가기 — 이 페이지 숫자가 어디서 왔는지 + 바깥 사이트 + 기준일. */
export function SourcesCard({ ticker, cad, barDate, lang, t }: {
  ticker: string; cad: boolean; barDate: string | null; lang: Lang; t: Dict;
}) {
  const S = t.sp;
  const keys = cad ? ["price", "insiderCa", "shortCa", "chart", "news"] : ["price", "sec", "insider", "congress", "short", "chart", "news"];
  return (
    <section className="card sd-card sd-srccard" aria-labelledby="src-title">
      <div className="sd-card__head">
        <h2 id="src-title">{S.srcTitle}</h2>
        {barDate && <span className="sd-head-note">{S.srcAsOf(fmtDate(barDate, lang))}</span>}
      </div>
      <div className="sd-links">
        {externalLinks(ticker, cad).map((l) => (
          <a key={l.href} className="btn btn--small" href={l.href} target="_blank" rel="noopener noreferrer">
            {l.label} ↗
          </a>
        ))}
      </div>
      <dl className="sd-src">
        {keys.map((k) => (
          <div key={k}>
            <dt>{S.srcRows[k][0]}</dt>
            <dd>{S.srcRows[k][1]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
