import { fmtDate, pct, pp, todayToronto } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n";
import { daysUntil, getMacro, type BocMeeting, type FomcMeeting, type MacroData, type MacroIndicator } from "@/lib/macro";
import { LiveDot } from "./LiveMark";
import { MacroSpark, type SparkPoint } from "./MacroSpark";

const STATUS_BADGE = { good: "badge--good", watch: "badge--warn", bad: "badge--bad" } as const;
const REF_LINE: Partial<Record<MacroIndicator["key"], number>> = { sahm: 0.5, curve: 0, spy200: 0, cycdef: 100 };

/** 다음 결정 · 앞으로 일정 — 올해가 아니면 연도를 붙인다. */
function dayText(iso: string, lang: Lang, today: string): string {
  const base = fmtDate(iso, lang, true);
  if (iso.slice(0, 4) === today.slice(0, 4)) return base;
  return lang === "ko" ? `${iso.slice(0, 4)}년 ${base}` : `${base}, ${iso.slice(0, 4)}`;
}

const n2 = (v: unknown) => (typeof v === "number" ? v.toFixed(2) : "—");
const num = (v: unknown) => (typeof v === "number" ? v : null);

/** 지표 한 줄의 글자 (값 · 비교 · 판정) — macro_scan.indicator_row 와 같은 내용. */
export function indicatorTexts(i: MacroIndicator, t: Dict): { value: string; cmp: string; status: string } {
  const M = t.macro;
  const x = i.extra;
  const status = M.status[i.status];
  switch (i.key) {
    case "sahm":
      return { value: M.sahm(n2(i.value)), cmp: M.sahmCmp(typeof x.unrate === "number" ? x.unrate.toFixed(1) : "—", n2(x.max12)), status };
    case "claims":
      return { value: M.claims(i.value ?? 0), cmp: M.claimsCmp(num(x.low52) ?? 0, pct(num(x.rise))), status };
    case "curve":
      return { value: pp(i.value != null ? i.value / 100 : null, 0, 2), cmp: M.curveCmp(num(x.inverted_days_1y) ?? 0), status };
    case "hy":
      return { value: `${n2(i.value)}%`, cmp: M.hyCmp(n2(x.ago3m), pp(num(x.chg3m) != null ? (x.chg3m as number) / 100 : null, 0, 2), n2(x.lo1y), n2(x.hi1y)), status };
    case "spy200":
      return { value: M.spy(pct(i.value)), cmp: M.spyCmp(pct(num(x.from_high))), status };
    case "cycdef":
      return {
        value: M.cyc(pct(num(x.m3))),
        cmp: M.cycCmp(pct(num(x.m1)), pct(num(x.m6)), pct(num(x.vs200))),
        status: M.lead[x.lead === "cyclical" ? "cyclical" : "defensive"],
      };
  }
}

/** 작은 차트 점의 글자 — 지표마다 단위가 다르다. */
function sparkPoints(i: MacroIndicator): SparkPoint[] {
  const f = (v: number) => {
    switch (i.key) {
      case "claims": return `${Math.round(v / 1000)}K`;
      case "curve": return pp(v / 100, 0, 2);
      case "hy": return `${v.toFixed(2)}%`;
      case "spy200": return pct(v);
      case "cycdef": return v.toFixed(1);
      default: return v.toFixed(2);
    }
  };
  return i.history.map(([d, v]) => ({ d, v, s: f(v) }));
}

/** 지표 카드 (2026-11-10 브리핑) — 이름 · 판정 → 큰 값 → 비교 → 작은 차트(예전 모양 그대로, 카드 폭) → 기준 설명. */
function IndicatorCard({ i, t, lang, live }: { i: MacroIndicator; t: Dict; lang: Lang; live: MacroData["live"] }) {
  const M = t.macro;
  const tx = indicatorTexts(i, t);
  return (
    <li className="macro-card">
      <div className="macro-card__head">
        <span className="macro-card__name">
          {M.label[i.key]}
          <LiveDot mark={live} t={t} />
        </span>
        <span className={`badge ${STATUS_BADGE[i.status]}`}>{tx.status}</span>
      </div>
      <p className="macro-card__value num">{tx.value}</p>
      <p className="macro-card__cmp">{tx.cmp}</p>
      <MacroSpark points={sparkPoints(i)} refLine={REF_LINE[i.key] ?? null} label={M.chart[i.key]} />
      <p className="macro-card__rule">
        {M.rule[i.key]} · {fmtDate(i.date, lang)}
      </p>
    </li>
  );
}

