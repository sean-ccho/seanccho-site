import Link from "next/link";
import type { CSSProperties } from "react";
import { fmtDate, money, pct, pp, stockHref, todayToronto, tone } from "@/lib/format";
import { sector, type Dict, type Lang } from "@/lib/i18n";
import { capLabel, shortCompany } from "@/lib/market";
import { highLowHref, type HighLow } from "@/lib/stockList";
import type { MarketMover, MarketSummary, MegaEarning } from "@/lib/types";
import { getDashboardCore } from "@/lib/dashboard";
import { getMacro, type MacroEvent } from "@/lib/macro";
import { getMarketSummary } from "@/lib/universeServer";
import { BigEventList, EventLines, NextBadges, eventsByDate } from "./EventsSection";
import { Flash } from "./Flash";
import { Hint } from "./Hint";
import { LiveChip } from "./LiveMark";
import { Spark } from "./Spark";
import { MarketSwitch, type TodayMarket } from "./MarketSwitch";

const MARKETS: readonly TodayMarket[] = ["us", "ca"];

/** 두 시장 요약 (미국 universe-data · 캐나다 canada-data) — 있는 것만. 같은 fetch 라 두 칸이 불러도 한 번만 받는다. */
async function summaries(): Promise<Partial<Record<TodayMarket, MarketSummary>>> {
  const [us, ca] = await Promise.all([getMarketSummary("us"), getMarketSummary("ca")]);
  return { ...(us ? { us } : {}), ...(ca ? { ca } : {}) };
}

/**
 * 오늘 탭 '시장 한눈에' 카드 (2026-11-03, 2026-11-10 브리핑 카드) — 시장 폭 숫자 6칸(값 + 한 줄 풀이) · 섹터별 하루 칩 ·
 * 많이 오른 · 내린 · 거래량 급증. 숫자는 전체분석이 같이 쓰는 market.json (밤 실행 · 장중이면 15분 펄스).
 * 머리의 [미국 | 캐나다] 버튼(MarketSwitch)으로 바꾸고, 캐나다는 TSX 시총 C$1B 이상으로 시장 폭을 센다 (TSXV 동전주를 빼려고).
 */
export async function MarketToday({ lang, t }: { lang: Lang; t: Dict }) {
  const ms = await summaries();
  const keys = MARKETS.filter((k) => ms[k]);
  if (!keys.length) return null;
  const I = t.invest;
  const both = keys.length === 2;
  return (
    <section className="card brief-card mkt" aria-labelledby="mkt-title" data-both={both ? "" : undefined}>
      <div className="brief-head">
        <div className="brief-head__text">
          <h2 id="mkt-title">
            {I.mktTitle} <span className="brief-en">{t.brief.mktEn}</span>
          </h2>
          {keys.map((k) => {
            const m = ms[k]!;
            return (
              <p key={k} data-show={k}>
                {I.mktSub(fmtDate(m.bar_date, lang, true), capLabel(m.min_cap, k === "ca"), I.basis[k].name,
                  m.live ? (m.live.state === "live" ? t.live.when : t.live.whenClosing) : undefined)}
              </p>
            );
          })}
        </div>
        <div className="brief-head__side">
          {both && <MarketSwitch labels={I.mktSwitch} aria={I.mktSwitchAria} />}
          {keys.map((k) =>
            ms[k]!.live ? (
              <span key={k} className="brief-side-item" data-show={k}>
                <LiveChip mark={ms[k]!.live} t={t} />
              </span>
            ) : null,
          )}
        </div>
      </div>
      {keys.map((k) => (
        <MarketBody key={k} m={ms[k]!} mk={k} lang={lang} t={t} />
      ))}
    </section>
  );
}

/** 50 · 200일선 위 비율 한 줄 풀이 — 숫자만으론 많은지 적은지 바로 안 보여서. */
function aboveWord(v: number | null, t: Dict): string {
  if (v == null) return "";
  const W = t.brief.aboveWord;
  return v >= 0.6 ? W.most : v <= 0.4 ? W.few : W.half;
}

