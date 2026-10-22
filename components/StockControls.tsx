"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ChartModeSeg, StudyChips } from "./ChartModeBar";
import { useT } from "./LangProvider";
import { PatternName } from "./StockChips";
import { term } from "@/lib/i18n";
import {
  DEFAULT_DIR,
  EMPTY_FILTERS,
  insiderCounts,
  ISB_UP,
  isbSortLabel,
  isSqzSort,
  passes,
  patternCounts,
  SORT_KEYS,
  sortRows,
  SQZ_DIRS,
  SQZ_PHASES,
  SQZ_PICKS,
  sqzDirCounts,
  sqzPhaseCounts,
  sqzSortTf,
  sqzUp,
  type CrossFilter,
  type Filters,
  type ListRow,
  type SortKey,
  type SqzPick,
} from "@/lib/stockList";
import { TIMEFRAMES, type Timeframe } from "@/lib/types";

/** 차트 크기 — 작게(한 줄에 여럿) · 보통(화면 폭에 맞춰 자동) · 크게(한 줄에 하나). */
export type ChartSize = "small" | "auto" | "large";
const SIZES: ChartSize[] = ["small", "auto", "large"];
const SIZE_KEY = "charts:size";
const TFS_KEY = "charts:tfs";

/** 필터·정렬·보여 줄 봉·차트 크기 상태 + 걸러서 정렬한 목록. 후보·차트 페이지가 똑같이 쓴다. */
export function useStockList(rows: ListRow[], initialTfs: Timeframe[] = ["Daily", "Weekly"]) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("default");
  const [dir, setDir] = useState<"desc" | "asc">(DEFAULT_DIR.default);
  const [tfs, setTfs] = useState<Timeframe[]>(initialTfs);
  const [size, setSize] = useState<ChartSize>("auto");
  const q = useDeferredValue(filters.q);

  // 차트 크기·보여 줄 봉은 이 브라우저에 기억 (서버 렌더는 기본값으로 그리고, 화면에 붙은 뒤 바꾼다)
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(SIZE_KEY) as ChartSize | null;
      if (v && SIZES.includes(v)) setSize(v);
      const saved: unknown = JSON.parse(window.localStorage.getItem(TFS_KEY) ?? "null");
      if (Array.isArray(saved)) {
        const picked = TIMEFRAMES.filter((k) => saved.includes(k));
        if (picked.length) setTfs(picked);
      }
    } catch {
      // 저장이 막힌 브라우저 — 기본값
    }
  }, []);
  const pickSize = (v: ChartSize) => {
    setSize(v);
    try {
      window.localStorage.setItem(SIZE_KEY, v);
    } catch {
      // 기억만 못 할 뿐
    }
  };

  const shown = useMemo(() => {
    const f = { ...filters, q };
    return sortRows(rows.filter((r) => passes(r, f)), sort, dir, sqzSortTf(filters.sqzTf));
  }, [rows, filters, q, sort, dir]);

  const patterns = useMemo(() => patternCounts(rows.filter((r) => passes(r, { ...filters, q }, "pattern"))), [rows, filters, q]);
  const insiders = useMemo(() => insiderCounts(rows.filter((r) => passes(r, { ...filters, q }, "insider"))), [rows, filters, q]);
  const sqzPhases = useMemo(
    () => sqzPhaseCounts(rows.filter((r) => passes(r, { ...filters, q }, "sqz")), filters.sqzTf),
    [rows, filters, q],
  );
  const sqzDirs = useMemo(
    () => sqzDirCounts(rows.filter((r) => passes(r, { ...filters, q }, "sqzDir")), filters.sqzTf),
    [rows, filters, q],
  );
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
    size,
    pickSize,
    tfs,
    toggleTf: (k: Timeframe) => setTfs((cur) => {
      const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
      if (!next.length) return cur;
      const ordered = TIMEFRAMES.filter((x) => next.includes(x));
      try {
        window.localStorage.setItem(TFS_KEY, JSON.stringify(ordered));
      } catch {
        // 기억만 못 할 뿐
      }
      return ordered;
    }),
    patterns,
    insiders,
    sqzPhases,
    sqzDirs,
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

type Opt<T> = { value: T; label: React.ReactNode; title?: string };

