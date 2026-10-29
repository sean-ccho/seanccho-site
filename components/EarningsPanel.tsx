"use client";

import { useActionState } from "react";
import { useT } from "./LangProvider";
import { TickerLink } from "./TickerLink";
import type { StockHint } from "./RiskPanel";
import { decideAction, type ActionState } from "@/app/quant/account/actions";
import type { AccountRow } from "@/lib/account";
import {
  badCase, DECISIONS, decisionDeadline, decisionOf, daysBetween, isSoon, pickMove, sessionsUntil, type Decision,
} from "@/lib/earnings";
import { fmtDate, pct, usd } from "@/lib/format";
import { keepForm } from "@/lib/keepForm";

type Item = {
  tk: string;
  rows: number[];
  earn: string;
  days: number;
  deadline: string;
  left: number;
  value: number | null;
  move: ReturnType<typeof pickMove>;
  bad: number | null;
  decision: Decision | null;
  cad: boolean;
};

/**
 * 다음 2주 실적 (2026-10-29) — 보유 종목 중 실적이 14일 안인 것: 결정 마감 · 평가액 · 실적 때 움직임 · 보통/나쁜 경우 금액 ·
 * 대응(팔기·절반·그대로)을 시트 '실적대응'에. 발표 다음 날 갭은 손절가로 못 막아서, 마감 전에 정해 두게 한다.
 */
export function EarningsPanel({ rows, hints, today, isCad }: {
  rows: AccountRow[];
  hints: Record<string, StockHint>;
  today: string;
  isCad: (r: AccountRow) => boolean;
}) {
  const { lang, t } = useT();
  const byTicker = new Map<string, AccountRow[]>();
  for (const r of rows) byTicker.set(r.input.ticker, [...(byTicker.get(r.input.ticker) ?? []), r]);
  const items: Item[] = [];
  for (const [tk, list] of byTicker) {
    const first = list[0];
    const h = hints[tk];
    const earn = list.find((r) => r.earnings)?.earnings || h?.earnings || "";
    const days = daysBetween(today, earn);
    if (!isSoon(days)) continue;
    const move = pickMove({ avg: first.earnAvg, worst: first.earnWorst, timing: first.earnTiming }, h?.move);
    const shares = list.reduce((a, r) => a + (r.shares ?? 0), 0);
    const price = first.price ?? h?.price ?? null;
    const deadline = decisionDeadline(earn, move?.timing);
    items.push({
      tk, rows: list.map((r) => r.row), earn, days, deadline, left: sessionsUntil(today, deadline),
      value: price != null && shares > 0 ? price * shares : null, move, bad: move ? badCase(move.avg, move.worst) : null,
      decision: list.map((r) => decisionOf(r.decision, earn)).find(Boolean) ?? null, cad: isCad(first),
    });
  }
  items.sort((a, b) => a.deadline.localeCompare(b.deadline) || a.tk.localeCompare(b.tk));

  // 계좌 = USD 보유 평가액 합 (CAD 는 섞지 않는다 — 리스크 점검과 같은 기준)
  const account = rows.filter((r) => !isCad(r) && r.price != null && r.shares != null)
    .reduce((a, r) => a + (r.price as number) * (r.shares as number), 0);
  const usdItems = items.filter((x) => !x.cad && x.value != null);
  const totValue = usdItems.reduce((a, x) => a + (x.value as number), 0);
  const totBad = usdItems.reduce((a, x) => a + (x.bad != null ? (x.value as number) * x.bad : 0), 0);
  const money = (v: number | null, cad: boolean) => (cad ? usd(v, 0).replace("$", "C$") : usd(v, 0));

  return (
    <section className="card" aria-labelledby="earn-title">
      <div className="section-head">
        <h2 id="earn-title">📅 {t.earn.title}</h2>
        <p>{t.earn.sub}</p>
      </div>
      {!items.length ? (
        <p className="small muted" style={{ margin: 0 }}>{t.earn.none}</p>
      ) : (
        <ul className="earn-list">
          {items.map((x) => {
            const urgent = !x.decision && x.left <= 2;
            const badMoney = x.bad != null && x.value != null ? x.value * x.bad : null;
            return (
              <li key={x.tk} className={`earn-item${urgent ? " earn-item--urgent" : ""}`}>
                <div className="earn-item__main">
                  <div className="earn-item__title">
                    <TickerLink ticker={x.tk} />
                    <span>{fmtDate(x.earn, lang, true)}{x.move?.timing ? ` ${t.earn.timing[x.move.timing]}` : ""}</span>
                    <span className="badge badge--bad">{t.earn.badge(x.days)}</span>
                  </div>
                  <div className="earn-item__facts small">
                    <span>
                      {t.earn.colDeadline} <b>{fmtDate(x.deadline, lang, true)}</b>{" "}
                      <span className={urgent ? "down" : undefined}>({t.earn.left(x.left)})</span>
                    </span>
                    <span>{t.earn.colValue} <b className="num">{money(x.value, x.cad)}</b></span>
                    <span>
                      {t.earn.colMove} <b className="num">{x.move ? `±${pct(x.move.avg, 1, false)} · ${pct(x.move.worst)}` : t.earn.unknown}</b>
                    </span>
                    {x.move && x.value != null && (
                      <span>{t.earn.colUsual} <b className="num">±{money(x.value * x.move.avg, x.cad)}</b></span>
                    )}
                    {badMoney != null && (
                      <span>
                        {t.earn.colBad} <b className="num down">−{money(badMoney, x.cad)}</b>
                        {account > 0 && !x.cad && ` (${pct(badMoney / account, 1, false)})`}
                      </span>
                    )}
                  </div>
                </div>
                <DecisionForm item={x} />
              </li>
            );
          })}
        </ul>
      )}
      {usdItems.length > 1 && account > 0 && (
        <p className="small" style={{ margin: "10px 0 0", fontWeight: 600 }}>
          {t.earn.total(usd(totValue, 0), usd(totBad, 0), pct(totBad / account, 1, false))}
        </p>
      )}
      {items.length > 0 && (
        <>
          <p className="tiny muted" style={{ margin: "8px 0 0" }}>{t.earn.badHint}</p>
          <p className="tiny muted" style={{ margin: "4px 0 0" }}>{t.earn.note}</p>
        </>
      )}
    </section>
  );
}

function DecisionForm({ item }: { item: Item }) {
  const { t } = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(decideAction, null);
  return (
    <form className="earn-decide" onSubmit={keepForm(action)} aria-label={t.earn.decisionAria(item.tk)}>
      <input type="hidden" name="ticker" value={item.tk} />
      <input type="hidden" name="earn" value={item.earn} />
      <input type="hidden" name="rows" value={item.rows.join(",")} />
      <span className="seg" role="group">
        {DECISIONS.map((d) => (
          <button key={d} type="submit" name="decision" value={d} aria-pressed={item.decision === d} disabled={pending}>
            {t.earn.decisions[d]}
          </button>
        ))}
      </span>
      {item.decision ? (
        <button type="submit" name="decision" value="" className="btn btn--small" disabled={pending}>{t.earn.clear}</button>
      ) : (
        <span className="tiny muted">{t.earn.undecided}</span>
      )}
      {state && !state.ok && <span role="alert" className="tiny down">{state.message}</span>}
    </form>
  );
}