function rateText(bank: "fomc" | "boc", m: FomcMeeting | BocMeeting): string {
  if (bank === "fomc") {
    const f = m as FomcMeeting;
    return f.upper != null && f.lower != null ? `${f.lower.toFixed(2)}–${f.upper.toFixed(2)}%` : "";
  }
  const b = m as BocMeeting;
  return b.rate != null ? `${b.rate.toFixed(2)}%` : "";
}

function changeText(m: FomcMeeting | BocMeeting): string {
  if (m.change_bp == null) return "";
  return m.change_bp === 0 ? "0" : pp(m.change_bp / 10000, 0, 2);
}

function DecisionRows({ bank, rows, t }: { bank: "fomc" | "boc"; rows: (FomcMeeting | BocMeeting)[]; t: Dict }) {
  return (
    <tbody>
      {rows.map((m) => (
        <tr key={m.date}>
          <td className="small">
            <a className="num" href={m.url} target="_blank" rel="noopener noreferrer">{m.date}</a>
          </td>
          <td className={`small rate-dec rate-dec--${m.decision}`}>{t.macro.decision[m.decision]}</td>
          <td className="r num small">{changeText(m)}</td>
          <td className="r num small">{rateText(bank, m)}</td>
        </tr>
      ))}
    </tbody>
  );
}

/** 앞으로 일정 — 날짜 · 남은 날 · 같이 발표. lead = 첫 줄(다음 결정)을 굵게 + D-day 배지. */
function UpcomingRows({ rows, t, lang, today, lead }: { rows: (FomcMeeting | BocMeeting)[]; t: Dict; lang: Lang; today: string; lead: boolean }) {
  const M = t.macro;
  return (
    <tbody>
      {rows.map((m, i) => {
        const first = lead && i === 0;
        const with_ = "sep" in m ? (m.sep ? M.sep : "") : (m as BocMeeting).mpr ? M.mpr : "";
        return (
          <tr key={m.date} className={first ? "rate-next" : undefined}>
            <td className="small">{dayText(m.date, lang, today)}</td>
            <td className="small num">
              {m.decision === "pending" ? (
                <span className="badge badge--warn">{M.decision.pending}</span>
              ) : first ? (
                <span className="badge badge--mid">{M.dday(daysUntil(m.date, today))}</span>
              ) : (
                <span className="muted">{M.dday(daysUntil(m.date, today))}</span>
              )}
            </td>
            <td className="small muted">{with_}</td>
          </tr>
        );
      })}
    </tbody>
  );
}

const SOON = 4; // 앞으로 일정 — 펼치지 않고 보이는 개수 (약 반년)

