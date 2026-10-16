"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "./LangProvider";
import { fmtDate, num, pct, stockHref, tone, tvUrl, usd } from "@/lib/format";
import type { ShortInfo, SqueezeItem, TickerInfo } from "@/lib/types";

const FUEL_SHOWN = 10;

/** 숏스퀴즈 감시 (후보·차트 페이지) — 🔥 전부 + 대기 상위 10 (모두 보기로 펼침). 🔥 가 있으면 열린 채로. */
export function SqueezePanel({ squeeze, known, charted, onShowChart }: {
  squeeze: { settle: string | null; items: SqueezeItem[] } | null | undefined;
  known: string[];
  charted?: string[];
  onShowChart?: (ticker: string) => void;
}) {
  const { lang, t } = useT();
  const S = t.squeeze;
  const [all, setAll] = useState(false);
  if (!squeeze || squeeze.items.length === 0) return null;
  const fire = squeeze.items.filter((x) => x.status === "fire");
  const fuel = squeeze.items.filter((x) => x.status === "fuel");
  const rows = [...fire, ...(all ? fuel : fuel.slice(0, FUEL_SHOWN))];
  const knownSet = new Set(known);
  const chartSet = new Set(charted ?? []);
  return (
    <details className="card golden-panel" open={fire.length > 0}>
      <summary>
        <span style={{ fontWeight: 700, color: "var(--warn)" }}>{S.title}</span>
        <span className="chip">{S.summary(fire.length, fuel.length, fmtDate(squeeze.settle, lang))}</span>
      </summary>
      <p className="small muted" style={{ margin: "10px 0 0" }}>{S.sub}</p>
      {fire.length === 0 && <p className="small" style={{ margin: "8px 0 0" }}>{S.noFire}</p>}
      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table className="data-table data-table--tight" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th scope="col">{t.common.ticker}</th>
              <th scope="col">{S.colStatus}</th>
              <th scope="col" className="r">{t.common.price}</th>
              <th scope="col" className="r">{S.colShort}</th>
              <th scope="col" className="r" title={S.dtcHelp}>{S.colDtc}</th>
              <th scope="col" className="r">{S.colChange}</th>
              <th scope="col" className="r">{S.colRet5}</th>
              <th scope="col" className="r">{S.colVol}</th>
              <th scope="col" className="r" aria-label={t.common.tvOpen} />
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.ticker} data-selected={q.status === "fire"}>
                <td>
                  {knownSet.has(q.ticker) ? (
                    <Link className="tick" href={stockHref(q.ticker)}>{q.ticker}</Link>
                  ) : (
                    <span className="tick">{q.ticker}</span>
                  )}
                  {q.name && <div className="cell-sub" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{q.name}</div>}
                </td>
                <td>
                  <span className={`badge ${q.status === "fire" ? "badge--bad" : "badge--warn"}`}>{q.status === "fire" ? S.fire : S.fuel}</span>
                </td>
                <td className="r num">{usd(q.price)}</td>
                <td className="r num" title={q.short_basis === "shares_out" ? S.basisOut : undefined}>
                  {pct(q.short_pct, 0, false)}{q.short_basis === "shares_out" ? "*" : ""}
                </td>
                <td className="r num">{q.dtc != null ? S.dtc(num(q.dtc, 1)) : "—"}</td>
                <td className={`r num ${tone(q.si_change)}`}>{pct(q.si_change, 0)}</td>
                <td className={`r num ${tone(q.ret_5d)}`}>{pct(q.ret_5d)}</td>
                <td className="r num">{q.vol_ratio != null ? `${num(q.vol_ratio, 1)}×` : "—"}</td>
                <td className="r">
                  {onShowChart && chartSet.has(q.ticker) ? (
                    <button type="button" className="btn btn--small" onClick={() => onShowChart(q.ticker)}>{t.list.toChart}</button>
                  ) : (
                    <a className="link-strong small" href={tvUrl(q.ticker)} target="_blank" rel="noopener noreferrer">TradingView ↗</a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {fuel.length > FUEL_SHOWN && (
        <button type="button" className="btn btn--small" style={{ marginTop: 10 }} onClick={() => setAll((v) => !v)}>
          {all ? S.showLess : S.showAll(fuel.length)}
        </button>
      )}
      <p className="tiny muted" style={{ margin: "8px 0 0" }}>{S.dtcHelp}</p>
    </details>
  );
}

/** 공매도 칩 + 숏스퀴즈 배지 (후보 상세·차트 카드). 높으면 주황. */
export function ShortChips({ info }: { info: TickerInfo }) {
  const { t } = useT();
  const S = t.squeeze;
  const s: ShortInfo | null | undefined = info.short;
  return (
    <>
      {info.squeeze && (
        <span className={`badge ${info.squeeze === "fire" ? "badge--bad" : "badge--warn"}`}>
          {info.squeeze === "fire" ? S.badgeFire : S.badgeFuel}
        </span>
      )}
      {s && (s.pct != null || s.dtc != null) && (
        <span className="chip" title={S.dtcHelp}
          style={s.high ? { color: "var(--warn)", borderColor: "var(--warn)", fontWeight: 600 } : undefined}>
          {S.shortChip(s.pct != null ? pct(s.pct, 0, false) : "—", s.dtc != null ? num(s.dtc, 1) : "—")}
        </span>
      )}
    </>
  );
}
