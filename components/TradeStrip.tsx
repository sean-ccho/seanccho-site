"use client";

import { useState, type KeyboardEvent } from "react";
import { dateKo, pct } from "@/lib/format";
import type { TradeHistoryItem } from "@/lib/types";

const PLOT_H = 150;

/** 거래별 수익률 막대 (청산일 순) — 막대에 올리거나 좌우 화살표로 종목·날짜를 본다. */
export function TradeStrip({ history }: { history: TradeHistoryItem[] }) {
  const [active, setActive] = useState<number | null>(null);
  if (history.length === 0) return <p className="muted">아직 청산 기록이 없어요.</p>;

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
          aria-label={`청산 ${history.length}건의 수익률 막대. 좌우 화살표로 한 건씩 볼 수 있어요.`}
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
              <span className="tick">{cur.ticker}</span> · {dateKo(cur.exit_date)} 청산
            </div>
            {cur.exit_reason && <div className="muted">{cur.exit_reason}</div>}
          </div>
        )}
        <div className="strip__axis">
          <span>{dateKo(history[0].exit_date)}</span>
          <span>{dateKo(history[last].exit_date)}</span>
        </div>
      </div>
      <details className="table-view">
        <summary>표로 보기 ({history.length}건)</summary>
        <div className="table-wrap">
          <table className="data-table" style={{ minWidth: 480 }}>
            <thead>
              <tr>
                <th scope="col">청산일</th>
                <th scope="col">종목</th>
                <th scope="col" className="r">수익률</th>
                <th scope="col">사유</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map((h, i) => (
                <tr key={`${h.ticker}-${h.exit_date}-${i}`}>
                  <td>{dateKo(h.exit_date)}</td>
                  <td className="tick">{h.ticker}</td>
                  <td className={`r num ${h.return > 0 ? "up" : h.return < 0 ? "down" : "flat"}`}>{pct(h.return)}</td>
                  <td className="small">{h.exit_reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
