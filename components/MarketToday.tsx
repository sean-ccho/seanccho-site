import Link from "next/link";
import { fmtDate, money, pct, stockHref, todayToronto, tone } from "@/lib/format";
import { sector, type Dict, type Lang } from "@/lib/i18n";
import { capLabel, shortCompany } from "@/lib/market";
import { highLowHref, type HighLow } from "@/lib/stockList";
import type { MarketMover, MarketSummary } from "@/lib/types";
import { getDashboardCore } from "@/lib/dashboard";
import { getMacro, type MacroEvent } from "@/lib/macro";
import { getMarketSummary } from "@/lib/universeServer";
import { EventLines, eventsByDate } from "./EventsSection";
import { Hint } from "./Hint";
import { Spark } from "./Spark";
import { MarketSwitch, type TodayMarket } from "./MarketSwitch";

const MARKETS: readonly TodayMarket[] = ["us", "ca"];

/** 두 시장 요약 (미국 universe-data · 캐나다 canada-data) — 있는 것만. 같은 fetch 라 두 칸이 불러도 한 번만 받는다. */
async function summaries(): Promise<Partial<Record<TodayMarket, MarketSummary>>> {
  const [us, ca] = await Promise.all([getMarketSummary("us"), getMarketSummary("ca")]);
  return { ...(us ? { us } : {}), ...(ca ? { ca } : {}) };
}

/**
 * 오늘 탭 '시장 한눈에' (2026-11-03) — 시장 폭 한 줄 · 많이 오른 · 내린 · 거래량 급증 · 섹터별 하루.
 * 숫자는 전체분석이 같이 쓰는 market.json (밤 실행 · 마지막 끝난 봉 기준). 2026-11-06 캐나다 판 — 머리의 [미국 | 캐나다]
 * 버튼(MarketSwitch)으로 바꾸고, 캐나다는 TSX 시총 C$1B 이상으로 시장 폭을 센다 (TSXV 동전주를 빼려고).
 */
export async function MarketToday({ lang, t }: { lang: Lang; t: Dict }) {
  const ms = await summaries();
  const keys = MARKETS.filter((k) => ms[k]);
  if (!keys.length) return null;
  const I = t.invest;
  const both = keys.length === 2;
  return (
    <section className="mkt" aria-labelledby="mkt-title" data-both={both ? "" : undefined}>
      <div className="section-head">
        <div className="mkt-head">
          <h2 id="mkt-title">{I.mktTitle}</h2>
          {both && <MarketSwitch labels={I.mktSwitch} aria={I.mktSwitchAria} />}
        </div>
        {keys.map((k) => {
          const m = ms[k]!;
          return (
            <p key={k} data-show={k}>
              {I.mktSub(fmtDate(m.bar_date, lang, true), capLabel(m.min_cap, k === "ca"), I.basis[k].name)}
            </p>
          );
        })}
      </div>
      {keys.map((k) => (
        <MarketBody key={k} m={ms[k]!} mk={k} lang={lang} t={t} />
      ))}
    </section>
  );
}

