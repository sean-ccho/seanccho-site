import type { Metadata } from "next";
import Link from "next/link";
import { AccountTabs } from "@/components/AccountTabs";
import { EarnBadge } from "@/components/EarnBadge";
import { EquityChart } from "@/components/EquityChart";
import { ExitReasons } from "@/components/ExitReasons";
import { HoldingsPanel } from "@/components/HoldingsPanel";
import { Pt1News } from "@/components/NewsSection";
import { NoData } from "@/components/NoData";
import { TickerLink } from "@/components/TickerLink";
import { TradeStrip } from "@/components/TradeStrip";
import { chartIndex, getDashboard, latestCapture } from "@/lib/dashboard";
import { fmtDate, gradeTone, pct, pp, tone, usd } from "@/lib/format";
import { term, type Dict, type Lang } from "@/lib/i18n";
import { getT } from "@/lib/lang";
import type { Account, Position } from "@/lib/types";

export const revalidate = 1800;

// 내계좌 › PT-1 탭 (2026-10-29) — 예전 '오늘' 페이지 그대로 옮겼다. 오늘 페이지는 이제 뉴스만.

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.nav.acctTabs.pt1 };
}

const NEAR = 0.03; // 매도선·익절선까지 3% 안이면 알림

type Alert = { ticker: string; text: string };

function alertsFor(positions: Position[], t: Dict, lang: Lang): Alert[] {
  const out: Alert[] = [];
  for (const p of positions) {
    if (p.price == null) continue;
    const { down, up } = p.exit;
    const downTag = term(lang, p.exit.down_tag);
    const upTag = term(lang, p.exit.up_tag);
    if (down != null && p.price <= down) {
      out.push({ ticker: p.ticker, text: t.today.belowDown(usd(p.price), usd(down), downTag) });
    } else if (down != null && down / p.price - 1 > -NEAR) {
      out.push({ ticker: p.ticker, text: t.today.nearDown(usd(down), downTag, pct(down / p.price - 1)) });
    }
    if (up != null && p.price >= up) {
      out.push({ ticker: p.ticker, text: t.today.aboveUp(usd(p.price), usd(up), upTag) });
    } else if (up != null && up / p.price - 1 < NEAR) {
      out.push({ ticker: p.ticker, text: t.today.nearUp(usd(up), upTag, pct(up / p.price - 1)) });
    }
  }
  return out;
}

function AccountRow({ acct, t, lang }: { acct: Account; t: Dict; lang: Lang }) {
  const d = acct.dollar;
  const tr = acct.trades;
  return (
    <tr>
      <th scope="row" style={{ fontWeight: 600, color: "var(--ink)", fontSize: 14 }}>
        {term(lang, acct.label)}
      </th>
      <td>{d ? fmtDate(d.start, lang) : "—"}</td>
      <td className="r num">{d ? usd(d.equity, 0) : "$5,000"}</td>
      <td className={`r num ${tone(d?.return)}`}>{d ? pct(d.return) : "—"}</td>
      <td className="r num">{d ? `${usd(d.spy_equity, 0)} (${pct(d.spy_return)})` : "—"}</td>
      <td className={`r num ${d && d.return != null && d.spy_return != null ? tone(d.return - d.spy_return) : ""}`}>
        {d ? pp(d.return, d.spy_return) : "—"}
      </td>
      <td>
        {acct.positions.length ? (
          <span className="tick small">{acct.positions.map((p) => p.ticker).join(" · ")}</span>
        ) : (
          <span className="muted">{t.common.none}</span>
        )}
      </td>
      <td className="r num">
        {t.common.count(tr.count)}
        {tr.win_rate != null ? ` · ${pct(tr.win_rate, 0, false)}` : ""}
      </td>
    </tr>
  );
}

