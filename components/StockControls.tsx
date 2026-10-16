"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useT } from "./LangProvider";
import { term } from "@/lib/i18n";
import {
  DEFAULT_DIR,
  EMPTY_FILTERS,
  passes,
  patternCounts,
  SORT_KEYS,
  sortRows,
  type CrossFilter,
  type Filters,
  type ListRow,
  type SortKey,
} from "@/lib/stockList";
import { TIMEFRAMES, type Timeframe } from "@/lib/types";

/** 필터·정렬·보여 줄 봉 상태 + 걸러서 정렬한 목록. 후보·차트 페이지가 똑같이 쓴다. */
export function useStockList(rows: ListRow[], initialTfs: Timeframe[] = ["Daily", "Weekly"]) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("default");
  const [dir, setDir] = useState<"desc" | "asc">(DEFAULT_DIR.default);
  const [tfs, setTfs] = useState<Timeframe[]>(initialTfs);
  const q = useDeferredValue(filters.q);

  const shown = useMemo(() => {
    const f = { ...filters, q };
    return sortRows(rows.filter((r) => passes(r, f)), sort, dir);
  }, [rows, filters, q, sort, dir]);

  const patterns = useMemo(() => patternCounts(rows.filter((r) => passes(r, { ...filters, q }, "pattern"))), [rows, filters, q]);
  const strategies = useMemo(
    () => Array.from(new Set(rows.map((r) => r.info?.strategy).filter((s): s is string => Boolean(s)))),
    [rows],
  );
  const marketCount = (m: Filters["market"]) => (m === "all" ? rows.length : rows.filter((r) => r.market === m).length);

  return {
    rows,
    shown,
    filters,
    set: (patch: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...patch })),
    reset: () => {
      setFilters(EMPTY_FILTERS);
      setSort("default");
      setDir(DEFAULT_DIR.default);
    },
    sort,
    dir,
    /** 같은 정렬을 다시 누르면 방향을 뒤집는다. */
    pickSort: (key: SortKey) => {
      if (key === sort) setDir((d) => (d === "desc" ? "asc" : "desc"));
      else {
        setSort(key);
        setDir(DEFAULT_DIR[key]);
      }
    },
    tfs,
    toggleTf: (k: Timeframe) => setTfs((cur) => {
      const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
      return next.length ? TIMEFRAMES.filter((x) => next.includes(x)) : cur;
    }),
    patterns,
    strategies,
    marketCount,
  };
}

export type StockListCtl = ReturnType<typeof useStockList>;

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12 L10 17 L19 7" />
    </svg>
  );
}

type Opt<T> = { value: T; label: React.ReactNode };

