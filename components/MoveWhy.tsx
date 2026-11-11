import { Suspense } from "react";
import { daysBetween } from "@/lib/earnings";
import { bigUsd, fmtDate, isCadListing, moneyText, num, pct } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n";
import { getTickerNews } from "@/lib/news";
import type { TickerInfo } from "@/lib/types";
import { Hint } from "./Hint";
import { Dot } from "./Icon";
import { LiveDot } from "./LiveMark";
import { NewsLine } from "./NewsList";

/**
 * 종목 페이지 '거래량 · 왜 움직였나' (2026-11-09) — 거래량이 평소의 몇 배인지(막대) + 같은 날 있었던 일(자료에서 찾은 단서) +
 * 최근 뉴스(구글 뉴스 3일). 표시 전용. 거래량 숫자(info.vol)는 Project_1 전체분석이 싣는다 — 예전 파일이면 목록과 같은
 * vol_ratio 하나만. 뉴스는 Suspense 라 늦거나 실패해도 나머지는 먼저 뜬다.
 */

const HOT = 1.5; // 목록 거래량 칩과 같은 강조 기준 (StockChips HOT_VOLUME)
const RANK_SHOWN = 20; // 1년 중 이 순위 안일 때만 '몇 번째로 많은 날'
const LOCKUP_DAYS: [number, number] = [170, 200]; // 상장 180일 보호예수 무렵 (달력 날짜)
const SEC_DAYS = 7;
const MARKET_MOVE = 0.015; // 지수가 이만큼 넘게 움직이면 '시장 전체도'
const SHORT_COVER = { pct: 0.1, ret: 0.05 };

