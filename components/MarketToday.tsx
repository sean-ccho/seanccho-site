import Link from "next/link";
import { fmtDate, pct, stockHref, todayToronto, tone, usd } from "@/lib/format";
import { sector, type Dict, type Lang } from "@/lib/i18n";
import { capLabel, shortCompany } from "@/lib/market";
import type { MarketMover, MarketSummary } from "@/lib/types";
import { getDashboardCore } from "@/lib/dashboard";
import { getMarketSummary } from "@/lib/universeServer";

/**
 * 오늘 탭 '시장 한눈에' (2026-11-03) — 시장 폭(S&P 500) 한 줄 · 많이 오른 · 내린 · 거래량 급증 · 섹터별 하루.
 * 숫자는 전체분석이 같이 쓰는 market.json (밤 실행 · 마지막 끝난 봉 기준).
 */
export async function MarketToday({ lang, t }: { lang: Lang; t: Dict }) {
  const m = await getMarketSummary();
  if (!m) return null;
  const I = t.invest;
  const b = m.breadth;
  const upShare = b.adv + b.dec > 0 ? b.adv / (b.adv + b.dec) : 0.5;
  const maxAbs = Math.max(0.005, ...m.sectors.map((s) => Math.abs(s.chg)));
  return (
    <section className="mkt" aria-labelledby="mkt-title">
      <div className="section-head">
        <h2 id="mkt-title">{I.mktTitle}</h2>
        <p>{I.mktSub(fmtDate(m.bar_date, lang, true), capLabel(m.min_cap))}</p>
      </div>
      <dl className="kv-strip">
        <div>
          <dt>{I.spy}</dt>
          <dd className={`num ${tone(b.spy)}`}>{pct(b.spy, 2)}</dd>
        </div>
        <div>
          <dt className="help" title={I.equalHelp}>{I.equal}</dt>
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
          <dt className="help" title={I.aboveHelp}>{I.above50}</dt>
          <dd className="num">{pct(b.above50, 0, false)}</dd>
        </div>
        <div>
          <dt className="help" title={I.aboveHelp}>{I.above200}</dt>
          <dd className="num">{pct(b.above200, 0, false)}</dd>
        </div>
        <div>
          <dt>{I.highLow}</dt>
          <dd className="num">
            <span className="up">{b.new_high}</span> · <span className="down">{b.new_low}</span>
          </dd>
        </div>
      </dl>

      <div className="mkt-grid">
        <Movers title={I.gainers} rows={m.gainers} t={t} />
        <Movers title={I.losers} rows={m.losers} t={t} />
        <Movers title={I.volume} help={I.volumeHelp} rows={m.volume} t={t} vol />
      </div>

      <div className="mkt-sec">
        <h3>{I.sectors}</h3>
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
    </section>
  );
}

function Movers({ title, help, rows, t, vol }: { title: string; help?: string; rows: MarketMover[]; t: Dict; vol?: boolean }) {
  return (
    <div className="mkt-list">
      <h3 className={help ? "help" : undefined} title={help}>{title}</h3>
      <ol className={vol ? "mkt-rows mkt-rows--vol" : "mkt-rows"}>
        {rows.slice(0, 5).map((r) => (
          <li key={r.t}>
            <Link className="tick" href={stockHref(r.t)}>{r.t}</Link>
            <span className="mkt-rows__name">{shortCompany(r.name)}</span>
            <span className="num muted">{usd(r.px)}</span>
            {vol && <span className="num">{r.vr != null ? t.invest.volX(r.vr.toFixed(1)) : "—"}</span>}
            <span className={`num ${tone(r.chg)}`}>{pct(r.chg)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * 오늘 탭 '실적 발표 일정' (2026-11-03) — 앞으로 거래일 5일, 날마다 시가총액 큰 순 8개.
 * ★ = 오늘 매수 후보 (공개 화면이라 내 계좌 · PT-1 보유는 표시하지 않는다).
 */
export async function EarningsCalendar({ lang, t }: { lang: Lang; t: Dict }) {
  const [m, core] = await Promise.all([getMarketSummary(), getDashboardCore()]);
  const today = todayToronto();
  // 지난 날은 뺀다 (밤 실행이 하루 빠져도 어제 칸이 맨 앞에 남지 않게)
  const days = (m?.calendar ?? []).filter((d) => d.date >= today);
  if (!days.length) return null;
  const I = t.invest;
  const picks = new Set((core?.candidates ?? []).map((c) => c.ticker));
  return (
    <section className="ecal" aria-labelledby="ecal-title">
      <div className="section-head">
        <h2 id="ecal-title">{I.calTitle}</h2>
        <p>{I.calSub}</p>
      </div>
      <div className="ecal-grid">
        {days.map((day) => (
          <CalendarDay key={day.date} day={day} today={today} picks={picks} lang={lang} t={t} />
        ))}
      </div>
      <p className="tiny muted" style={{ margin: 0 }}>{I.calNote}</p>
    </section>
  );
}

function CalendarDay({ day, today, picks, lang, t }: {
  day: MarketSummary["calendar"][number];
  today: string;
  picks: Set<string>;
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
        <span className="tiny muted">{I.calCount(day.n, day.n_big)}</span>
      </div>
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
