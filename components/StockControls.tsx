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
    /** 정렬 기준을 바꾸면 그 기준의 기본 방향으로. */
    setSortKey: (key: SortKey) => {
      setSort(key);
      setDir(DEFAULT_DIR[key]);
    },
    flipDir: () => setDir((d) => (d === "desc" ? "asc" : "desc")),
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

type Opt = { value: string; label: string };

function Select({ id, label, value, options, onPick }: {
  id: string;
  label: string;
  value: string;
  options: Opt[];
  onPick: (v: string) => void;
}) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      <select id={id} className="input" value={value} onChange={(e) => onPick(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6 L20 6" />
      <path d="M7 12 L17 12" />
      <path d="M10 18 L14 18" />
    </svg>
  );
}

/**
 * 한 줄: 검색 · 시장 · 정렬 · [필터]
 * 필터(범위·헬스·전략·크로스·내부자·패턴)는 접어 두고, 켜 둔 것만 칩으로 보여 준다 (칩을 누르면 빠짐).
 * 아랫줄: 보여 줄 봉 · 켜 둔 필터 칩 · 개수.
 */
export function StockControls({ ctl, idPrefix }: { ctl: StockListCtl; idPrefix: string }) {
  const { lang, t } = useT();
  const L = t.list;
  const f = ctl.filters;
  const [open, setOpen] = useState(false);
  const count = L.count(ctl.shown.length, ctl.rows.length);

  const crossLabel: Record<CrossFilter, string> = {
    all: L.all,
    pt: L.crossPt,
    golden_soon: `▲ ${L.crossGoldenSoon}`,
    golden: `▲ ${L.crossGolden}`,
    dead_soon: `▼ ${L.crossDeadSoon}`,
    dead: `▼ ${L.crossDead}`,
  };
  const insiderLabel = { all: L.all, buy: L.insBuy, sell: L.insSell };

  // 켜 둔 필터 → 칩 (누르면 그 필터만 끈다)
  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (f.heldOnly) chips.push({ key: "held", label: L.heldOnly, clear: () => ctl.set({ heldOnly: false }) });
  if (f.aOnly) chips.push({ key: "a", label: `${L.health} ${L.aOnly}`, clear: () => ctl.set({ aOnly: false }) });
  if (f.strategy !== "all") chips.push({ key: "st", label: term(lang, f.strategy), clear: () => ctl.set({ strategy: "all" }) });
  if (f.cross !== "all") chips.push({ key: "cr", label: crossLabel[f.cross], clear: () => ctl.set({ cross: "all" }) });
  if (f.insider !== "all") {
    chips.push({ key: "in", label: `${L.insider} ${insiderLabel[f.insider]}`, clear: () => ctl.set({ insider: "all" }) });
  }
  if (f.pattern !== "all") chips.push({ key: "pa", label: term(lang, f.pattern), clear: () => ctl.set({ pattern: "all" }) });
  const dirty = chips.length > 0 || f.market !== "all" || f.q !== "" || ctl.sort !== "default";

  const patternOptions: Opt[] = [
    { value: "all", label: L.all },
    ...ctl.patterns.map(([p, n]) => ({ value: p, label: `${term(lang, p)} (${n})` })),
    // 지금 고른 패턴이 다른 필터 때문에 0개가 돼도 목록에 남겨 둔다
    ...(f.pattern !== "all" && !ctl.patterns.some(([p]) => p === f.pattern)
      ? [{ value: f.pattern, label: `${term(lang, f.pattern)} (0)` }]
      : []),
  ];

  return (
    <section className="card controls" aria-label={L.controls}>
      <div className="toolbar">
        <div className="search search--grow">
          <label htmlFor={`${idPrefix}-search`} className="sr-only">
            {L.search}
          </label>
          <input id={`${idPrefix}-search`} className="input" type="search" value={f.q} placeholder={L.searchPh}
            autoCapitalize="characters" autoComplete="off" spellCheck={false}
            onChange={(e) => ctl.set({ q: e.target.value })} />
        </div>

        <div className="seg" role="group" aria-label={L.market}>
          {(["all", "sp500", "nasdaq"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={f.market === m} onClick={() => ctl.set({ market: m })}>
              {m === "all" ? L.all : m === "sp500" ? "S&P 500" : term(lang, "나스닥·NYSE")}{" "}
              <span className="pill__count">{ctl.marketCount(m)}</span>
            </button>
          ))}
        </div>

        <div className="sortbox">
          <label htmlFor={`${idPrefix}-sort`} className="small muted">
            {L.sort}
          </label>
          <select id={`${idPrefix}-sort`} className="input" value={ctl.sort}
            onChange={(e) => ctl.setSortKey(e.target.value as SortKey)}>
            {SORT_KEYS.map((k) => (
              <option key={k} value={k}>
                {L.sorts[k]}
              </option>
            ))}
          </select>
          {ctl.sort !== "default" && (
            <button type="button" className="btn btn--small" onClick={ctl.flipDir} aria-label={L.dirAria} title={L.dirAria}>
              {ctl.dir === "desc" ? `↓ ${L.desc}` : `↑ ${L.asc}`}
            </button>
          )}
        </div>

        <button type="button" className="btn" aria-expanded={open} aria-controls={`${idPrefix}-filters`}
          onClick={() => setOpen((o) => !o)}>
          <FilterIcon />
          {L.filterBtn}
          {chips.length > 0 && <span className="count-badge">{chips.length}</span>}
          <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </button>
      </div>

      {open && (
        <div id={`${idPrefix}-filters`} className="filter-grid">
          <Select id={`${idPrefix}-scope`} label={L.scope} value={f.heldOnly ? "held" : "all"}
            onPick={(v) => ctl.set({ heldOnly: v === "held" })}
            options={[{ value: "all", label: L.all }, { value: "held", label: L.heldOnly }]} />
          <Select id={`${idPrefix}-health`} label={L.health} value={f.aOnly ? "a" : "all"}
            onPick={(v) => ctl.set({ aOnly: v === "a" })}
            options={[{ value: "all", label: L.all }, { value: "a", label: L.aOnly }]} />
          {ctl.strategies.length > 0 && (
            <Select id={`${idPrefix}-strategy`} label={L.strategy} value={f.strategy}
              onPick={(v) => ctl.set({ strategy: v })}
              options={[{ value: "all", label: L.all }, ...ctl.strategies.map((s) => ({ value: s, label: term(lang, s) }))]} />
          )}
          <Select id={`${idPrefix}-cross`} label={L.cross} value={f.cross}
            onPick={(v) => ctl.set({ cross: v as CrossFilter })}
            options={(Object.keys(crossLabel) as CrossFilter[]).map((k) => ({ value: k, label: crossLabel[k] }))} />
          <Select id={`${idPrefix}-insider`} label={L.insider} value={f.insider}
            onPick={(v) => ctl.set({ insider: v as Filters["insider"] })}
            options={(["all", "buy", "sell"] as const).map((k) => ({ value: k, label: insiderLabel[k] }))} />
          <Select id={`${idPrefix}-pattern`} label={L.pattern} value={f.pattern}
            onPick={(v) => ctl.set({ pattern: v })} options={patternOptions} />
        </div>
      )}

      <div className="toolbar toolbar--foot">
        <div className="seg seg--small" role="group" aria-label={L.tfs}>
          {TIMEFRAMES.map((k) => (
            <button key={k} type="button" aria-pressed={ctl.tfs.includes(k)} onClick={() => ctl.toggleTf(k)}>
              {t.common.tf[k]}
            </button>
          ))}
        </div>
        {chips.map((c) => (
          <button key={c.key} type="button" className="chip chip--x" onClick={c.clear} aria-label={L.removeChip(c.label)}>
            {c.label} <span aria-hidden="true">×</span>
          </button>
        ))}
        <span className="toolbar__count">
          <span role="status">
            <span className="num" style={{ fontWeight: 600, color: "var(--ink)" }}>{count[0]}</span>
            {count[1]}
          </span>
          {dirty && (
            <button type="button" className="link-reset" onClick={ctl.reset}>
              {L.reset}
            </button>
          )}
        </span>
      </div>
    </section>
  );
}