/** 주식 수 — '2,396만' · '3.9억' / '24.0M' · '920K'. */
function shareCount(v: number, lang: Lang): string {
  if (lang === "ko") {
    if (v >= 1e8) return `${(v / 1e8).toFixed(v >= 1e9 ? 0 : 1)}억`;
    if (v >= 1e4) return `${Math.round(v / 1e4).toLocaleString("en-US")}만`;
    return Math.round(v).toLocaleString("en-US");
  }
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}K`;
  return Math.round(v).toLocaleString("en-US");
}

type Why = { key: string; text: string; tone?: "red" | "orange" | "yellow"; help?: string; href?: string };

/** 같은 날 있었던 일 — 자료에 있는 것만 (실적 · 상장 180일 · 신고가/신저가 · SEC 경고 · 숏스퀴즈 · 공매도 · 시장 전체). */
function sameDay(info: TickerInfo, day: string, spyDay: number | null, indexLabel: string, lang: Lang, t: Dict): Why[] {
  const M = t.move;
  const out: Why[] = [];
  const em = info.earnings_move;
  const react = em?.last?.at(-1);
  const timing = info.earnings_move?.timing ? t.invest.timing[info.earnings_move.timing] : "";
  if (react && react[0] === day) {
    const lead = em?.timing === "bmo" ? M.earnBmo : em?.timing === "amc" ? M.earnAmc : M.earnDay;
    out.push({ key: "earn", text: `${lead} · ${M.earnMove(pct(react[1]), pct(em!.avg, 1, false), em!.n)}` });
  } else if (info.earnings_date === day) {
    out.push({ key: "earn", text: timing ? `${M.earnToday} (${timing})` : M.earnToday });
  } else {
    const d = daysBetween(day, info.earnings_date);
    if (d != null && d > 0 && d <= 3) out.push({ key: "earn", text: M.earnSoon(fmtDate(info.earnings_date, lang), timing) });
  }
  const first = info.vol?.first;
  const since = daysBetween(first, day);
  if (first && since != null && since >= LOCKUP_DAYS[0] && since <= LOCKUP_DAYS[1]) {
    out.push({ key: "lockup", text: M.lockup(since, fmtDate(first, lang)), help: M.lockupHelp, tone: "yellow" });
  }
  if (info.new_high) out.push({ key: "nh", text: M.newHigh });
  if (info.new_low) out.push({ key: "nl", text: M.newLow });
  for (const f of info.sec_flags ?? []) {
    const age = daysBetween(f.date, day);
    if (age != null && age >= 0 && age <= SEC_DAYS) {
      out.push({ key: `sec-${f.code}`, text: M.sec(t.sec.codes[f.code] ?? f.label, fmtDate(f.date, lang)), tone: f.severity, href: f.url });
    }
  }
  if (info.squeeze === "fire") out.push({ key: "sq", text: M.squeeze });
  const sp = info.short?.pct;
  if (sp != null && sp >= SHORT_COVER.pct && (info.ret_1d ?? 0) >= SHORT_COVER.ret) {
    out.push({ key: "short", text: M.shortCover(pct(sp, 1, false)) });
  }
  // 지수가 크게 움직인 날 — 같은 방향이면 '시장 전체도', 반대 방향으로 크게(±3%+) 움직였으면 '시장과 반대로'
  const r1 = info.ret_1d ?? null;
  if (spyDay != null && Math.abs(spyDay) >= MARKET_MOVE) {
    if (r1 != null && r1 * spyDay < 0 && Math.abs(r1) >= 0.03) out.push({ key: "mkt", text: M.marketAgainst(indexLabel, pct(spyDay)) });
    else out.push({ key: "mkt", text: M.market(indexLabel, pct(spyDay)) });
  }
  return out;
}

export function MoveWhy({ ticker, info, barDate, spyDay, indexLabel, lang, t, className = "" }: {
  ticker: string;
  info: TickerInfo;
  barDate: string | null;
  spyDay: number | null; // 그 날 지수 하루 (장중이면 오늘 장중)
  indexLabel: string;
  lang: Lang;
  t: Dict;
  className?: string; // 종목 페이지 격자 폭 (2026-11-10)
}) {
  const M = t.move;
  const live = info.live ?? null;
  const vol = info.vol ?? null;
  // 밤 숫자의 배수 — 직전 20일 평균(오늘 뺀 것)이 있으면 그것, 없으면 목록과 같은 vol_ratio (장중엔 펄스 예상값이라 쓰지 않는다)
  const nightRatio = vol?.a20 ? vol.v / vol.a20 : !live ? info.vol_ratio ?? null : null;
  const head = live && info.vol_ratio != null ? info.vol_ratio : nightRatio;
  const nightPrice = info.price != null ? info.price / (live ? info.live_scale ?? 1 : 1) : null;
  const bars = vol
    ? [
        { k: "d", label: barDate ? M.barDay(fmtDate(barDate, lang)) : "", v: vol.v, today: true },
        { k: "a20", label: M.barA20, v: vol.a20 },
        { k: "a50", label: M.barA50, v: vol.n_prior >= 50 ? vol.a50 : null },
      ].filter((b): b is { k: string; label: string; v: number; today?: boolean } => b.v != null && b.v > 0)
    : [];
  const top = Math.max(1, ...bars.map((b) => b.v));
  const day = live?.day ?? barDate;
  const why = day ? sameDay(info, day, spyDay, indexLabel, lang, t) : [];
  const hot = head != null && head >= HOT;
  const company = info.company ?? null;

  return (
    <section className={`card sd-card ${className}`} aria-labelledby="mv-title">
      <div className="sd-card__head">
        <h2 id="mv-title">{M.title}</h2>
        {barDate && <span className="sd-head-note">{M.sub(fmtDate(barDate, lang))}</span>}
      </div>
      <div className="mv-grid">
        <div className="mv-col">
          {head != null && (
            <p className="mv-head">
              {live && info.vol_ratio != null ? (
                <>
                  <LiveDot mark={live} t={t} />
                  <span className={hot ? "mv-hot" : undefined}>{M.live(num(head, 1))}</span>
                </>
              ) : (
                <>
                  <span className="mv-lead">{M.lead}</span>{" "}
                  <b className={`num mv-x${hot ? " mv-hot" : ""}`}>{M.times(num(head, 1))}</b>
                  <span className="mv-basis">{vol?.a20 ? M.basis : M.basisOld}{!hot && head > 0.67 ? ` · ${M.quiet}` : ""}</span>
                </>
              )}
            </p>
          )}
          {live && info.vol_ratio != null && <p className="tiny muted mv-livenote">{M.liveNote}</p>}
          {bars.length > 0 && (
            <ul className="mv-bars">
              {bars.map((b) => (
                <li key={b.k} className={b.today ? "mv-bars__today" : undefined}>
                  <span className="mv-bars__label">{b.label}</span>
                  <span className="mv-bars__track" aria-hidden="true">
                    <i style={{ width: `${Math.max(2, (b.v / top) * 100)}%` }} className={b.today && hot ? "hot" : undefined} />
                  </span>
                  <span className="num mv-bars__v">{M.shares(shareCount(b.v, lang))}</span>
                </li>
              ))}
            </ul>
          )}
          {vol && (
            <p className="small muted mv-meta">
              {[
                vol.rank <= RANK_SHOWN ? (vol.first ? M.rankListed(vol.rank, vol.n) : M.rankYear(vol.rank)) : null,
                nightPrice ? M.dollar(moneyText(bigUsd(vol.v * nightPrice), ticker)) : null,
              ].filter(Boolean).join(" · ")}
            </p>
          )}
          <h3 className="mv-sub">{M.whyTitle}</h3>
          {why.length > 0 ? (
            <ul className="mv-why">
              {why.map((w) => (
                <li key={w.key}>
                  {w.tone ? <Dot tone={w.tone} /> : <span className="mv-why__dot" aria-hidden="true" />}
                  <span>
                    {w.href ? (
                      <a className="link-strong" href={w.href} target="_blank" rel="noopener noreferrer">{w.text}</a>
                    ) : w.text}
                    {w.help && <> <Hint text={w.help}>ⓘ</Hint></>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted" style={{ margin: "4px 0 0" }}>{M.whyNone}</p>
          )}
        </div>
        <div className="mv-col mv-news">
          <h3 className="mv-sub mv-sub--first">
            {M.newsTitle} <span className="tiny muted">{M.newsSub}</span>
          </h3>
          <Suspense fallback={<p className="news-none">{t.news.loading}</p>}>
            <StockNews ticker={ticker} name={company} lang={lang} t={t} />
          </Suspense>
        </div>
      </div>
      <p className="tiny muted" style={{ margin: "12px 0 0" }}>{M.note}</p>
    </section>
  );
}

/**
 * 차트 밑 한 줄 (2026-11-10 시안) — '거래량 2,819만 주 · 평소의 0.7배' + 아래 '거래량 · 왜 움직였나' 칸으로 가는 링크.
 * 배수는 위 카드와 같은 기준 (밤 = 직전 20일 평균 대비, 장중 = 펄스 예상값). 숫자가 하나도 없으면 안 그린다.
 */
export function VolumeLine({ info, lang, t }: { info: TickerInfo; lang: Lang; t: Dict }) {
  const M = t.move;
  const live = info.live ?? null;
  const vol = info.vol ?? null;
  const nightRatio = vol?.a20 ? vol.v / vol.a20 : !live ? info.vol_ratio ?? null : null;
  const head = live && info.vol_ratio != null ? info.vol_ratio : nightRatio;
  if (head == null && !vol) return null;
  const hot = head != null && head >= HOT;
  return (
    <p className="sd-volline small">
      <span className="muted">{M.lead}</span>
      {vol && !(live && info.vol_ratio != null) && <b className="num">{M.shares(shareCount(vol.v, lang))}</b>}
      {head != null && (
        <span className={hot ? "mv-hot" : undefined}>
          {live && info.vol_ratio != null ? M.live(num(head, 1)) : M.times(num(head, 1))}
        </span>
      )}
      <a className="link-strong" href="#mv-title">{t.sp.volWhy}</a>
    </p>
  );
}

/** 그 종목 최근 뉴스 — 오늘 탭 · 내계좌 뉴스와 같은 함수 (회사 이름 검색 3일, 없으면 30일 안 마지막 기사). */
async function StockNews({ ticker, name, lang, t }: { ticker: string; name: string | null; lang: Lang; t: Dict }) {
  const [n] = await getTickerNews([{ ticker, name, cad: isCadListing(ticker) }], lang);
  const now = Date.now();
  if (!n) return <p className="news-none">{t.news.failed}</p>;
  if (!n.items.length) {
    return n.last ? (
      <>
        <p className="news-none">{t.news.none} · {t.news.lastLabel}</p>
        <ul className="news-list">
          <li className="news-item"><NewsLine item={n.last} t={t} now={now} /></li>
        </ul>
      </>
    ) : (
      <p className="news-none">{t.news.noneAtAll}</p>
    );
  }
  return (
    <ul className="news-list">
      {n.items.map((it) => (
        <li className="news-item" key={it.url}>
          <NewsLine item={it} t={t} now={now} />
        </li>
      ))}
    </ul>
  );
}