function RatePanel({ bank, data, t, lang, today }: { bank: "fomc" | "boc"; data: MacroData; t: Dict; lang: Lang; today: string }) {
  const M = t.macro;
  const block = data.rates[bank];
  const title = bank === "fomc" ? M.fomc : M.boc;
  const full = bank === "fomc" ? M.fomcFull : M.bocFull;
  if (!block) {
    return (
      <div className="rate-panel">
        <h3 className="rate-panel__h">{title}</h3>
        <p className="small muted">{M.noRates}</p>
      </div>
    );
  }
  const meetings = block.meetings as (FomcMeeting | BocMeeting)[];
  const past = meetings.filter((m) => m.decision !== "upcoming" && m.decision !== "pending").reverse();
  const future = meetings.filter((m) => m.decision === "upcoming" || m.decision === "pending");
  const cur = block.current;
  const now = !cur ? "—" : "upper" in cur ? `${cur.lower.toFixed(2)}–${cur.upper.toFixed(2)}%` : `${cur.rate.toFixed(2)}%`;
  const soon = future.slice(0, SOON);
  const later = future.slice(SOON);
  const upHead = (
    <thead>
      <tr>
        <th scope="col">{M.colDate}</th>
        <th scope="col">{M.colLeft}</th>
        <th scope="col">{M.colWith}</th>
      </tr>
    </thead>
  );
  const head = (
    <thead>
      <tr>
        <th scope="col">{M.colDate}</th>
        <th scope="col">{M.colDecision}</th>
        <th scope="col" className="r">{M.colChange}</th>
        <th scope="col" className="r">{M.colRate}</th>
      </tr>
    </thead>
  );
  return (
    <div className="rate-panel">
      <h3 className="rate-panel__h">
        {title} <span className="muted small">{full}</span>
      </h3>
      <p className="rate-panel__now">
        <span className="muted small">{M.now}</span> <b className="num">{now}</b>
      </p>
      <p className="tiny muted rate-panel__label">{M.upcoming}</p>
      {soon.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table data-table--tight rate-table">
            {upHead}
            <UpcomingRows rows={soon} t={t} lang={lang} today={today} lead />
          </table>
        </div>
      ) : (
        <p className="small muted">{M.noUpcoming}</p>
      )}
      <p className="tiny muted rate-panel__label">{M.recent}</p>
      <div className="table-wrap">
        <table className="data-table data-table--tight rate-table">
          {head}
          <DecisionRows bank={bank} rows={past.slice(0, 6)} t={t} />
        </table>
      </div>
      <details className="rate-panel__all">
        <summary className="small">{M.all(past.length, later.length)}</summary>
        {later.length > 0 && (
          <>
            <p className="tiny muted rate-panel__label">{M.later}</p>
            <div className="table-wrap">
              <table className="data-table data-table--tight rate-table">
                {upHead}
                <UpcomingRows rows={later} t={t} lang={lang} today={today} lead={false} />
              </table>
            </div>
            <p className="tiny muted rate-panel__label">{M.pastAll}</p>
          </>
        )}
        <div className="table-wrap">
          <table className="data-table data-table--tight rate-table">
            {head}
            <DecisionRows bank={bank} rows={past} t={t} />
          </table>
        </div>
      </details>
    </div>
  );
}

/** 금리 결정 카드 (2026-11-10) — 지금 금리 · 다음 발표(D-day · 시각 · 같이 나오는 것) · 지난 결정 · 2021년부터 결정 뒤 금리 차트. */
function RateCard({ bank, data, t, lang, today }: { bank: "fomc" | "boc"; data: MacroData; t: Dict; lang: Lang; today: string }) {
  const M = t.macro;
  const B = t.brief;
  const block = data.rates[bank];
  const title = bank === "fomc" ? B.fomcCard : B.bocCard;
  if (!block) {
    return (
      <li className="macro-card rate-card">
        <div className="macro-card__head">
          <span className="macro-card__name">{title}</span>
        </div>
        <p className="macro-card__cmp">{M.noRates}</p>
      </li>
    );
  }
  const meetings = block.meetings as (FomcMeeting | BocMeeting)[];
  const past = meetings.filter((m) => m.decision !== "upcoming" && m.decision !== "pending");
  const next = (block.next ?? meetings.find((m) => m.decision === "upcoming" || m.decision === "pending")) as FomcMeeting | BocMeeting | null;
  const last = past[past.length - 1] ?? null;
  const cur = block.current;
  const now = !cur ? "—" : "upper" in cur ? `${cur.lower.toFixed(2)}–${cur.upper.toFixed(2)}%` : `${cur.rate.toFixed(2)}%`;
  const withText = !next ? "" : bank === "fomc" ? ((next as FomcMeeting).sep ? B.withSep : "") : (next as BocMeeting).mpr ? B.withMpr : "";
  // 결정 뒤 금리 (FOMC 는 목표 범위 위쪽) — 회의마다 한 점
  const points: SparkPoint[] = past
    .map((m) => {
      const v = bank === "fomc" ? (m as FomcMeeting).upper : (m as BocMeeting).rate;
      return v == null ? null : { d: m.date, v, s: rateText(bank, m) };
    })
    .filter((x): x is SparkPoint => x != null);
  return (
    <li className="macro-card rate-card">
      <div className="macro-card__head">
        <span className="macro-card__name">{title}</span>
        {next &&
          (next.decision === "pending" ? (
            <span className="badge badge--warn">{M.decision.pending}</span>
          ) : (
            <span className="badge badge--info">{B.nextDecision(M.dday(daysUntil(next.date, today)))}</span>
          ))}
      </div>
      <p className="macro-card__value num rate-card__now">{now}</p>
      <p className="macro-card__cmp">
        {next ? B.nextWhen(dayText(next.date, lang, today), bank === "fomc" ? B.fomcTime : B.bocTime, withText) : M.noUpcoming}
      </p>
      <MacroSpark points={points} label={B.rateChart(title)} />
      <p className="macro-card__rule">
        {last ? B.lastDecision(fmtDate(last.date, lang), [M.decision[last.decision], changeText(last)].filter((x) => x && x !== "0").join(" ")) : ""}
      </p>
    </li>
  );
}