function MarketBody({ m, mk, lang, t }: { m: MarketSummary; mk: TodayMarket; lang: Lang; t: Dict }) {
  const I = t.invest;
  const B = t.brief;
  const basis = I.basis[mk];
  const b = m.breadth;
  const upShare = b.adv + b.dec > 0 ? b.adv / (b.adv + b.dec) : 0.5;
  const secs = m.sectors.filter((s) => s.sector && s.sector !== "Unknown").sort((a, z) => z.chg - a.chg);
  const maxAbs = Math.max(0.005, ...secs.map((s) => Math.abs(s.chg)));
  // 목록 행에 같은 표시가 실린 데이터(row_flags, 2026-11-04 추가)일 때만 숫자 → 전체분석 필터 링크 (예전 데이터는 빈 목록이 되니까)
  const flags = new Set(m.row_flags ?? []);
  const linked = flags.has("new_high") && flags.has("new_low");
  const cap = B.capMin(capLabel(m.min_cap, mk === "ca"));
  return (
    <div className="mkt-body" data-show={mk}>
      <dl className="mkt-tiles">
        <div className="mkt-tile">
          <dt>{mk === "ca" ? I.caIndex(m.index_label ?? "") : I.spy}</dt>
          <dd className={`mkt-tile__v num ${tone(b.spy)}`}>
            <Flash v={b.spy}>{pct(b.spy, 2)}</Flash>
          </dd>
          <dd className="mkt-tile__cap">{m.live ? B.tileLive(m.live.at) : B.tileClose(fmtDate(m.bar_date, lang))}</dd>
        </div>
        <div className="mkt-tile">
          <Hint as="dt" text={I.equalHelp(basis.name)}>{I.equal}</Hint>
          <dd className={`mkt-tile__v num ${tone(b.equal)}`}>
            <Flash v={b.equal}>{pct(b.equal, 2)}</Flash>
          </dd>
          <dd className="mkt-tile__cap">{B.tileEqual(pp(b.equal, b.spy, 2))}</dd>
        </div>
        <div className="mkt-tile">
          <dt>{I.advDec}</dt>
          <dd className="mkt-tile__v num">
            <Flash v={b.adv} className="up">{b.adv}</Flash>
            <span className="mkt-tile__sep">/</span>
            <Flash v={b.dec} className="down">{b.dec}</Flash>
          </dd>
          <dd className="mkt-tile__cap">
            <span className="mkt-bar mkt-bar--ad" aria-hidden="true">
              <i style={{ width: `${upShare * 100}%` }} />
            </span>
            {B.tileUpShare(pct(upShare, 1, false))}
          </dd>
        </div>
        {(["above50", "above200"] as const).map((k) => (
          <div key={k} className="mkt-tile">
            <Hint as="dt" text={I.aboveHelp(basis.name)}>{I[k]}</Hint>
            <dd className="mkt-tile__v num">
              <Flash v={b[k]}>{pct(b[k], 0, false)}</Flash>
            </dd>
            <dd className="mkt-tile__cap">
              <span className="mkt-bar" aria-hidden="true">
                <i style={{ width: `${(b[k] ?? 0) * 100}%` }} />
              </span>
              {aboveWord(b[k], t)}
            </dd>
          </div>
        ))}
        <div className="mkt-tile">
          <Hint as="dt" text={I.highLowHelp(linked, basis.name, basis.list)}>{I.highLow}</Hint>
          <dd className="mkt-tile__v num">
            <HighLowNum kind="high" n={b.new_high} linked={linked} mk={mk} t={t} />
            <span className="mkt-tile__sep">/</span>
            <HighLowNum kind="low" n={b.new_low} linked={linked} mk={mk} t={t} />
          </dd>
          <dd className="mkt-tile__cap">{B.tileHl(b.new_high, b.new_low)}</dd>
        </div>
      </dl>

      {/* 섹터별 하루 — 오른 섹터부터, 칩 바탕 진하기 = 움직인 크기 (가장 크게 움직인 섹터 기준) */}
      <div className="mkt-secrow">
        <h3 className="mkt-secrow__label">{I.sectors(basis.name)}</h3>
        <span className="mkt-secrow__sum">{B.secUp(secs.filter((s) => s.chg > 0).length, secs.length)}</span>
        <ul>
          {secs.map((s) => (
            <li key={s.sector} className={`mkt-secchip mkt-secchip--${tone(s.chg)}`} title={`${sector(lang, s.sector)} · ${s.n}`}
              style={{ "--a": `${Math.round(8 + (22 * Math.abs(s.chg)) / maxAbs)}%` } as CSSProperties}>
              <span>{sector(lang, s.sector)}</span>
              <b className={`num ${tone(s.chg)}`}>{pct(s.chg)}</b>
            </li>
          ))}
        </ul>
      </div>

      <div className="mkt-grid">
        <Movers title={I.gainers} en={B.gainersEn} side={cap} rows={m.gainers} t={t} />
        <Movers title={I.losers} en={B.losersEn} side={cap} rows={m.losers} t={t} />
        <Movers title={I.volume} en={B.volumeEn} side={cap} help={I.volumeHelp} rows={m.volume} t={t} vol />
      </div>
    </div>
  );
}

