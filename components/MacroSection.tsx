import { fmtDate, pct, pp, todayToronto } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n";
import { daysUntil, getMacro, type BocMeeting, type FomcMeeting, type MacroData, type MacroIndicator } from "@/lib/macro";
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
function texts(i: MacroIndicator, t: Dict): { value: string; cmp: string; status: string } {
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

function IndicatorRow({ i, t, lang }: { i: MacroIndicator; t: Dict; lang: Lang }) {
  const M = t.macro;
  const tx = texts(i, t);
  return (
    <li className="macro-row">
      <div className="macro-row__head">
        <span className="macro-row__name">{M.label[i.key]}</span>
        <span className={`badge ${STATUS_BADGE[i.status]}`}>{tx.status}</span>
      </div>
      <div className="macro-row__body">
        <div>
          <p className="macro-row__value num">{tx.value}</p>
          <p className="small muted macro-row__cmp">{tx.cmp}</p>
        </div>
        <MacroSpark points={sparkPoints(i)} refLine={REF_LINE[i.key] ?? null} label={M.chart[i.key]} />
      </div>
      <p className="tiny muted macro-row__rule">
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
  const next = block.next;
  const dn = next ? daysUntil(next.date, today) : null;
  const flag = (m: FomcMeeting | BocMeeting) =>
    "sep" in m ? (m.sep ? M.sep : null) : (m as BocMeeting).mpr ? M.mpr : null;
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
      {next && (
        <p className="small rate-panel__next">
          {M.next} <b>{dayText(next.date, lang, today)}</b>
          {dn != null && dn >= 0 && <span className="badge badge--mid">{M.dday(dn)}</span>}
          {next.decision === "pending" && <span className="badge badge--warn">{M.decision.pending}</span>}
          {flag(next) && <span className="muted"> · {flag(next)}</span>}
        </p>
      )}
      <p className="tiny muted rate-panel__label">{M.recent}</p>
      <div className="table-wrap">
        <table className="data-table data-table--tight rate-table">
          {head}
          <DecisionRows bank={bank} rows={past.slice(0, 6)} t={t} />
        </table>
      </div>
      <details className="rate-panel__all">
        <summary className="small">{M.all(past.length)}</summary>
        {future.length > 0 && (
          <>
            <p className="tiny muted rate-panel__label">{M.upcoming}</p>
            <ul className="rate-upcoming small">
              {future.map((m) => (
                <li key={m.date}>
                  {dayText(m.date, lang, today)}
                  {flag(m) && <span className="muted"> · {flag(m)}</span>}
                </li>
              ))}
            </ul>
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

/** 오늘 탭 아래 — 경기 상태(경제 지표 4 · 시장 지표 2)와 FOMC · BoC 금리 결정. 보기 전용. */
export async function MacroSection({ lang, t }: { lang: Lang; t: Dict }) {
  const M = t.macro;
  const data = await getMacro();
  if (!data) {
    return (
      <section className="card empty">
        <p style={{ margin: 0 }}>{M.noData}</p>
      </section>
    );
  }
  const today = todayToronto();
  return (
    <>
      <section className="card" aria-labelledby="macro-title">
        <div className="section-head">
          <h2 id="macro-title">{M.title}</h2>
          <p>{M.asOf(fmtDate(data.as_of, lang))}</p>
        </div>
        <div className="macro-groups">
          {(["economy", "market"] as const).map((g) => (
            <div key={g} className="macro-group">
              <h3 className="macro-group__h">{M.groups[g]}</h3>
              <ul className="macro-list">
                {data.indicators.filter((i) => i.group === g).map((i) => (
                  <IndicatorRow key={i.key} i={i} t={t} lang={lang} />
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="tiny muted" style={{ margin: "10px 0 0" }}>{M.honest}</p>
      </section>
      <section className="card" aria-labelledby="rates-title">
        <div className="section-head">
          <h2 id="rates-title">{M.ratesTitle}</h2>
          <p>{M.ratesSub}</p>
        </div>
        <div className="rates-grid">
          <RatePanel bank="fomc" data={data} t={t} lang={lang} today={today} />
          <RatePanel bank="boc" data={data} t={t} lang={lang} today={today} />
        </div>
        <p className="tiny muted" style={{ margin: "10px 0 0" }}>{M.source}</p>
      </section>
    </>
  );
}

export function MacroSkeleton({ t }: { t: Dict }) {
  return (
    <section className="card news-skeleton" aria-busy="true">
      <h2 className="news-card-title">{t.macro.title}</h2>
      <p className="news-none">{t.news.loading}</p>
    </section>
  );
}