/**
 * 오늘 탭 '경기 상태 · 금리 결정' 카드 (2026-10-30, 2026-11-10 브리핑 카드) — 경제 지표 4 · 시장 지표 2 · FOMC · BoC 를 같은 크기 카드 8개로,
 * 머리에 판정 개수, 맨 아래 펼치면 금리 일정 · 2021년부터 결정 표 (예전 칸 그대로). 보기 전용.
 */
export async function MacroSection({ lang, t }: { lang: Lang; t: Dict }) {
  const M = t.macro;
  const B = t.brief;
  const data = await getMacro();
  if (!data) {
    return (
      <section className="card empty">
        <p style={{ margin: 0 }}>{M.noData}</p>
      </section>
    );
  }
  const today = todayToronto();
  const n = { good: 0, watch: 0, bad: 0 };
  for (const i of data.indicators) n[i.status] += 1;
  const overall = n.bad ? "badge--bad" : n.watch ? "badge--warn" : "badge--good";
  const order = [...data.indicators.filter((i) => i.group === "economy"), ...data.indicators.filter((i) => i.group === "market")];
  const decided = (["fomc", "boc"] as const).reduce(
    (sum, b) => sum + (data.rates[b]?.meetings ?? []).filter((m) => m.decision !== "upcoming" && m.decision !== "pending").length,
    0,
  );
  return (
    <section className="card brief-card macro" aria-labelledby="macro-title">
      <div className="brief-head">
        <div className="brief-head__text">
          <h2 id="macro-title">
            {B.macroTitle} <span className="brief-en">{B.macroEn}</span>
          </h2>
          <p>{B.macroSub(fmtDate(data.as_of, lang))}</p>
        </div>
        <div className="brief-head__side">
          <span className={`badge ${overall} macro-overall`}>{B.overall(data.indicators.length, n.good, n.watch, n.bad)}</span>
        </div>
      </div>
      <ul className="macro-cards">
        {/* 장중(2026-11-09) — 시장 지표(SPY 200일선 · 순환/방어)는 15분마다 */}
        {order.map((i) => (
          <IndicatorCard key={i.key} i={i} t={t} lang={lang} live={data.live_keys?.includes(i.key) ? data.live : null} />
        ))}
        <RateCard bank="fomc" data={data} t={t} lang={lang} today={today} />
        <RateCard bank="boc" data={data} t={t} lang={lang} today={today} />
      </ul>
      <details className="macro-rates-all">
        <summary>{B.ratesAll(decided)}</summary>
        <p className="tiny muted" style={{ margin: "8px 0 0" }}>{M.ratesSub}</p>
        <div className="rates-grid">
          <RatePanel bank="fomc" data={data} t={t} lang={lang} today={today} />
          <RatePanel bank="boc" data={data} t={t} lang={lang} today={today} />
        </div>
      </details>
      <p className="tiny muted brief-note">
        {M.honest} {M.source}
      </p>
    </section>
  );
}

export function MacroSkeleton({ t }: { t: Dict }) {
  return (
    <section className="card brief-card macro" aria-busy="true">
      <div className="brief-head">
        <div className="brief-head__text">
          <h2>
            {t.brief.macroTitle} <span className="brief-en">{t.brief.macroEn}</span>
          </h2>
          <p>{t.news.loading}</p>
        </div>
      </div>
    </section>
  );
}