export default async function Pt1Page() {
  const [data, { lang, t }] = await Promise.all([getDashboard(), getT()]);
  if (!data) return <NoData />;

  const main = data.accounts[0];
  const others = data.accounts.slice(1);
  const d = main.dollar;
  const tr = main.trades;
  const alerts = alertsFor(main.positions, t, lang);
  const images = chartIndex(data);
  const gap = d && d.return != null && d.spy_return != null ? d.return - d.spy_return : null;

  return (
    <main className="container container--wide page">
      <AccountTabs current="pt1" t={t} />
      <div className="page-title">
        <h1>{t.today.title}</h1>
        <p>{t.today.sub(term(lang, main.label), data.max_positions, main.positions.length)}</p>
      </div>

      {alerts.length > 0 && (
        <section className="card callout" aria-labelledby="alert-title">
          <div className="callout__icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3 L22 20 L2 20 Z" />
              <path d="M12 10 L12 14" />
              <path d="M12 17 L12 17.01" />
            </svg>
          </div>
          <div className="callout__body">
            <h2 id="alert-title">{t.today.alertsTitle(new Set(alerts.map((a) => a.ticker)).size)}</h2>
            <ul>
              {alerts.map((a) => (
                <li key={a.ticker + a.text}>
                  <TickerLink ticker={a.ticker} /> {a.text}
                </li>
              ))}
            </ul>
          </div>
          <a className="btn" href="#holdings">
            {t.today.seeHoldings}
          </a>
        </section>
      )}

      <section className="tiles" aria-label={t.today.summary}>
        <div className="card tile">
          <div className="tile__label">{t.today.acctValue}</div>
          <div className="tile__value">{d ? usd(d.equity, 0) : "—"}</div>
          <div className="tile__sub">
            {d ? (
              <>
                <span className={tone(d.return)}>{pct(d.return)}</span> · {t.today.since(fmtDate(d.start, lang))}
              </>
            ) : (
              t.today.noCalc
            )}
          </div>
        </div>
        <div className="card tile">
          <div className="tile__label">{t.today.spyIf}</div>
          <div className="tile__value">{d ? usd(d.spy_equity, 0) : "—"}</div>
          <div className="tile__sub">
            {d ? (
              <>
                {pct(d.spy_return)} · {t.common.vsSpy} <span className={tone(gap)}>{pp(d.return, d.spy_return)}</span>
              </>
            ) : (
              "—"
            )}
          </div>
        </div>
        <div className="card tile">
          <div className="tile__label">{t.today.holdings}</div>
          <div className="tile__value">
            {main.positions.length}
            <span className="muted" style={{ fontSize: 18, fontWeight: 500 }}>
              {" "}
              / {data.max_positions}
            </span>
          </div>
          <div className="tile__sub">{t.today.cash(d ? usd(d.cash, 0) : "—")}</div>
        </div>
        <div className="card tile">
          <div className="tile__label">{t.today.winRate}</div>
          <div className="tile__value">{tr.win_rate != null ? pct(tr.win_rate, 1, false) : "—"}</div>
          <div className="tile__sub">
            {t.today.winsOf(tr.count, tr.wins)}
            <span className={tone(tr.avg_return)}>{pct(tr.avg_return, 2)}</span>
          </div>
        </div>
      </section>

      {d && (
        <section className="card" aria-labelledby="equity-title">
          <h2 id="equity-title" style={{ fontSize: 19 }}>
            {t.today.equityTitle}
          </h2>
          <p className="section-sub">
            {gap != null && gap < 0
              ? t.today.behind(usd((d.spy_equity ?? 0) - (d.equity ?? 0), 0), pp(d.return, d.spy_return))
              : t.today.ahead(usd((d.equity ?? 0) - (d.spy_equity ?? 0), 0), pp(d.return, d.spy_return))}
            {" · "}
            {t.today.mdd(pct(d.mdd), pct(d.spy_mdd))}
          </p>
          <EquityChart curve={d.curve} initial={d.initial} />
          <p className="tiny muted" style={{ margin: "8px 0 0" }}>
            {t.today.equityNote}
          </p>
        </section>
      )}

      <HoldingsPanel positions={main.positions} images={images} capturedAt={latestCapture(data)} />

      <Pt1News data={data} lang={lang} t={t} />

      <div className="row">
        <section className="card" aria-labelledby="reasons-title">
          <h2 id="reasons-title" style={{ fontSize: 19 }}>
            {t.today.reasonsTitle}
          </h2>
          <p className="section-sub">{t.today.reasonsSub}</p>
          <ExitReasons trades={tr} lang={lang} />
        </section>
        <section className="card" aria-labelledby="trades-title">
          <h2 id="trades-title" style={{ fontSize: 19 }}>
            {t.today.tradesTitle}
          </h2>
          <p className="section-sub">{t.today.tradesSub(tr.win_rate != null ? pct(tr.win_rate, 1, false) : "—")}</p>
          <TradeStrip history={tr.history} />
        </section>
      </div>

      {others.length > 0 && (
        <section className="card" aria-labelledby="accounts-title">
          <div className="section-head">
            <h2 id="accounts-title">{t.today.othersTitle}</h2>
            <p>{t.today.othersSub}</p>
          </div>
          <div className="table-wrap">
            <table className="data-table" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th scope="col">{t.today.colAccount}</th>
                  <th scope="col">{t.today.colStart}</th>
                  <th scope="col" className="r">{t.today.colValue}</th>
                  <th scope="col" className="r">{t.common.ret}</th>
                  <th scope="col" className="r">{t.today.colSpySame}</th>
                  <th scope="col" className="r">{t.common.vsSpy}</th>
                  <th scope="col">{t.today.colHoldings}</th>
                  <th scope="col" className="r">{t.today.colClosed}</th>
                </tr>
              </thead>
              <tbody>
                {data.accounts.map((a) => (
                  <AccountRow key={a.key} acct={a} t={t} lang={lang} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card" aria-labelledby="cands-title">
        <div className="section-head">
          <h2 id="cands-title">{t.today.candsTitle}</h2>
          <Link className="link-strong" href="/quant/candidates">
            {t.today.candsLink(data.candidates.length)}
          </Link>
        </div>
        <div className="table-wrap">
          <table className="data-table" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th scope="col">{t.today.colRank}</th>
                <th scope="col">{t.common.ticker}</th>
                <th scope="col" className="r">{t.common.price}</th>
                <th scope="col" className="r">{t.common.score}</th>
                <th scope="col">{t.common.health}</th>
                <th scope="col">{t.common.nextEarnings}</th>
              </tr>
            </thead>
            <tbody>
              {data.candidates.slice(0, 5).map((c, i) => (
                <tr key={c.ticker}>
                  <td className="num muted">{i + 1}</td>
                  <td>
                    <TickerLink ticker={c.ticker} />{" "}
                    <span className="small muted">{c.company}</span>{" "}
                    {c.held && <span className="badge badge--held">{t.common.held}</span>}
                  </td>
                  <td className="r num">{usd(c.price)}</td>
                  <td className="r num" style={{ fontWeight: 600 }}>
                    ★ {c.score?.toFixed(1) ?? "—"}
                  </td>
                  <td>
                    {c.health ? (
                      <span className={`badge badge--${gradeTone(c.health.grade)}`}>
                        {c.health.score} · {c.health.grade}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="small">
                    {c.earnings_date ? fmtDate(c.earnings_date, lang) : t.common.tbd}{" "}
                    <EarnBadge info={c} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="site-footer">{t.today.footer(data.generated_at.slice(0, 16).replace("T", " "))}</footer>
    </main>
  );
}
