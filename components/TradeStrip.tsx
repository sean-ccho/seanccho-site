"use client";

import { useState, type KeyboardEvent } from "react";
import { useT } from "./LangProvider";
import { TickerLink } from "./TickerLink";
import { fmtDate, pct } from "@/lib/format";
import { exitReason } from "@/lib/i18n";
import type { TradeHistoryItem } from "@/lib/types";

const PLOT_H = 150;

/** 거래별 수익률 막대 (청산일 순) — 막대에 올리거나 좌우 화살표로 종목·날짜를 본다. */
export function TradeStrip({ history }: { history: TradeHistoryItem[] }) {
  const { lang, t } = useT();
  const [active, setActive] = useState<number | null>(null);
  if (history.length === 0) return <p className="muted">{t.reasons.none}</p>;

  const posMax = Math.max(0.0001, ...history.map((h) => h.return));
  const negMax = Math.max(0.0001, ...history.map((h) => -h.return));
  const unit = PLOT_H / (posMax + negMax);
  const posH = posMax * unit;
  const negH = negMax * unit;
  const last = history.length - 1;
  const cur = active != null ? history[active] : null;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const base = active ?? (e.key === "ArrowLeft" ? last + 1 : -1);
      setActive(Math.max(0, Math.min(last, base + (e.key === "ArrowLeft" ? -1 : 1))));
    } else if (e.key === "Escape") {
      setActive(null);
    }
  };

  return (
    <figure style={{ margin: 0 }}>
      <div className="strip">
        <div
          className="strip__bars"
          tabIndex={0}
          role="img"
          aria-label={t.strip.aria(history.length)}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
        >
          {history.map((h, i) => (
            <div key={`${h.ticker}-${h.exit_date}-${i}`} className="strip__col" onPointerEnter={() => setActive(i)}
              onPointerDown={() => setActive(i)} style={active === i ? { outline: "1px solid var(--faint)" } : undefined}>
              <div className="strip__pos" style={{ height: posH }}>
                {h.return > 0 && <div className="strip__up" style={{ height: Math.max(2, h.return * unit) }} />}
              </div>
              <div className="strip__zero" />
              <div className="strip__neg" style={{ height: negH }}>
                {h.return < 0 && <div className="strip__down" style={{ height: Math.max(2, -h.return * unit) }} />}
              </div>
            </div>
          ))}
        </div>
        {cur && (
          <div className="viz-tooltip" role="status"
            style={{ left: `min(max(${((active as number) / Math.max(1, last)) * 100}% - 80px, 0px), calc(100% - 180px))`, top: -8 }}>
            <div className="viz-tooltip__val">{pct(cur.return)}</div>
            <div>
              <span className="tick">{cur.ticker}</span> · {t.strip.closedOn(fmtDate(cur.exit_date, lang))}
            </div>
            {cur.exit_reason && <div className="muted">{exitReason(lang, cur.exit_reason)}</div>}
          </div>
        )}
        <div className="strip__axis">
          <span>{fmtDate(history[0].exit_date, lang)}</span>
          <span>{fmtDate(history[last].exit_date, lang)}</span>
        </div>
      </div>
      <details className="table-view">
        <summary>{t.strip.tableView(history.length)}</summary>
        <div className="table-wrap">
          <table className="data-table" style={{ minWidth: 480 }}>
            <thead>
              <tr>
                <th scope="col">{t.strip.colExit}</th>
                <th scope="col">{t.common.ticker}</th>
                <th scope="col" className="r">{t.common.ret}</th>
                <th scope="col">{t.strip.colReason}</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map((h, i) => (
                <tr key={`${h.ticker}-${h.exit_date}-${i}`}>
                  <td>{fmtDate(h.exit_date, lang)}</td>
                  <td><TickerLink ticker={h.ticker} /></td>
                  <td className={`r num ${h.return > 0 ? "up" : h.return < 0 ? "down" : "flat"}`}>{pct(h.return)}</td>
                  <td className="small">{exitReason(lang, h.exit_reason)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
