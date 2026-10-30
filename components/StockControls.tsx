"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChartModeSeg, StudyChips } from "./ChartModeBar";
import { useT } from "./LangProvider";
import { PatternName } from "./StockChips";
import { term } from "@/lib/i18n";
import { crossFilterTitle } from "@/lib/patternHelp";
import {
  crossCounts,
  DEFAULT_DIR,
  EMPTY_FILTERS,
  insiderCounts,
  ISB_UP,
  isbSortLabel,
  isSqzSort,
  passes,
  PATTERN_TFS,
  patternCounts,
  SORT_GROUPS,
  sortRows,
  SQZ_DIRS,
  SQZ_PHASES,
  SQZ_PICKS,
  sqzDirCounts,
  styleCounts,
  sqzPhaseCounts,
  sqzSortTf,
  sqzUp,
  type CrossFilter,
  type Filters,
  type ListPreset,
  type ListRow,
  type PatternTf,
  type SortKey,
  type SqzPick,
} from "@/lib/stockList";
import { TIMEFRAMES, type Timeframe } from "@/lib/types";

/** 차트 크기 — 작게(한 줄에 여럿) · 보통(화면 폭에 맞춰 자동) · 크게(한 줄에 하나). */
export type ChartSize = "small" | "auto" | "large";
const SIZES: ChartSize[] = ["small", "auto", "large"];
const SIZE_KEY = "charts:size";
const TFS_KEY = "charts:tfs";
const OPEN_KEY = "controls:open";
/** 이 폭 이하면 펼친 필터가 아래에서 올라오는 시트 (globals.css 의 .controls--stock 시트 규칙과 같은 값). */
const SHEET_MQ = "(max-width: 760px)";
/** 켜진 필터 수에서 빼는 칸 — 검색은 아래에 따로 보이고, 봉 고르기는 그것만으로는 거르지 않는다. */
const NOT_COUNTED: (keyof Filters)[] = ["q", "crossTf", "patternTf", "sqzTf"];

/**
 * 필터·정렬·보여 줄 봉·차트 크기 상태 + 걸러서 정렬한 목록. 후보·차트 페이지가 똑같이 쓴다.
 * preset = 처음 걸어 둘 필터·정렬 (섹터 지도에서 넘어온 전체분석). '초기화'는 preset 이 아니라 빈 필터로.
 */