function Pills<T extends string>({ label, value, options, onPick, activeTitle }: {
  label: string;
  value: T;
  options: Opt<T>[];
  onPick: (v: T) => void;
  activeTitle?: string;
}) {
  return (
    <div className="ctl-row" role="group" aria-label={label}>
      <span className="ctl-row__label">{label}</span>
      <div className="ctl-row__opts">
        {options.map((o) => (
          <button key={o.value} type="button" className="pill" aria-pressed={value === o.value} onClick={() => onPick(o.value)}
            title={value === o.value ? activeTitle : undefined}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Count({ n }: { n: number }) {
  return <span className="pill__count">{n}</span>;
}

/** 카테고리마다 한 줄 (왼쪽 이름 · 오른쪽 버튼), 위에서 아래로 — 두 페이지가 같은 배치. */
export function StockControls({ ctl, idPrefix }: { ctl: StockListCtl; idPrefix: string }) {
  const { lang, t } = useT();
  const L = t.list;
  const f = ctl.filters;
  const yesNo = (on: boolean) => (on ? "on" : "off");
  const count = L.count(ctl.shown.length, ctl.rows.length);
  const dirty =
    JSON.stringify(f) !== JSON.stringify(EMPTY_FILTERS) || ctl.sort !== "default";

  return (
    <section className="card controls" aria-label={L.controls}>
      <Pills label={L.market} value={f.market} onPick={(v) => ctl.set({ market: v })} options={[
        { value: "all", label: <>{L.all} <Count n={ctl.marketCount("all")} /></> },
        { value: "sp500", label: <>S&amp;P 500 <Count n={ctl.marketCount("sp500")} /></> },
        { value: "nasdaq", label: <>{term(lang, "나스닥·NYSE")} <Count n={ctl.marketCount("nasdaq")} /></> },
      ]} />
      <Pills label={L.scope} value={yesNo(f.heldOnly)} onPick={(v) => ctl.set({ heldOnly: v === "on" })} options={[
        { value: "off", label: L.all },
        { value: "on", label: L.heldOnly },
      ]} />
      <Pills label={L.health} value={yesNo(f.aOnly)} onPick={(v) => ctl.set({ aOnly: v === "on" })} options={[
        { value: "off", label: L.all },
        { value: "on", label: L.aOnly },
      ]} />
      {ctl.strategies.length > 0 && (
        <Pills label={L.strategy} value={f.strategy} onPick={(v) => ctl.set({ strategy: v })} options={[
          { value: "all", label: L.all },
          ...ctl.strategies.map((s) => ({ value: s, label: term(lang, s) })),
        ]} />
      )}
      <Pills<CrossFilter> label={L.cross} value={f.cross} onPick={(v) => ctl.set({ cross: v })} options={[
        { value: "all", label: L.all },
        { value: "pt", label: L.crossPt },
        { value: "golden_soon", label: <span className="up">▲ {L.crossGoldenSoon}</span> },
        { value: "golden", label: <span className="up">▲ {L.crossGolden}</span> },
        { value: "dead_soon", label: <span className="down">▼ {L.crossDeadSoon}</span> },
        { value: "dead", label: <span className="down">▼ {L.crossDead}</span> },
      ]} />
      <Pills label={L.insider} value={f.insider} onPick={(v) => ctl.set({ insider: v })} options={[
        { value: "all", label: L.all },
        { value: "buy", label: L.insBuy },
        { value: "sell", label: L.insSell },
      ]} />
      <Pills label={L.pattern} value={f.pattern} onPick={(v) => ctl.set({ pattern: v })} options={[
        { value: "all", label: L.all },
        ...ctl.patterns.map(([p, n]) => ({ value: p, label: <>{term(lang, p)} <Count n={n} /></> })),
        // 지금 고른 패턴이 다른 필터 때문에 0개가 돼도 버튼은 남겨 둔다 (끌 수 있게)
        ...(f.pattern !== "all" && !ctl.patterns.some(([p]) => p === f.pattern)
          ? [{ value: f.pattern, label: <>{term(lang, f.pattern)} <Count n={0} /></> }]
          : []),
      ]} />
      <Pills<SortKey> label={L.sort} value={ctl.sort} onPick={ctl.pickSort} activeTitle={L.dirAria} options={SORT_KEYS.map((k) => ({
        value: k,
        label: <>{L.sorts[k]}{k === ctl.sort && k !== "default" ? (ctl.dir === "desc" ? " ↓" : " ↑") : ""}</>,
      }))} />
      <div className="ctl-row" role="group" aria-label={L.tfs}>
        <span className="ctl-row__label">{L.tfs}</span>
        <div className="ctl-row__opts">
          {TIMEFRAMES.map((k) => (
            <button key={k} type="button" className="pill" aria-pressed={ctl.tfs.includes(k)} onClick={() => ctl.toggleTf(k)}>
              {ctl.tfs.includes(k) && <CheckIcon />}
              {t.common.tf[k]}
            </button>
          ))}
        </div>
      </div>
      <div className="ctl-row">
        <label htmlFor={`${idPrefix}-search`} className="ctl-row__label">
          {L.search}
        </label>
        <div className="ctl-row__opts">
          <input id={`${idPrefix}-search`} className="input ctl-row__search" type="search" value={f.q} placeholder={L.searchPh}
            autoCapitalize="characters" autoComplete="off" spellCheck={false}
            onChange={(e) => ctl.set({ q: e.target.value })} />
        </div>
      </div>
      <div className="controls__foot">
        <span role="status">
          <span className="num" style={{ fontWeight: 600 }}>{count[0]}</span>
          {count[1]}
        </span>
        {dirty && (
          <button type="button" className="btn btn--small" onClick={ctl.reset}>
            {L.reset}
          </button>
        )}
      </div>
    </section>
  );
}