/** 이름 + 붙은 버튼 묶음 하나 (넓으면 여러 묶음이 한 줄에, 패턴·정렬처럼 많은 건 한 줄 전부). */
function Seg<T extends string>({ label, value, options, onPick, activeTitle, wide = false }: {
  label: string;
  value: T;
  options: Opt<T>[];
  onPick: (v: T) => void;
  activeTitle?: string;
  wide?: boolean;
}) {
  return (
    <div className={`ctl-group${wide ? " ctl-group--wide" : ""}`} role="group" aria-label={label}>
      <span className="ctl-group__label">{label}</span>
      <div className={`tseg${wide ? " tseg--wrap" : ""}`}>
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onPick(o.value)}
            title={o.title ?? (value === o.value ? activeTitle : undefined)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Count({ n }: { n: number }) {
  return <span className="tseg__count">{n}</span>;
}

/** 필터·정렬·검색 — 세 페이지(후보·차트추천·전체차트)가 같은 배치. 봉·차트 크기는 목록·차트 바로 위 ViewBar. */
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
      <div className="ctl-grid">
        {/* 한 시장뿐이면(전체분석 S&P 500 탭 등) 시장 버튼은 고를 게 없어서 숨긴다 */}
        {ctl.marketCount("sp500") > 0 && ctl.marketCount("nasdaq") > 0 && (
          <Seg label={L.market} value={f.market} onPick={(v) => ctl.set({ market: v })} options={[
            { value: "all", label: <>{L.all} <Count n={ctl.marketCount("all")} /></> },
            { value: "sp500", label: <>S&amp;P 500 <Count n={ctl.marketCount("sp500")} /></> },
            { value: "nasdaq", label: <>{term(lang, "나스닥·NYSE")} <Count n={ctl.marketCount("nasdaq")} /></> },
          ]} />
        )}
        <Seg label={L.scope} value={yesNo(f.heldOnly)} onPick={(v) => ctl.set({ heldOnly: v === "on" })} options={[
          { value: "off", label: L.all },
          { value: "on", label: L.heldOnly },
        ]} />
        <Seg label={L.health} value={yesNo(f.aOnly)} onPick={(v) => ctl.set({ aOnly: v === "on" })} options={[
          { value: "off", label: L.all },
          { value: "on", label: L.aOnly },
        ]} />
        {ctl.strategies.length > 0 && (
          <Seg label={L.strategy} value={f.strategy} onPick={(v) => ctl.set({ strategy: v })} options={[
            { value: "all", label: L.all },
            ...ctl.strategies.map((s) => ({ value: s, label: term(lang, s) })),
          ]} />
        )}
        <Seg<CrossFilter> label={L.cross} value={f.cross} onPick={(v) => ctl.set({ cross: v })} options={[
          { value: "all", label: L.all },
          { value: "pt", label: L.crossPt },
          { value: "golden_soon", label: <span className="up">▲ {L.crossGoldenSoon}</span> },
          { value: "golden", label: <span className="up">▲ {L.crossGolden}</span> },
          { value: "dead_soon", label: <span className="down">▼ {L.crossDeadSoon}</span> },
          { value: "dead", label: <span className="down">▼ {L.crossDead}</span> },
        ]} />
        <Seg label={L.insider} value={f.insider} onPick={(v) => ctl.set({ insider: v })} options={[
          { value: "all", label: L.all },
          { value: "cluster", label: <><span className="up">▲ {L.insCluster}</span> <Count n={ctl.insiders.cluster} /></> },
          { value: "buy", label: <><span className="up">▲ {L.insBuy}</span> <Count n={ctl.insiders.buy} /></> },
          { value: "sell", label: <><span className="down">▼ {L.insSell}</span> <Count n={ctl.insiders.sell} /></> },
        ]} />
        {/* SQZ 모멘텀 (TradingView Squeeze Momentum [LazyBear]) — 표시 전용. 상태 = 점(압축) · 방향 = 막대(색 대신 뜻으로).
            봉은 목록 배지·정렬에도 같이 쓴다 ('모두'면 필터는 세 봉 다, 정렬은 주봉) */}
        <Seg<SqzPick> label={L.sqzTfLabel} value={f.sqzTf} onPick={(v) => ctl.set({ sqzTf: v })}
          options={SQZ_PICKS.map((p) => ({ value: p, label: L.sqzTfLong[p], title: p === "all" ? L.sqzTfAllHelp : L.sqzNote }))} />
        <Seg<Filters["sqz"]> label={L.sqzPhaseLabel} value={f.sqz} onPick={(v) => ctl.set({ sqz: v })} options={[
          { value: "all", label: L.all, title: L.sqzNote },
          ...SQZ_PHASES.map((p) => ({
            value: p,
            label: <>{p !== "off" && <span className={`sqz-dot sqz-dot--${p === "on" ? "black" : "gray"}`} aria-hidden="true" />} {L.sqzPhase[p]} <Count n={ctl.sqzPhases[p]} /></>,
            title: `${L.sqzPhaseHelp[p]}\n${L.sqzNote}`,
          })),
        ]} />
        <Seg<Filters["sqzDir"]> label={L.sqzDirLabel} value={f.sqzDir} onPick={(v) => ctl.set({ sqzDir: v })} options={[
          { value: "all", label: L.all, title: L.sqzNote },
          ...SQZ_DIRS.map((d) => ({
            value: d,
            label: (
              <>
                <span className={`sqz-bar sqz-bar--${d}`} aria-hidden="true" />{" "}
                <span className={sqzUp(d) ? "up" : "down"}>{sqzUp(d) ? "▲" : "▼"}</span> {L.sqzDir[d]} <Count n={ctl.sqzDirs[d]} />
              </>
            ),
            title: `${L.sqzDirHelp[d]}\n${L.sqzNote}`,
          })),
        ]} />
        <Seg wide label={L.pattern} value={f.pattern} onPick={(v) => ctl.set({ pattern: v })} options={[
          { value: "all", label: L.all },
          ...ctl.patterns.map(([p, n]) => ({ value: p, label: <><PatternName name={p} /> <Count n={n} /></> })),
          // 지금 고른 패턴이 다른 필터 때문에 0개가 돼도 버튼은 남겨 둔다 (끌 수 있게)
          ...(f.pattern !== "all" && !ctl.patterns.some(([p]) => p === f.pattern)
            ? [{ value: f.pattern, label: <><PatternName name={f.pattern} /> <Count n={0} /></> }]
            : []),
        ]} />
        <Seg<SortKey> wide label={L.sort} value={ctl.sort} onPick={ctl.pickSort} activeTitle={L.dirAria} options={SORT_KEYS.map((k) => {
          const arrow = k === ctl.sort && k !== "default" ? (ctl.dir === "desc" ? " ↓" : " ↑") : "";
          const isb = isbSortLabel(k);
          if (isb) {
            return { value: k, label: <><span className={ISB_UP[isb] ? "up" : "down"}>{L.sorts[k]}</span>{arrow}</>,
              title: `${L.isbHelp[isb]}\n${L.isbNote}` };
          }
          if (isSqzSort(k)) {
            const key = k as "sqz_run" | "sqz_mom" | "sqz_fade";
            const tf = sqzSortTf(f.sqzTf);
            return { value: k, label: <>{L.sorts[k]} <span className="muted">{L.sqzTf[tf]}</span>{arrow}</>,
              title: `${L.sqzSortHelp[key]} (${L.sqzTfLong[tf]})\n${L.sqzNote}` };
          }
          return { value: k, label: <>{L.sorts[k]}{arrow}</> };
        })} />
      </div>
      <div className="controls__foot">
        <div className="ctl-search">
          <label htmlFor={`${idPrefix}-search`} className="sr-only">{L.search}</label>
          <SearchIcon />
          <input id={`${idPrefix}-search`} className="input" type="search" value={f.q} placeholder={L.searchPh}
            autoCapitalize="characters" autoComplete="off" spellCheck={false}
            onChange={(e) => ctl.set({ q: e.target.value })} />
        </div>
        <span role="status" className="controls__count">
          <span className="num" style={{ fontWeight: 600, color: "var(--ink)" }}>{count[0]}</span>
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

/** 목록·차트 바로 위 얇은 줄 — 보여 줄 봉 · 차트 크기. */
export function ViewBar({ ctl }: { ctl: StockListCtl }) {
  const { t } = useT();
  const L = t.list;
  return (
    <section className="card view-bar" aria-label={t.charts.controls}>
      <div className="ctl-group" role="group" aria-label={L.tfs}>
        <span className="ctl-group__label">{L.tfs}</span>
        <div className="tseg">
          {TIMEFRAMES.map((k) => (
            <button key={k} type="button" aria-pressed={ctl.tfs.includes(k)} onClick={() => ctl.toggleTf(k)}>
              {ctl.tfs.includes(k) && <CheckIcon />}
              {t.common.tf[k]}
            </button>
          ))}
        </div>
      </div>
      <Seg<ChartSize> label={t.charts.size} value={ctl.size} onPick={ctl.pickSize} options={[
        { value: "small", label: t.charts.sizeSmall, title: t.charts.sizeSmallHelp },
        { value: "auto", label: t.charts.sizeAuto },
        { value: "large", label: t.charts.sizeLarge, title: t.charts.sizeLargeHelp },
      ]} />
      <ChartModeSeg />
      <StudyChips />
    </section>
  );
}

function SearchIcon() {
  return (
    <svg className="ctl-search__icon" width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
    </svg>
  );
}