function MarketBody({ m, mk, lang, t }: { m: MarketSummary; mk: TodayMarket; lang: Lang; t: Dict }) {
  const I = t.invest;
  const B = I.basis[mk];
  const b = m.breadth;
  const upShare = b.adv + b.dec > 0 ? b.adv / (b.adv + b.dec) : 0.5;
  const maxAbs = Math.max(0.005, ...m.sectors.map((s) => Math.abs(s.chg)));
  // 목록 행에 같은 표시가 실린 데이터(row_flags, 2026-11-04 추가)일 때만 숫자 → 전체분석 필터 링크 (예전 데이터는 빈 목록이 되니까)
  const flags = new Set(m.row_flags ?? []);
  const linked = flags.has("new_high") && flags.has("new_low");
  return (
    <div className="mkt-body" data-show={mk}>
      <dl className="kv-strip">
        <div>
          <dt>{mk === "ca" ? I.caIndex(m.index_label ?? "") : I.spy}</dt>
          <dd className={`num ${tone(b.spy)}`}>{pct(b.spy, 2)}</dd>
        </div>
        <div>
          <Hint as="dt" text={I.equalHelp(B.name)}>{I.equal}</Hint>
          <dd className={`num ${tone(b.equal)}`}>{pct(b.equal, 2)}</dd>
        </div>
        <div>
          <dt>{I.advDec}</dt>
          <dd className="num">
            <span className="up">{b.adv}</span> · <span className="down">{b.dec}</span>
            <span className="mkt-ad" aria-hidden="true">
              <i style={{ width: `${upShare * 100}%` }} />
            </span>
          </dd>
        </div>
        <div>
          <Hint as="dt" text={I.aboveHelp(B.name)}>{I.above50}</Hint>
          <dd className="num">{pct(b.above50, 0, false)}</dd>
        </div>
        <div>
          <Hint as="dt" text={I.aboveHelp(B.name)}>{I.above200}</Hint>
          <dd className="num">{pct(b.above200, 0, false)}</dd>
        </div>
        <div>
          <Hint as="dt" text={I.highLowHelp(linked, B.name, B.list)}>{I.highLow}</Hint>
          <dd className="num">
            <HighLowNum kind="high" n={b.new_high} linked={linked} mk={mk} t={t} /> ·{" "}
            <HighLowNum kind="low" n={b.new_low} linked={linked} mk={mk} t={t} />
          </dd>
        </div>
      </dl>

      <div className="mkt-grid">
        <Movers title={I.gainers} rows={m.gainers} t={t} />
        <Movers title={I.losers} rows={m.losers} t={t} />
        <Movers title={I.volume} help={I.volumeHelp} rows={m.volume} t={t} vol />
      </div>

      <div className="mkt-sec">
        <h3>{I.sectors(B.name)}</h3>
        <ul>
          {m.sectors
            .filter((s) => s.sector && s.sector !== "Unknown")
            .map((s) => (
              <li key={s.sector} title={`${sector(lang, s.sector)} · ${s.n}`}>
                <span className="mkt-sec__name">{sector(lang, s.sector)}</span>
                <span className="mkt-sec__track" aria-hidden="true">
                  <i
                    className={s.chg >= 0 ? "pos" : "neg"}
                    style={{ width: `${(Math.abs(s.chg) / maxAbs) * 50}%` }}
                  />
                </span>
                <span className={`num mkt-sec__v ${tone(s.chg)}`}>{pct(s.chg)}</span>
              </li>
            ))}
        </ul>
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

function Movers({ title, help, rows, t, vol }: { title: string; help?: string; rows: MarketMover[]; t: Dict; vol?: boolean }) {
  const spark = rows.some((r) => r.sp); // 주봉 모양은 2026-11-06 부터 — 예전 파일이면 칸 없이 예전 그대로
  return (
    <div className="mkt-list">
      <Hint as="h3" text={help}>{title}</Hint>
      <ol className={`mkt-rows${vol ? " mkt-rows--vol" : ""}${spark ? " mkt-rows--spark" : ""}`}>
        {rows.slice(0, 5).map((r) => (
          <li key={r.t}>
            <Link className="tick" href={stockHref(r.t)}>{r.t}</Link>
            <span className="mkt-rows__name">{shortCompany(r.name)}</span>
            {spark && <Spark s={r.sp} label={t.list.spark} w={52} h={22} />}
            <span className="num muted">{money(r.px, r.t)}</span>
            {vol && <span className="num">{r.vr != null ? t.invest.volX(r.vr.toFixed(1)) : "—"}</span>}
            <span className={`num ${tone(r.chg)}`}>{pct(r.chg)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * 오늘 탭 '이번 주 일정' (2026-11-03 '실적 발표 일정' → 2026-11-06 경제 · 금리 · 정책 일정을 같은 날 칸 위쪽에) —
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
  const both = keys.length === 2;
  const picks = new Set((core?.candidates ?? []).map((c) => c.ticker));
  const none = new Set<string>();
  const byDate = eventsByDate(macro?.events);
  const title = byDate.size ? E.weekTitle : I.calTitle; // 예전 macro.json(일정 없음)이면 예전 이름 그대로
  return (
    <section className="ecal" aria-labelledby="ecal-title" data-both={both ? "" : undefined}>
      <div className="section-head">
        <div className="mkt-head">
          <h2 id="ecal-title">{title}</h2>
          {both && <MarketSwitch labels={I.mktSwitch} aria={I.mktSwitchAria} />}
        </div>
        {keys.map((k) => (
          <p key={k} data-show={k}>{byDate.size ? E.weekSub(k === "us") : I.calSub(k === "us")}</p>
        ))}
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
            <p className="tiny muted" style={{ margin: 0 }}>{I.calNote(k === "ca")}</p>
          </div>
        );
      })}
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
  const isToday = day.date === today;
  return (
    <div className={`ecal-day${isToday ? " ecal-day--today" : ""}`}>
      <div className="ecal-day__head">
        <b>{fmtDate(day.date, lang, true)}</b>
        {isToday && <span className="ecal-today">{I.today}</span>}
        <span className="tiny muted">{I.calCount(day.n, day.n_big, I.basis[mk].big)}</span>
      </div>
      <EventLines events={events} lang={lang} t={t} />
      {events.length > 0 && day.items.length > 0 && <p className="ecal-ev__sep tiny muted">{t.events.earnHead}</p>}
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