export function useStockList(rows: ListRow[], initialTfs: Timeframe[] = ["Daily", "Weekly"], preset?: ListPreset) {
  const [filters, setFilters] = useState<Filters>(() => ({ ...EMPTY_FILTERS, ...preset?.filters }));
  const [sort, setSort] = useState<SortKey>(preset?.sort ?? "default");
  const [dir, setDir] = useState<"desc" | "asc">(DEFAULT_DIR[preset?.sort ?? "default"]);
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

  const patterns = useMemo(
    () => patternCounts(rows.filter((r) => passes(r, { ...filters, q }, "pattern")), filters.patternTf),
    [rows, filters, q],
  );
  const crosses = useMemo(
    () => crossCounts(rows.filter((r) => passes(r, { ...filters, q }, "cross")), filters.crossTf),
    [rows, filters, q],
  );
  const insiders = useMemo(() => insiderCounts(rows.filter((r) => passes(r, { ...filters, q }, "insider"))), [rows, filters, q]);
  const sqzPhases = useMemo(
    () => sqzPhaseCounts(rows.filter((r) => passes(r, { ...filters, q }, "sqz")), filters.sqzTf),
    [rows, filters, q],
  );
  const sqzDirs = useMemo(
    () => sqzDirCounts(rows.filter((r) => passes(r, { ...filters, q }, "sqzDir")), filters.sqzTf),
    [rows, filters, q],
  );
  const cycles = useMemo(() => styleCounts(rows.filter((r) => passes(r, { ...filters, q }, "cycle"))), [rows, filters, q]);
  const regions = useMemo(() => styleCounts(rows.filter((r) => passes(r, { ...filters, q }, "region"))), [rows, filters, q]);
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
    /** 정렬 칸 오른쪽 위 '높은 순 / 낮은 순'. */
    setDir,
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
    crosses,
    insiders,
    sqzPhases,
    sqzDirs,
    cycles,
    regions,
    hasStyle: rows.some((r) => r.info?.style),
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

/** 이름 + 붙은 버튼 묶음 하나 (넓으면 여러 묶음이 한 줄에, 패턴처럼 많은 건 한 줄 전부). */
function Seg<T extends string>({ label, value, options, onPick, wide = false }: {
  label: string;
  value: T;
  options: Opt<T>[];
  onPick: (v: T) => void;
  wide?: boolean;
}) {
  return (
    <div className={`ctl-group${wide ? " ctl-group--wide" : ""}`} role="group" aria-label={label}>
      <span className="ctl-group__label">{label}</span>
      <div className={`tseg${wide ? " tseg--wrap" : ""}`}>
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onPick(o.value)}
            title={o.title}>
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

/**
 * 필터·정렬·보기 — 네 페이지(후보·차트추천·전체차트·전체분석)가 같은 배치.
 * 평소엔 버튼 한 줄(켜진 필터 수 + 정렬·봉·크기 요약)로 접어 두고, 누르면 펼친다 — 넓은 화면은 그 자리에,
 * 폰은 아래에서 올라오는 시트. 검색·개수는 접어도 늘 보인다.
 */
export function StockControls({ ctl, idPrefix }: { ctl: StockListCtl; idPrefix: string }) {
  const { lang, t } = useT();
  const L = t.list;
  const f = ctl.filters;
  const patTf = f.patternTf === "all" ? undefined : f.patternTf; // 패턴 버튼 마우스 설명 (그 봉의 찾는 구간)
  const yesNo = (on: boolean) => (on ? "on" : "off");
  const count = L.count(ctl.shown.length, ctl.rows.length);
  const dirty =
    JSON.stringify(f) !== JSON.stringify(EMPTY_FILTERS) || ctl.sort !== "default";
  const active = (Object.keys(EMPTY_FILTERS) as (keyof Filters)[])
    .filter((k) => !NOT_COUNTED.includes(k) && f[k] !== EMPTY_FILTERS[k]).length;
  const summary = [
    ctl.sort === "default" ? L.sorts.default : `${L.sorts[ctl.sort]} ${ctl.dir === "desc" ? "↓" : "↑"}`,
    ctl.tfs.map((k) => t.common.tf[k]).join("+"),
    ctl.size === "small" ? t.charts.sizeSmall : ctl.size === "large" ? t.charts.sizeLarge : t.charts.sizeAuto,
  ].join(" · ");

  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // 넓은 화면에서 펼쳐 둔 채 떠났으면 다음에도 펼쳐서 (폰 시트는 늘 접힌 채로 시작)
  useEffect(() => {
    try {
      if (!window.matchMedia(SHEET_MQ).matches && window.localStorage.getItem(OPEN_KEY) === "1") setOpen(true);
    } catch {
      // 저장이 막힌 브라우저 — 접힌 채로
    }
  }, []);
  const pickOpen = (v: boolean) => {
    setOpen(v);
    try {
      if (!window.matchMedia(SHEET_MQ).matches) window.localStorage.setItem(OPEN_KEY, v ? "1" : "0");
    } catch {
      // 기억만 못 할 뿐
    }
  };
  const close = () => {
    pickOpen(false);
    toggleRef.current?.focus({ preventScroll: true });
  };

  // 폰 시트: 뒤 페이지 스크롤 막기 · 닫기 버튼으로 포커스 · Esc 로 닫기
  useEffect(() => {
    if (!open || !window.matchMedia(SHEET_MQ).matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]); // 열고 닫힐 때만

  return (
    <section className="card controls controls--stock" aria-label={L.controls}>
      <button ref={toggleRef} type="button" className="ctl-toggle" aria-expanded={open} aria-controls={bodyId}
        onClick={() => pickOpen(!open)}>
        <FilterIcon />
        <span className="ctl-toggle__label">{L.filtersBtn}</span>
        {active > 0 && (
          <>
            <span className="ctl-toggle__n num" aria-hidden="true">{active}</span>
            <span className="sr-only">{L.activeCount(active)}</span>
          </>
        )}
        <span className="ctl-toggle__sum">{summary}</span>
        <span className="ctl-toggle__chev" aria-hidden="true" />
      </button>
      {open && <div className="ctl-scrim" aria-hidden="true" onClick={close} />}
      <div id={bodyId} className="ctl-body" hidden={!open} role="group" aria-label={L.filtersBtn}>
        <div className="ctl-sheet-head">
          <span className="ctl-sheet-head__title">{L.filtersBtn}</span>
          {dirty && (
            <button type="button" className="btn btn--small" onClick={ctl.reset}>
              {L.reset}
            </button>
          )}
          <button ref={closeRef} type="button" className="ctl-sheet-close" aria-label={L.close} onClick={close}>
            <CloseIcon />
          </button>
        </div>
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
          {/* 경기순환/방어 × 내수/글로벌 (업종 + SEC 10-K 미국 매출 비중, 표시 전용) — 데이터가 있을 때만 */}
          {ctl.hasStyle && (
            <>
              <Seg<Filters["cycle"]> label={t.style.filterCycle} value={f.cycle} onPick={(v) => ctl.set({ cycle: v })} options={[
                { value: "all", label: L.all, title: t.style.cycleBasis },
                ...(["cyclical", "defensive"] as const).map((c) => ({
                  value: c, label: <>{t.style.cycle[c]} <Count n={ctl.cycles[c]} /></>, title: t.style.cycleBasis,
                })),
              ]} />
              <Seg<Filters["region"]> label={t.style.filterRegion} value={f.region} onPick={(v) => ctl.set({ region: v })} options={[
                { value: "all", label: L.all, title: t.style.basisSec("70%", null) },
                ...(["domestic", "global"] as const).map((r) => ({
                  value: r, label: <>{t.style.region[r]} <Count n={ctl.regions[r]} /></>, title: t.style.basisSec("70%", null),
                })),
              ]} />
            </>
          )}
          {/* 크로스 봉 — 패턴 봉과 따로 고른다 (예: 주봉 이중바닥 + 일봉 골든 임박) */}
          <Seg<PatternTf> label={L.crossTfLabel} value={f.crossTf} onPick={(v) => ctl.set({ crossTf: v })}
            options={PATTERN_TFS.map((p) => ({ value: p, label: L.patternTf[p], title: L.crossTfHelp }))} />
          <Seg<CrossFilter> label={L.cross} value={f.cross} onPick={(v) => ctl.set({ cross: v })} options={[
            { value: "all", label: L.all },
            { value: "pt", label: <>{L.crossPt} <Count n={ctl.crosses.pt} /></>, title: crossFilterTitle(L, "pt", f.crossTf) },
            { value: "golden_soon", label: <><span className="up">▲ {L.crossGoldenSoon}</span> <Count n={ctl.crosses.golden_soon} /></>,
              title: crossFilterTitle(L, "golden_soon", f.crossTf) },
            { value: "golden", label: <><span className="up">▲ {L.crossGolden}</span> <Count n={ctl.crosses.golden} /></>,
              title: crossFilterTitle(L, "golden", f.crossTf) },
            { value: "dead_soon", label: <><span className="down">▼ {L.crossDeadSoon}</span> <Count n={ctl.crosses.dead_soon} /></>,
              title: crossFilterTitle(L, "dead_soon", f.crossTf) },
            { value: "dead", label: <><span className="down">▼ {L.crossDead}</span> <Count n={ctl.crosses.dead} /></>,
              title: crossFilterTitle(L, "dead", f.crossTf) },
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
          <Seg<PatternTf> label={L.patternTfLabel} value={f.patternTf} onPick={(v) => ctl.set({ patternTf: v })}
            options={PATTERN_TFS.map((p) => ({ value: p, label: L.patternTf[p], title: L.patternTfHelp }))} />
          <Seg wide label={L.pattern} value={f.pattern} onPick={(v) => ctl.set({ pattern: v })} options={[
            { value: "all", label: L.all },
            ...ctl.patterns.map(([p, n]) => ({ value: p, label: <><PatternName name={p} tf={patTf} /> <Count n={n} /></> })),
            // 지금 고른 패턴이 다른 필터 때문에 0개가 돼도 버튼은 남겨 둔다 (끌 수 있게)
            ...(f.pattern !== "all" && !ctl.patterns.some(([p]) => p === f.pattern)
              ? [{ value: f.pattern, label: <><PatternName name={f.pattern} tf={patTf} /> <Count n={0} /></> }]
              : []),
          ]} />
        </div>
        <SortPicker ctl={ctl} />
        <div className="ctl-view" role="group" aria-label={t.charts.controls}>
          <ViewGroups ctl={ctl} />
        </div>
        <div className="ctl-sheet-foot">
          <button type="button" className="btn btn--primary" onClick={close}>
            {L.showN(ctl.shown.length)}
          </button>
        </div>
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

/**
 * 정렬 — 22개를 6묶음 칸으로 (넓으면 6칸, 좁으면 3칸·2칸). 방향은 오른쪽 위 '높은 순 / 낮은 순'으로 따로,
 * 같은 항목을 한 번 더 눌러 뒤집는 것도 그대로. 스퀴즈 묶음은 제목에 봉(SQZ 봉 설정)을 붙이고 항목 이름은 짧게.
 */
function SortPicker({ ctl }: { ctl: StockListCtl }) {
  const { t } = useT();
  const L = t.list;
  const tf = sqzSortTf(ctl.filters.sqzTf);
  const plain = ctl.sort === "default"; // 기본 순서는 방향이 없다
  const capId = useId();
  return (
    <div className="sortx" role="group" aria-label={L.sort}>
      <div className="sortx__head">
        <span className="ctl-group__label">{L.sort}</span>
        <span className="sortx__cur">
          {L.sorts[ctl.sort]}
          {!plain && <span className="muted"> · {L.dirWord[ctl.dir]}</span>}
        </span>
        <div className="tseg sortx__dir" role="group" aria-label={L.dirLabel}>
          {(["desc", "asc"] as const).map((d) => (
            <button key={d} type="button" aria-pressed={!plain && ctl.dir === d} disabled={plain} onClick={() => ctl.setDir(d)}>
              {L.dir[d]}
            </button>
          ))}
        </div>
      </div>
      <div className="sortx__grid">
        {SORT_GROUPS.map(([g, keys]) => (
          <div key={g} className="sortx__col" role="group" aria-labelledby={`${capId}-${g}`}>
            <p className="sortx__cap" id={`${capId}-${g}`}>
              {L.sortGroups[g]}
              {g === "isb" && <span> · ISB</span>}
              {g === "sqz" && <span> · {L.sqzTfLong[tf]}</span>}
            </p>
            {keys.map((k) => {
              const on = ctl.sort === k;
              const isb = isbSortLabel(k);
              const sqz = isSqzSort(k) ? (k as "sqz_run" | "sqz_mom" | "sqz_fade") : null;
              const title = isb
                ? `${L.isbHelp[isb]}\n${L.isbNote}`
                : sqz
                  ? `${L.sqzSortHelp[sqz]} (${L.sqzTfLong[tf]})\n${L.sqzNote}`
                  : on && !plain ? L.dirAria : undefined;
              return (
                <button key={k} type="button" className="sortx__opt" aria-pressed={on} title={title} onClick={() => ctl.pickSort(k)}>
                  <span className={isb ? (ISB_UP[isb] ? "up" : "down") : undefined}>{sqz ? L.sortShort[sqz] : L.sorts[k]}</span>
                  {on && !plain && <span className="sortx__arrow" aria-hidden="true">{ctl.dir === "desc" ? "↓" : "↑"}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 보기 설정 — 보여 줄 봉 · 차트 크기 · 캡처/실시간 · 지표 (펼친 필터 맨 아래 줄). */
function ViewGroups({ ctl }: { ctl: StockListCtl }) {
  const { t } = useT();
  const L = t.list;
  return (
    <>
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
    </>
  );
}

function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round">
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** 검색칸 앞 돋보기 (.ctl-search 안 — ETF 화면도 같이 쓴다). */
export function SearchIcon() {
  return (
    <svg className="ctl-search__icon" width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
    </svg>
  );
}
