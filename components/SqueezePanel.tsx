"use client";

import { useState } from "react";
import { useT } from "./LangProvider";
import { TickerLink } from "./TickerLink";
import { SortTh, useTableSort, type SortCol } from "./SortTh";
import { num, pct, tone, tvUrl, usd } from "@/lib/format";
import type { ShortInfo, SqueezeItem, TickerInfo } from "@/lib/types";

const FUEL_SHOWN = 10;

const SORT_COLS = {
  ticker: { get: (q) => q.ticker, first: "asc" },
  status: { get: (q) => (q.status === "fire" ? 1 : 0) },
  price: { get: (q) => q.price },
  short: { get: (q) => q.short_pct },
  dtc: { get: (q) => q.dtc },
  change: { get: (q) => q.si_change },
  ret5: { get: (q) => q.ret_5d },
  vol: { get: (q) => q.vol_ratio },
} satisfies Record<string, SortCol<SqueezeItem>>;

/** 숏스퀴즈 감시 (후보·차트 페이지 도구 막대에서 펼치는 칸의 안쪽) — 🔥 전부 + 대기 상위 10 (모두 보기로 펼침).
 *  열 이름을 누르면 전체(🔥+대기)를 그 열로 정렬한 뒤 같은 줄 수만 보여 준다. 제목·요약·닫기는 ScreenView 가 그린다. */
export function SqueezePanel({ squeeze, listed, onShowChart }: {
  squeeze: { settle: string | null; items: SqueezeItem[] } | null | undefined;
  /** 이 화면 목록에 있는 종목 — '차트 보기' 버튼 (없으면 TradingView 링크). */
  listed?: string[];
  onShowChart?: (ticker: string) => void;
}) {
  const { t } = useT();
  const S = t.squeeze;
  const [all, setAll] = useState(false);
  const { sort, toggle, apply } = useTableSort<SqueezeItem, keyof typeof SORT_COLS>(SORT_COLS);
  if (!squeeze || squeeze.items.length === 0) return null;
  const fire = squeeze.items.filter((x) => x.status === "fire");
  const fuel = squeeze.items.filter((x) => x.status === "fuel");
  const rows = sort
    ? apply([...fire, ...fuel]).slice(0, all ? undefined : fire.length + FUEL_SHOWN)
    : [...fire, ...(all ? fuel : fuel.slice(0, FUEL_SHOWN))];
  const th = (k: keyof typeof SORT_COLS, label: string, extra?: { r?: boolean; title?: string }) => (
    <SortTh k={k} sort={sort} onSort={toggle} className={extra?.r ? "r" : undefined} title={extra?.title}>{label}</SortTh>
  );
  const chartSet = new Set(listed ?? []);
  return (
    <>
      <p className="small muted">{S.sub}</p>
      {fire.length === 0 && <p className="small">{S.noFire}</p>}
      <div className="table-wrap">
        <table className="data-table data-table--tight data-table--pin" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              {th("ticker", t.common.ticker)}
              {th("status", S.colStatus)}
              {th("price", t.common.price, { r: true })}
              {th("short", S.colShort, { r: true })}
              {th("dtc", S.colDtc, { r: true, title: S.dtcHelp })}
              {th("change", S.colChange, { r: true })}
              {th("ret5", S.colRet5, { r: true })}
              {th("vol", S.colVol, { r: true, title: t.list.volHelp })}
              <th scope="col" className="r" aria-label={t.common.tvOpen} />
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.ticker} data-selected={q.status === "fire"}>
                <td>
                  <TickerLink ticker={q.ticker} />
                  {q.name && <div className="cell-sub" title={q.name}>{q.name}</div>}
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
        <button type="button" className="btn btn--small tool-panel__more" onClick={() => setAll((v) => !v)}>
          {all ? S.showLess : S.showAll(fuel.length)}
        </button>
      )}
      <p className="tiny muted">{t.list.sortHint}</p>
      <p className="tiny muted">{S.dtcHelp}</p>
    </>
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