/** 52주 신고가 · 신저가 숫자 — 0 이 아니고 목록에 표시가 있으면 전체분석 (미국 S&P 500 · 캐나다 TSX, 그 필터 · 시가총액 순) 링크. */
function HighLowNum({ kind, n, linked, mk, t }: { kind: HighLow; n: number; linked: boolean; mk: TodayMarket; t: Dict }) {
  const color = kind === "high" ? "up" : "down";
  if (!linked || n <= 0) return <span className={color}>{n}</span>;
  const label = t.invest.highLowLink(kind, n, t.invest.basis[mk].name);
  return (
    <span className={color}>
      <Link className="mkt-hl" href={highLowHref(kind, mk)} prefetch={false} title={label} aria-label={label}>{n}</Link>
    </span>
  );
}

function Movers({ title, en, side, help, rows, t, vol }: {
  title: string;
  en: string;
  side: string;
  help?: string;
  rows: MarketMover[];
  t: Dict;
  vol?: boolean;
}) {
  const spark = rows.some((r) => r.sp); // 주봉 모양은 2026-11-06 부터 — 예전 파일이면 칸 없이 예전 그대로
  return (
    <div className="mkt-list">
      <div className="mkt-list__head">
        <Hint as="h3" text={help}>{title}</Hint>
        <span className="brief-en">{en}</span>
        <span className="mkt-list__side">{side}</span>
      </div>
      <ol className={`mkt-rows${vol ? " mkt-rows--vol" : ""}${spark ? " mkt-rows--spark" : ""}`}>
        {rows.slice(0, 5).map((r) => (
          <li key={r.t}>
            <Link className="tick" href={stockHref(r.t)}>{r.t}</Link>
            <span className="mkt-rows__name">{shortCompany(r.name)}</span>
            {spark && <Spark s={r.sp} label={t.list.spark} w={52} h={22} />}
            <span className="num muted">{money(r.px, r.t)}</span>
            {vol && <span className="num">{r.vr != null ? t.invest.volX(r.vr.toFixed(1)) : "—"}</span>}
            <Flash v={r.chg} className={`num ${tone(r.chg)}`}>{pct(r.chg)}</Flash>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * 오늘 탭 '이번 주 일정 · 실적 발표' 카드 (2026-11-03 '실적 발표 일정' → 11-06 경제 · 금리 · 정책 일정을 같은 날 칸 위쪽에 →
 * 11-10 브리핑 카드: 머리에 이번 주 뒤 큰 일정 배지, 맨 아래 펼치는 '다가오는 큰 일정') —
 * 앞으로 거래일 5일, 날마다 일정(macro.json events, 미국 · 캐나다 둘 다) + 실적 발표 시가총액 큰 순 8개.
 * ★(실적 줄) = 오늘 매수 후보 (공개 화면이라 내 계좌 · PT-1 보유는 표시하지 않는다). 캐나다 실적(2026-11-06)은 TSX · TSXV
 * 전 종목 중 시총 큰 순 — 매수 후보 · 장 전/후 · 실적 다음 날 움직임 자료가 없어 그 칸은 빈다.
 */
export async function EarningsCalendar({ lang, t }: { lang: Lang; t: Dict }) {
  const [ms, core, macro] = await Promise.all([summaries(), getDashboardCore(), getMacro()]);
  const today = todayToronto();
  // 지난 날은 뺀다 (밤 실행이 하루 빠져도 어제 칸이 맨 앞에 남지 않게)
  const daysOf = (k: TodayMarket) => (ms[k]?.calendar ?? []).filter((d) => d.date >= today);
  const keys = MARKETS.filter((k) => ms[k]);
  if (!keys.some((k) => daysOf(k).length)) return null;
  const I = t.invest;
  const E = t.events;
  const B = t.brief;
  const both = keys.length === 2;
  const picks = new Set((core?.candidates ?? []).map((c) => c.ticker));
  const none = new Set<string>();
  const events = macro?.events ?? [];
  const byDate = eventsByDate(events);
  const mega: Partial<Record<TodayMarket, MegaEarning[]>> = {};
  for (const k of keys) if (ms[k]?.mega?.length) mega[k] = ms[k]!.mega;
  return (
    <section className="card brief-card ecal" aria-labelledby="ecal-title" data-both={both ? "" : undefined}>
      <div className="brief-head">
        <div className="brief-head__text">
          {/* 예전 macro.json(일정 없음)이면 예전 이름 그대로 */}
          <h2 id="ecal-title">
            {byDate.size ? B.calTitle : I.calTitle} <span className="brief-en">{B.calEn}</span>
          </h2>
          {keys.map((k) => (
            <p key={k} data-show={k}>{byDate.size ? E.weekSub(k === "us") : I.calSub(k === "us")}</p>
          ))}
        </div>
        <div className="brief-head__side">
          {keys.map((k) => {
            const days = daysOf(k);
            return (
              <span key={k} className="brief-side-item brief-badges" data-show={k}>
                <NextBadges events={events} mega={mega[k] ?? []} after={days.length ? days[days.length - 1].date : today}
                  today={today} lang={lang} t={t} />
              </span>
            );
          })}
          {both && <MarketSwitch labels={I.mktSwitch} aria={I.mktSwitchAria} />}
        </div>
      </div>
      {keys.map((k) => {
        const days = daysOf(k);
        return (
          <div key={k} className="ecal-body" data-show={k}>
            {days.length > 0 ? (
              <div className="ecal-grid">
                {days.map((day) => (
                  <CalendarDay key={day.date} day={day} today={today} picks={k === "us" ? picks : none} mk={k}
                    events={byDate.get(day.date) ?? []} lang={lang} t={t} />
                ))}
              </div>
            ) : (
              <p className="tiny muted" style={{ margin: 0 }}>{I.calNone}</p>
            )}
            <p className="tiny muted brief-note">{I.calNote(k === "ca")}</p>
          </div>
        );
      })}
      {events.length > 0 && (
        <details className="ecal-big">
          <summary>{B.bigMore}</summary>
          <BigEventList events={events} mega={mega} today={today} lang={lang} t={t} />
        </details>
      )}
    </section>
  );
}

function CalendarDay({ day, today, picks, mk, events, lang, t }: {
  day: MarketSummary["calendar"][number];
  today: string;
  picks: Set<string>;
  mk: TodayMarket;
  events: MacroEvent[];
  lang: Lang;
  t: Dict;
}) {
  const I = t.invest;
  const B = t.brief;
  const isToday = day.date === today;
  return (
    <div className={`ecal-day${isToday ? " ecal-day--today" : ""}`}>
      <div className="ecal-day__head">
        <b>{fmtDate(day.date, lang, true)}</b>
        {isToday && <span className="ecal-today">{I.today}</span>}
        <span className="ecal-day__n">{B.earnN(day.n)}</span>
      </div>
      <EventLines events={events} lang={lang} t={t} />
      {day.items.length > 0 && <p className="ecal-sub">{B.earnSub(day.n_big, I.basis[mk].big)}</p>}
      <ol>
        {day.items.map((it) => (
          <li key={it.t}>
            <span className="ecal-tk">
              <Link className="tick" href={stockHref(it.t)}>{it.t}</Link>
              {picks.has(it.t) && <span className="gold" title={I.pick}>★</span>}
            </span>
            <span className="ecal-name">{shortCompany(it.name)}</span>
            {it.timing ? <span className={`ecal-tm ecal-tm--${it.timing}`}>{I.timing[it.timing]}</span> : <span />}
            <span className="num tiny muted" title={I.moveHelp}>{it.move != null ? `±${pct(it.move, 0, false)}` : ""}</span>
          </li>
        ))}
      </ol>
      {day.n > day.items.length && <p className="tiny muted ecal-more">{I.more(day.n - day.items.length)}</p>}
    </div>
  );
}
