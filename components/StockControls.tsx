"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChartModeSeg, StudyChips } from "./ChartModeBar";
import { useT } from "./LangProvider";
import { PatternName } from "./StockChips";
import { term, type Dict, type Lang } from "@/lib/i18n";
import { crossFilterTitle } from "@/lib/patternHelp";
import {
  activeChips,
  congressCounts,
  crossCounts,
  DEFAULT_DIR,
  EMPTY_FILTERS,
  hasHighLowFlag,
  highLowCounts,
  insiderCounts,
  ISB_PICKS,
  ISB_UP,
  isbSortLabel,
  isSqzSort,
  MCAP_MINS,
  mcapCounts,
  passes,
  PATTERN_TFS,
  patternCounts,
  patternTrend,
  QUICK_VIEWS,
  quickJoin,
  quickKeys,
  quickMatch,
  normalizeQuick,
  withoutQuick,
  sameFilters,
  SORT_GROUPS,
  SORT_KEYS,
  sortRows,
  SQZ_DIRS,
  SQZ_PHASES,
  SQZ_PICKS,
  sqzDirCounts,
  styleCounts,
  sqzPhaseCounts,
  sqzSortTf,
  sqzUp,
  volSpikeCount,
  type CrossFilter,
  type Filters,
  type IsbPick,
  type ListPreset,
  type ListRow,
  type PatternTf,
  type QuickKey,
  type QuickMode,
  type QuickView,
  type SortGroup,
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
/** 내 조합 (2026-11-10) — 지금 필터 · 정렬을 이 브라우저에 저장 (모든 목록 화면이 같이 쓴다). */
const MINE_KEY = "screen:mine";
const MINE_MAX = 6;
/** 고급 필터 패턴 줄에 먼저 보이는 수 (많은 순 · 두 줄쯤) — 나머지는 '+n개 더'. */
const PATTERN_FIRST = 8;
/** 이 폭 이하면 펼친 필터가 아래에서 올라오는 시트 (globals.css 의 .controls--stock 시트 규칙과 같은 값). */
const SHEET_MQ = "(max-width: 760px)";
/** 고급 필터 버튼 숫자에서 빼는 칸 — 검색 · 빠른 보기는 따로 보이고, 봉 고르기 · 묶는 법은 그것만으로는 거르지 않는다. */
const NOT_COUNTED: (keyof Filters)[] = ["q", "crossTf", "patternTf", "sqzTf", "isbTf", "quick", "quickMode"];

export type MineSet = { id: string; name: string; filters: Partial<Filters>; sort: SortKey; dir: "desc" | "asc" };

function isMineSet(v: unknown): v is MineSet {
  const m = v as MineSet;
  return Boolean(m) && typeof m.id === "string" && typeof m.name === "string" && typeof m.filters === "object"
    && SORT_KEYS.includes(m.sort) && (m.dir === "desc" || m.dir === "asc");
}

/**
 * 빠른 보기 카드 — 몇 종목인지 · 골랐는지. 숫자는 '모두 만족'이면 이 카드를 더했을 때 남는 수(고른 카드면 지금 결과),
 * '하나라도'면 다른 필터 안에서 이 카드 하나만의 수.
 */
export type QuickCard = QuickView & { n: number; on: boolean };
export type MineCard = MineSet & { n: number; on: boolean };

/**
 * 필터·정렬·보여 줄 봉·차트 크기 상태 + 걸러서 정렬한 목록. 후보·차트 페이지가 똑같이 쓴다.
 * preset = 처음 걸어 둘 필터·정렬 (섹터 지도 · 오늘 탭 52주 신고가 · 신저가에서 넘어온 전체분석). '초기화'는 preset 이 아니라 빈 필터로.
 */
export function useStockList(rows: ListRow[], initialTfs: Timeframe[] = ["Daily", "Weekly"], preset?: ListPreset) {
  const hasHighLow = useMemo(() => rows.some(hasHighLowFlag), [rows]);
  const [filters, setFilters] = useState<Filters>(() => {
    const f = { ...EMPTY_FILTERS, ...preset?.filters };
    // 52주 표시가 없는 목록(예전 파일)이면 주소의 ?hl= 은 버린다 — 빈 목록 대신 전체
    return f.hl52 !== "all" && !hasHighLow ? { ...f, hl52: "all" } : f;
  });
  const [sort, setSort] = useState<SortKey>(preset?.sort ?? "default");
  const [dir, setDir] = useState<"desc" | "asc">(DEFAULT_DIR[preset?.sort ?? "default"]);
  const [tfs, setTfs] = useState<Timeframe[]>(initialTfs);
  const [size, setSize] = useState<ChartSize>("auto");
  const [mine, setMine] = useState<MineSet[]>([]);
  const q = useDeferredValue(filters.q);

  // 차트 크기·보여 줄 봉 · 내 조합은 이 브라우저에 기억 (서버 렌더는 기본값으로 그리고, 화면에 붙은 뒤 바꾼다)
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(SIZE_KEY) as ChartSize | null;
      if (v && SIZES.includes(v)) setSize(v);
      const saved: unknown = JSON.parse(window.localStorage.getItem(TFS_KEY) ?? "null");
      if (Array.isArray(saved)) {
        const picked = TIMEFRAMES.filter((k) => saved.includes(k));
        if (picked.length) setTfs(picked);
      }
      const m: unknown = JSON.parse(window.localStorage.getItem(MINE_KEY) ?? "[]");
      if (Array.isArray(m)) setMine(m.filter(isMineSet).slice(0, MINE_MAX));
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
  const storeMine = (next: MineSet[]) => {
    setMine(next);
    try {
      window.localStorage.setItem(MINE_KEY, JSON.stringify(next));
    } catch {
      // 이번 창에서만
    }
  };

  const shown = useMemo(() => {
    const f = { ...filters, q };
    return sortRows(rows.filter((r) => passes(r, f)), sort, dir, sqzSortTf(filters.sqzTf), filters.isbTf);
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
  const congress = useMemo(() => congressCounts(rows.filter((r) => passes(r, { ...filters, q }, "congress"))), [rows, filters, q]);
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
  const highLows = useMemo(() => highLowCounts(rows.filter((r) => passes(r, { ...filters, q }, "hl52"))), [rows, filters, q]);
  const mcaps = useMemo(() => mcapCounts(rows.filter((r) => passes(r, { ...filters, q }, "mcap"))), [rows, filters, q]);
  const volN = useMemo(() => volSpikeCount(rows.filter((r) => passes(r, { ...filters, q }, "vol"))), [rows, filters, q]);
  const healthA = useMemo(
    () => rows.filter((r) => passes(r, { ...filters, q }, "aOnly") && (r.info?.health?.grade ?? "").startsWith("A")).length,
    [rows, filters, q],
  );
  const strategies = useMemo(
    () => Array.from(new Set(rows.map((r) => r.info?.strategy).filter((s): s is string => Boolean(s)))),
    [rows],
  );
  // 칸마다 그 자료가 목록에 하나라도 있나 — 없으면 버튼 · 빠른 보기 카드를 만들지 않는다 (예전 파일 · 캐나다 등)
  const has = useMemo(() => ({
    mcap: rows.some((r) => r.info?.fundamentals?.market_cap != null),
    vol: rows.some((r) => r.info?.vol_ratio != null),
    health: rows.some((r) => r.info?.health?.grade),
    insider: rows.some((r) => r.info?.insider),
    sqz: rows.some((r) => r.info?.sqzmom),
    isbM: rows.some((r) => r.info?.isb?.M), // ISB 월봉 라벨 (2026-11-13 부터 — 그 전 파일엔 없어 '월' 버튼을 숨긴다)
  }), [rows]);

  const quickOk = (k: QuickKey): boolean =>
    k === "fire" ? has.sqz
      : k === "quality" ? has.health
        : k === "insider" ? has.insider
          : k === "volume" ? has.vol
            : k === "high52" ? hasHighLow
              : k === "bottom" ? strategies.includes("바닥반등")
                : true;
  const quickViews = QUICK_VIEWS.filter((v) => quickOk(v.key));
  // 켜진 카드 — 모두 만족이면 그 조건이 지금 칸에 다 걸린 카드 (고급 필터에서 직접 눌러도 켜진다), 하나라도면 따로 고른 카드
  const quickSel = useMemo(
    () => (filters.quickMode === "or"
      ? quickKeys(filters.quick)
      : QUICK_VIEWS.filter((v) => quickOk(v.key) && quickMatch(filters, v)).map((v) => v.key)),
    [filters, has, hasHighLow, strategies],
  );
  const quick = useMemo<QuickCard[]>(
    () => QUICK_VIEWS.filter((v) => quickOk(v.key)).map((v) => {
      // 모두 만족: 이 카드 조건을 칸에 걸면 남는 수 (켜진 카드면 지금 결과) · 하나라도: 다른 칸 안에서 이 카드 하나만
      const f = filters.quickMode === "or" ? { ...filters, q, quick: v.key } : { ...filters, ...v.filters, q };
      return { ...v, n: rows.filter((r) => passes(r, f)).length, on: quickSel.includes(v.key) };
    }),
    [rows, filters, q, quickSel, has, hasHighLow, strategies],
  );
  const mineOn = (m: MineSet) =>
    sameFilters(normalizeQuick({ ...EMPTY_FILTERS, ...m.filters, q: filters.q }), filters)
      && sort === m.sort && (m.sort === "default" || dir === m.dir);
  const mineCards = useMemo<MineCard[]>(
    () => mine.map((m) => ({
      ...m,
      n: rows.filter((r) => passes(r, { ...EMPTY_FILTERS, ...m.filters, q })).length,
      on: mineOn(m),
    })),
    [mine, rows, filters, q, sort, dir],
  );
  const marketCount = (m: Filters["market"]) => (m === "all" ? rows.length : rows.filter((r) => r.market === m).length);

  const reset = () => {
    setFilters(EMPTY_FILTERS);
    setSort("default");
    setDir(DEFAULT_DIR.default);
  };

  return {
    rows,
    shown,
    filters,
    set: (patch: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...patch })),
    reset,
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
    /** 정렬 고르기 (막대의 고르기 상자) — 같은 걸 골라도 방향은 그대로. */
    setSortKey: (key: SortKey) => {
      if (key === sort) return;
      setSort(key);
      setDir(DEFAULT_DIR[key]);
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
    congress,
    sqzPhases,
    sqzDirs,
    cycles,
    regions,
    highLows,
    mcaps,
    volN,
    healthA,
    has,
    hasStyle: rows.some((r) => r.info?.style),
    hasHighLow,
    strategies,
    marketCount,
    /**
     * 빠른 보기 (2026-11-10) — 카드를 누를 때마다 더하거나 뺀다 (여러 개).
     * 모두 만족: 카드 조건을 고급 필터 칸에 걸고 · 끄면 그 칸만 비운다 (고급 필터에 눌린 버튼으로 보인다).
     * 하나라도: 따로 고른 카드 목록(filters.quick)에 넣고 뺀다.
     */
    quick,
    quickSel,
    toggleQuick: (v: QuickView) => setFilters((prev) => {
      if (prev.quickMode === "or") {
        const cur = quickKeys(prev.quick);
        return { ...prev, quick: quickJoin(cur.includes(v.key) ? cur.filter((k) => k !== v.key) : [...cur, v.key]) };
      }
      return quickMatch(prev, v) ? withoutQuick(prev, v) : { ...prev, ...v.filters };
    }),
    /** 모두 만족(and) ↔ 하나라도(or) — 켜진 카드는 그대로 옮긴다 (칸에 건 조건 ↔ 따로 고른 카드). */
    setQuickMode: (m: QuickMode) => setFilters((prev) => {
      if (prev.quickMode === m) return prev;
      if (m === "and") return normalizeQuick({ ...prev, quickMode: "and" });
      const on = QUICK_VIEWS.filter((v) => quickOk(v.key) && quickMatch(prev, v));
      const cleared = on.reduce((f, v) => withoutQuick(f, v), prev);
      return { ...cleared, quickMode: "or", quick: quickJoin(on.map((v) => v.key)) };
    }),
    /** 보이는 카드 전부 고르기 · 전부 풀기. */
    setQuickAll: (on: boolean) => setFilters((prev) => {
      if (prev.quickMode === "or") return { ...prev, quick: on ? quickJoin(quickViews.map((v) => v.key)) : "" };
      return quickViews.reduce((f, v) => (on ? { ...f, ...v.filters } : quickMatch(f, v) ? withoutQuick(f, v) : f), prev);
    }),
    /** 내 조합 — 저장한 필터 · 정렬 (이 브라우저). */
    mine: mineCards,
    mineFull: mine.length >= MINE_MAX,
    mineHas: mine.some(mineOn),
    saveMine: (name: string) => {
      if (mine.some(mineOn)) return;
      const diff: Partial<Filters> = {};
      for (const k of Object.keys(EMPTY_FILTERS) as (keyof Filters)[]) {
        if (k !== "q" && filters[k] !== EMPTY_FILTERS[k]) (diff as Record<keyof Filters, unknown>)[k] = filters[k];
      }
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      storeMine([...mine, { id, name, filters: diff, sort, dir }].slice(-MINE_MAX));
    },
    applyMine: (m: MineSet) => {
      if (mineOn(m)) {
        reset();
        return;
      }
      setFilters(normalizeQuick({ ...EMPTY_FILTERS, ...m.filters, q: filters.q }));
      setSort(m.sort);
      setDir(m.dir);
    },
    deleteMine: (id: string) => storeMine(mine.filter((m) => m.id !== id)),
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
function Seg<T extends string>({ label, value, options, onPick, wide = false, className, hideLabel = false }: {
  label: string;
  value: T;
  options: Opt<T>[];
  onPick: (v: T) => void;
  wide?: boolean;
  className?: string;
  /** 이름을 화면 읽기에만 (묶음 aria-label) — 칸 머리에 이미 이름이 있을 때 */
  hideLabel?: boolean;
}) {
  return (
    <div className={`ctl-group${wide ? " ctl-group--wide" : ""}${className ? ` ${className}` : ""}`} role="group" aria-label={label}>
      {!hideLabel && <span className="ctl-group__label">{label}</span>}
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

type ChipOpt<T> = Opt<T> & { n?: number; tone?: "up" | "down" | "neutral" };

/** 고급 필터 줄 이름 뒤 작은 봉 고르기 (크로스 · SQZ · 패턴 — 그 줄이 보는 봉). */
function TfPick<T extends string>({ label, value, options, onPick }: {
  label: string;
  value: T;
  options: Opt<T>[];
  onPick: (v: T) => void;
}) {
  return (
    <div className="tseg tseg--mini" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onPick(o.value)} title={o.title}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * 티커 검색칸 — 화면 머리 오른쪽(보기 방식 옆). 글을 쓰는 칸 밖에서 '/' 를 누르면 여기로.
 */
export function StockSearch({ ctl, idPrefix }: { ctl: StockListCtl; idPrefix: string }) {
  const { t } = useT();
  const L = t.list;
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="ctl-search head-search">
      <label htmlFor={`${idPrefix}-search`} className="sr-only">{L.search}</label>
      <SearchIcon />
      <input ref={ref} id={`${idPrefix}-search`} className="input" type="search" value={ctl.filters.q} placeholder={L.searchPh}
        autoCapitalize="characters" autoComplete="off" spellCheck={false}
        onChange={(e) => ctl.set({ q: e.target.value })} />
      {!ctl.filters.q && <kbd className="head-search__key" title={t.screen.searchKey}>/</kbd>}
    </div>
  );
}

/** 켜진 필터 칩 하나의 글자 — 봉을 고른 필터는 봉 이름을 앞에 ('주봉 골든크로스'). */
export function chipLabel(k: keyof Filters, f: Filters, t: Dict, lang: Lang): { text: string; tone: "up" | "down" | "plain" } {
  const L = t.list;
  const S = t.scr;
  const tfOf = (tf: PatternTf) => (tf === "all" ? "" : `${L.patternTf[tf]} `);
  switch (k) {
    case "mcap":
      return { text: `${S.mcap} ${f.mcap === "all" ? "" : S.mcapOpt[f.mcap]}`, tone: "plain" };
    case "vol":
      return { text: `${S.vol} ${S.volSpike}`, tone: "plain" };
    case "aOnly":
      return { text: `${L.health} ${L.aOnly}`, tone: "up" };
    case "heldOnly":
      return { text: L.heldOnly, tone: "plain" };
    case "strategy":
      return { text: term(lang, f.strategy), tone: "plain" };
    case "cycle":
      return { text: f.cycle === "all" ? "" : t.style.cycle[f.cycle], tone: "plain" };
    case "region":
      return { text: f.region === "all" ? "" : t.style.region[f.region], tone: "plain" };
    case "hl52":
      return f.hl52 === "high" ? { text: `${L.hl52} ${L.hl52High}`, tone: "up" } : { text: `${L.hl52} ${L.hl52Low}`, tone: "down" };
    case "insider":
      return f.insider === "sell"
        ? { text: `${L.insider} ${L.insSell}`, tone: "down" }
        : { text: `${L.insider} ${f.insider === "cluster" ? L.insCluster : L.insBuy}`, tone: "up" };
    case "congress":
      return f.congress === "sell"
        ? { text: `${L.congress} ${L.congSell}`, tone: "down" }
        : { text: `${L.congress} ${f.congress === "buy" ? L.congBuy : L.congLeader}`, tone: f.congress === "buy" ? "up" : "plain" };
    case "cross": {
      const name = { all: "", pt: L.crossPt, golden: L.crossGolden, golden_soon: L.crossGoldenSoon, dead: L.crossDead, dead_soon: L.crossDeadSoon }[f.cross];
      return { text: `${tfOf(f.crossTf)}${name}`, tone: f.cross.startsWith("dead") ? "down" : "up" };
    }
    case "sqz":
      return { text: `SQZ ${L.sqzTfLong[f.sqzTf]} ${f.sqz === "all" ? "" : L.sqzPhase[f.sqz]}`, tone: "plain" };
    case "sqzDir":
      return f.sqzDir === "all"
        ? { text: "", tone: "plain" }
        : { text: `SQZ ${L.sqzTfLong[f.sqzTf]} ${sqzUp(f.sqzDir) ? "▲" : "▼"} ${L.sqzDir[f.sqzDir]}`, tone: sqzUp(f.sqzDir) ? "up" : "down" };
    case "pattern": {
      const tr = patternTrend(f.pattern);
      return { text: `${tfOf(f.patternTf)}${term(lang, f.pattern)}`, tone: tr === "neutral" ? "plain" : tr };
    }
    default:
      return { text: String(f[k]), tone: "plain" };
  }
}

/** 켜진 칸 칩 중 빠른 보기 카드가 건 칸은 뺀 것 — 모두 만족이면 카드 조건이 칸에 걸려 있어서 카드 칩 하나로 묶는다. */
function fieldChips(ctl: StockListCtl): (keyof Filters)[] {
  if (ctl.filters.quickMode === "or") return activeChips(ctl.filters);
  const covered = new Set(ctl.quickSel.flatMap((k) => Object.keys(QUICK_VIEWS.find((v) => v.key === k)?.filters ?? {})));
  return activeChips(ctl.filters).filter((k) => !covered.has(k));
}

/** 정렬 이름 — 차트 라벨 정렬이고 봉을 골랐으면 봉도 ('BUY·REV 주봉'). 정렬 칩 · 내 조합 이름이 같이 쓴다. */
function sortLabel(ctl: StockListCtl, t: Dict): string {
  const name = t.list.sorts[ctl.sort];
  const pick = ctl.filters.isbTf;
  return isbSortLabel(ctl.sort) && pick !== "any" ? `${name} ${t.list.isbTfLong[pick]}` : name;
}

/** 지금 걸린 필터를 ' · ' 로 이은 짧은 이름 — 내 조합 카드 이름. 빠른 보기는 '골든크로스 + 거래량 급증' · '… 또는 …'. */
function comboName(ctl: StockListCtl, t: Dict, lang: Lang): string {
  const parts = fieldChips(ctl).map((k) => chipLabel(k, ctl.filters, t, lang).text.trim()).filter(Boolean);
  const qs = ctl.quickSel.map((k) => t.scr.quick[k].title);
  if (qs.length) parts.unshift(qs.join(ctl.filters.quickMode === "or" ? t.scr.quickOrJoin : " + "));
  if (ctl.filters.market !== "all") parts.unshift(ctl.filters.market.toUpperCase());
  if (ctl.sort !== "default") parts.push(`${sortLabel(ctl, t)} ${ctl.dir === "desc" ? "↓" : "↑"}`);
  return parts.join(" · ") || t.scr.mineEmpty;
}

/**
 * 켜진 필터 칩 (2026-11-10) — 패널을 접어도 무엇이 걸렸는지 보이고, × 로 하나씩 끈다. 정렬이 기본이 아니면 정렬 칩도.
 */
function FilterChips({ ctl }: { ctl: StockListCtl }) {
  const { lang, t } = useT();
  const S = t.scr;
  const keys = fieldChips(ctl);
  const sortOn = ctl.sort !== "default";
  const sortName = sortLabel(ctl, t);
  const qs = ctl.quickSel;
  if (!keys.length && !sortOn && !qs.length) return null;
  return (
    <div className="fchips" role="group" aria-label={S.chipsAria}>
      {/* 빠른 보기 칩 — 여러 개를 '하나라도'로 묶었으면 앞에 작은 표시 */}
      {qs.length > 1 && ctl.filters.quickMode === "or" && <span className="fchip-tag">{S.quickMode.or}</span>}
      {qs.map((k) => {
        const v = QUICK_VIEWS.find((x) => x.key === k)!;
        return (
          <button key={`q-${k}`} type="button" className="fchip fchip--quick" aria-label={S.chipOff(S.quick[k].title)}
            onClick={() => ctl.toggleQuick(v)}>
            <span>{S.quick[k].title}</span>
            <XMark />
          </button>
        );
      })}
      {keys.map((k) => {
        const { text, tone } = chipLabel(k, ctl.filters, t, lang);
        return (
          <button key={k} type="button" className="fchip" data-tone={tone} aria-label={S.chipOff(text)}
            onClick={() => ctl.set({ [k]: EMPTY_FILTERS[k] } as Partial<Filters>)}>
            <span>{text}</span>
            <XMark />
          </button>
        );
      })}
      {sortOn && (
        <button type="button" className="fchip fchip--sort" aria-label={S.chipOff(sortName)}
          onClick={() => ctl.pickSort("default")}>
          <span>{S.sortChip(sortName, ctl.dir === "desc" ? "↓" : "↑")}</span>
          <XMark />
        </button>
      )}
      {keys.length + qs.length + (sortOn ? 1 : 0) > 1 && (
        <button type="button" className="fchip-clear" onClick={ctl.reset}>{S.clearAll}</button>
      )}
    </div>
  );
}

/** 막대의 정렬 고르기 상자 + 방향 버튼 — 펼치지 않고 바로 (펼친 칸 '정렬'과 같은 상태). */
function SortSelect({ ctl, idPrefix }: { ctl: StockListCtl; idPrefix: string }) {
  const { t } = useT();
  const L = t.list;
  const plain = ctl.sort === "default";
  return (
    <div className="ctl-group sort-select">
      <label className="ctl-group__label" htmlFor={`${idPrefix}-sort`}>{t.scr.sortPick}</label>
      <div className="sort-select__box">
        <select id={`${idPrefix}-sort`} className="sort-select__el" value={ctl.sort}
          onChange={(e) => ctl.setSortKey(e.target.value as SortKey)}>
          {SORT_GROUPS.map(([g, keys]) => (
            <optgroup key={g} label={L.sortGroups[g]}>
              {keys.map((k) => <option key={k} value={k}>{L.sorts[k]}</option>)}
            </optgroup>
          ))}
        </select>
        <button type="button" className="sort-select__dir" disabled={plain} aria-label={L.dirAria}
          title={plain ? undefined : L.dir[ctl.dir === "desc" ? "asc" : "desc"]}
          onClick={() => ctl.setDir(ctl.dir === "desc" ? "asc" : "desc")}>
          {plain ? "—" : ctl.dir === "desc" ? "↓" : "↑"}
        </button>
      </div>
    </div>
  );
}

/** ISB 차트 라벨 정렬이 보는 봉 — 모두(일·주·월 중 더 최근) · 일 · 주 · 월. 위 막대 정렬 상자 옆 · 고급 필터 '차트 라벨' 줄 머리. */
function IsbTfPick({ ctl }: { ctl: StockListCtl }) {
  const { t } = useT();
  const L = t.list;
  // '월'은 목록에 월봉 라벨이 하나라도 있을 때만 (예전 자료) — 이미 골라 둔 채면 끌 수 있게 남긴다
  const picks = ISB_PICKS.filter((p) => p !== "M" || ctl.has.isbM || ctl.filters.isbTf === "M");
  return (
    <TfPick<IsbPick> label={t.scr.tfAria(t.scr.sortRow.isb)} value={ctl.filters.isbTf} onPick={(v) => ctl.set({ isbTf: v })}
      options={picks.map((p) => ({ value: p, label: L.isbPick[p], title: L.isbPickHelp[p] }))} />
  );
}

/**
 * 필터·정렬·보기 — 네 페이지(후보·차트추천·전체차트·전체분석)가 같은 배치 (2026-11-10 개편).
 * 위 막대 = 자주 바꾸는 것 (시장 · 시총 · 헬스 · 정렬) + '고급 필터' 버튼 + 개수. 그 밑 = 켜진 필터 칩 · 안내 목록(extra).
 * '고급 필터'를 누르면 촘촘한 네 칸(① 기본 · 기업 ② 차트 신호 · 패턴 / ③ 정렬 ④ 차트 보기 — 사용자 시안, 이름 왼쪽 · 알약 오른쪽 한 줄씩)
 * + 꼬리(몇 개 일치 · 초기화 · 내 조합 저장 · n개 보기). 정렬은 위 막대의 고르기 상자와 같은 상태.
 * 누르는 즉시 목록이 바뀐다 ('적용' 버튼 없음). 폰(760px 이하)은 아래에서 올라오는 시트, 시장 · 시총 · 헬스도 시트 안으로.
 * 검색칸은 StockSearch 로 따로 (화면 머리에).
 */
export function StockControls({ ctl, idPrefix, extra, onShow }: {
  ctl: StockListCtl;
  idPrefix: string;
  extra?: React.ReactNode;
  /** 꼬리의 'n개 보기' — 칸을 닫은 뒤 (화면이 목록으로 가게) */
  onShow?: () => void;
}) {
  const { lang, t } = useT();
  const L = t.list;
  const S = t.scr;
  const f = ctl.filters;
  const patTf = f.patternTf === "all" ? undefined : f.patternTf; // 패턴 버튼 마우스 설명 (그 봉의 찾는 구간)
  const yesNo = (on: boolean) => (on ? "on" : "off");
  const count = L.count(ctl.shown.length, ctl.rows.length);
  const dirty = JSON.stringify(f) !== JSON.stringify(EMPTY_FILTERS) || ctl.sort !== "default";
  const active = (Object.keys(EMPTY_FILTERS) as (keyof Filters)[])
    .filter((k) => !NOT_COUNTED.includes(k) && f[k] !== EMPTY_FILTERS[k]).length;
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  // 패턴은 많은 순 8개만 먼저 (전체분석은 20개 넘어 줄이 다섯 줄까지 늘었다) — 고른 패턴은 늘 보인다
  const [patAll, setPatAll] = useState(false);
  const shownPatterns = patAll
    ? ctl.patterns
    : ctl.patterns.filter(([p], i) => i < PATTERN_FIRST || p === f.pattern);
  const patternsHidden = ctl.patterns.length - shownPatterns.length;
  // 하나라도로 묶은 카드가 서는 조건 — 고급 필터에 점선 버튼으로 (칸에는 안 걸려 있다)
  const orCards = f.quickMode === "or" ? ctl.quickSel.map((k) => QUICK_VIEWS.find((v) => v.key === k)!).filter(Boolean) : [];
  const orMark = (key: keyof Filters) => {
    const vals = new Set(orCards.map((v) => v.filters[key]).filter((x) => x != null).map(String));
    return vals.size ? (val: string) => vals.has(val) : undefined;
  };
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

  // '저장했어요'는 잠깐만
  useEffect(() => {
    if (!saved) return;
    const id = window.setTimeout(() => setSaved(false), 1800);
    return () => window.clearTimeout(id);
  }, [saved]);

  // 시장 버튼 — 목록에 있는 시장만 (전체분석 캐나다 탭은 TSX · TSXV, 전체 탭은 S&P 500 · 나스닥·NYSE · 번외).
  // 한 시장뿐이면(전체분석 S&P 500 · 번외 탭 등) 고를 게 없어서 숨긴다
  const marketOpts = (
    [["sp500", "S&P 500"], ["nasdaq", term(lang, "나스닥·NYSE")], ["tsx", "TSX"], ["tsxv", "TSXV"], ["extra", term(lang, "번외")]] as const
  ).map(([value, name]) => ({ value, name, n: ctl.marketCount(value) })).filter((o) => o.n > 0);
  const twoMarkets = marketOpts.length >= 2;
  const cad = ctl.rows.length > 0 && ctl.rows.every((r) => r.market === "tsx" || r.market === "tsxv");
  const mcapName = (k: "2b" | "10b") => (cad ? S.mcapOpt[k].replace("$", "C$") : S.mcapOpt[k]);
  const count0 = (n: number) => <span className="tseg__count">{n.toLocaleString()}</span>;

  // 위 막대의 시장 · 시총 · 헬스 (폰은 시트 '기본 · 기업' 맨 위 줄로 — ChipRow sheet)
  const marketSeg = (className: string) => (
    <Seg label={L.market} value={f.market} onPick={(v) => ctl.set({ market: v })} className={className} options={[
      { value: "all", label: <>{L.all} {count0(ctl.marketCount("all"))}</> },
      ...marketOpts.map((o) => ({ value: o.value, label: <>{o.name} {count0(o.n)}</> })),
    ]} />
  );
  const mcapSeg = (className: string) => (
    <Seg<Filters["mcap"]> label={S.mcap} value={f.mcap} onPick={(v) => ctl.set({ mcap: v })} className={className} options={[
      { value: "all", label: L.all },
      ...MCAP_MINS.map((k) => ({ value: k, label: <>{mcapName(k)} {count0(ctl.mcaps[k])}</>, title: S.mcapHelp[k] })),
    ]} />
  );
  const healthSeg = (className: string) => (
    <Seg label={S.health} value={yesNo(f.aOnly)} onPick={(v) => ctl.set({ aOnly: v === "on" })} className={className} options={[
      { value: "off", label: L.all },
      { value: "on", label: <>{L.aOnly} {count0(ctl.healthA)}</>, title: t.cands.helpHealth },
    ]} />
  );

  const save = () => {
    if (ctl.mineHas || ctl.mineFull) return;
    ctl.saveMine(comboName(ctl, t, lang));
    setSaved(true);
  };
  const match = S.footMatch(ctl.shown.length, ctl.rows.length);

  return (
    <section className="controls controls--stock" aria-label={L.controls}>
      {/* 위 막대 — 시안 2의 간편 막대: 시장 · 시총 · 헬스 · 정렬 · 고급 필터 · 개수 */}
      <div className="ctl-bar">
        {twoMarkets && marketSeg("ctl-bar__market ctl-bar__quick")}
        {ctl.has.mcap && mcapSeg("ctl-bar__quick")}
        {ctl.has.health && healthSeg("ctl-bar__quick")}
        <SortSelect ctl={ctl} idPrefix={idPrefix} />
        {/* 차트 라벨 정렬일 때만 — 모두 · 일 · 주 · 월 (고급 필터 정렬 칸 '차트 라벨' 줄과 같은 상태). 폰은 막대 밑 한 줄 */}
        {isbSortLabel(ctl.sort) && (
          <div className="ctl-bar__isbtf">
            <IsbTfPick ctl={ctl} />
          </div>
        )}
        <button ref={toggleRef} type="button" className="ctl-toggle ctl-toggle--adv" aria-expanded={open} aria-controls={bodyId}
          onClick={() => pickOpen(!open)}>
          <FilterIcon />
          <span className="ctl-toggle__label">{S.advBtn}</span>
          {active > 0 && (
            <>
              <span className="ctl-toggle__n num" aria-hidden="true">{active}</span>
              <span className="sr-only">{L.activeCount(active)}</span>
            </>
          )}
          <span className="ctl-toggle__chev" aria-hidden="true" />
        </button>
      </div>
      {/* 그 밑 한 줄: 개수 · 켜진 필터 칩 (왼쪽) · 안내 목록 (오른쪽) — 거른 게 없으면 개수는 화면 읽기에만 */}
      <div className="ctl-subbar">
        <span role="status" className="controls__count" data-idle={ctl.shown.length === ctl.rows.length || undefined}>
          <span className="num" style={{ fontWeight: 700, color: "var(--ink)" }}>{count[0]}</span>
          {count[1]}
        </span>
        <FilterChips ctl={ctl} />
        {extra && <div className="ctl-bar__extra">{extra}</div>}
      </div>
      {open && <div className="ctl-scrim" aria-hidden="true" onClick={close} />}
      <div id={bodyId} className="ctl-body adv" hidden={!open} role="group" aria-label={S.advBtn}>
        <div className="ctl-sheet-head">
          <span className="ctl-sheet-head__title">{S.advBtn}</span>
          {dirty && (
            <button type="button" className="btn btn--small" onClick={ctl.reset}>
              {L.reset}
            </button>
          )}
          <button ref={closeRef} type="button" className="ctl-sheet-close" aria-label={L.close} onClick={close}>
            <CloseIcon />
          </button>
        </div>
        {orCards.length > 0 && (
          <p className="adv-ornote">
            <span className="adv-ornote__mark" aria-hidden="true" />
            {S.orNote(orCards.map((v) => S.quick[v.key].title).join(" · "))}
          </p>
        )}
        <div className="adv__grid">
          {/* ① 기본 · 기업 — 이름 왼쪽 · 알약 오른쪽 한 줄씩, 짧은 줄은 두 칸에 */}
          <section className="adv-sec adv-sec--basic" aria-labelledby={`${bodyId}-s1`}>
            <SecHead n={1} id={`${bodyId}-s1`} title={S.sec.basic} />
            <div className="adv-grid">
              {/* 폰 시트에서만 (넓은 화면은 위 막대에 있다) */}
              {twoMarkets && (
                <ChipRow wide sheet label={L.market} value={f.market} none="all" onPick={(v) => ctl.set({ market: v })} options={[
                  ...marketOpts.map((o) => ({ value: o.value, label: o.name, n: o.n })),
                ]} />
              )}
              {ctl.has.mcap && (
                <ChipRow sheet label={S.mcap} value={f.mcap} none="all" onPick={(v) => ctl.set({ mcap: v })} options={[
                  ...MCAP_MINS.map((k) => ({ value: k, label: mcapName(k), n: ctl.mcaps[k], title: S.mcapHelp[k] })),
                ]} />
              )}
              {ctl.has.health && (
                <ChipRow sheet label={S.health} value={yesNo(f.aOnly)} none="off" marked={orMark("aOnly") && ((v) => v === "on")} onPick={(v) => ctl.set({ aOnly: v === "on" })} options={[
                  { value: "on", label: L.aOnly, n: ctl.healthA, tone: "up", title: t.cands.helpHealth },
                ]} />
              )}
              <ChipRow label={L.scope} value={yesNo(f.heldOnly)} none="off" onPick={(v) => ctl.set({ heldOnly: v === "on" })} options={[
                { value: "on", label: L.heldOnly },
              ]} />
              {ctl.strategies.length > 0 && (
                <ChipRow label={L.strategy} value={f.strategy} none="all" marked={orMark("strategy")} onPick={(v) => ctl.set({ strategy: v })} options={[
                  ...ctl.strategies.map((s) => ({ value: s, label: term(lang, s) })),
                ]} />
              )}
              {/* 경기순환/방어 × 내수/글로벌 (업종 + SEC 10-K 미국 매출 비중, 표시 전용) — 데이터가 있을 때만 */}
              {ctl.hasStyle && (
                <>
                  <ChipRow<Filters["cycle"]> label={t.style.filterCycle} value={f.cycle} none="all" onPick={(v) => ctl.set({ cycle: v })} options={[
                    ...(["cyclical", "defensive"] as const).map((c) => ({
                      value: c, label: t.style.cycleShort[c], n: ctl.cycles[c], title: `${t.style.cycle[c]} — ${t.style.cycleBasis}`,
                    })),
                  ]} />
                  <ChipRow<Filters["region"]> label={t.style.filterRegion} value={f.region} none="all" onPick={(v) => ctl.set({ region: v })} options={[
                    ...(["domestic", "global"] as const).map((r) => ({
                      value: r, label: t.style.region[r], n: ctl.regions[r], title: t.style.basisSec("70%", null),
                    })),
                  ]} />
                </>
              )}
              {/* 52주 신고가 · 신저가 (오늘 탭 '시장 한눈에' 숫자와 같은 표시, 차트 가격) — 표시가 있을 때만 */}
              {ctl.hasHighLow && (
                <ChipRow<Filters["hl52"]> label={L.hl52} value={f.hl52} none="all" marked={orMark("hl52")} onPick={(v) => ctl.set({ hl52: v })} options={[
                  { value: "high", label: `▲ ${L.hl52High}`, tone: "up", n: ctl.highLows.high, title: `${L.hl52Help.high}\n${L.hl52Basis}` },
                  { value: "low", label: `▼ ${L.hl52Low}`, tone: "down", n: ctl.highLows.low, title: `${L.hl52Help.low}\n${L.hl52Basis}` },
                ]} />
              )}
              {ctl.has.vol && (
                <ChipRow<Filters["vol"]> label={S.vol} value={f.vol} none="all" marked={orMark("vol")} onPick={(v) => ctl.set({ vol: v })} options={[
                  { value: "spike", label: S.volSpike, n: ctl.volN, title: S.volHelp },
                ]} />
              )}
              {/* 내부자 자료가 하나도 없는 목록(전체분석 캐나다 — ceo.ca 링크만)이면 숨긴다. 걸어 둔 채면 풀 수 있게 보인다 */}
              {(f.insider !== "all" || ctl.has.insider) && (
                <ChipRow wide label={L.insider} labelTitle={S.insiderSpan} value={f.insider} none="all" marked={orMark("insider")} onPick={(v) => ctl.set({ insider: v })} options={[
                  { value: "cluster", label: `▲ ${L.insCluster}`, tone: "up", n: ctl.insiders.cluster },
                  { value: "buy", label: `▲ ${L.insBuy}`, tone: "up", n: ctl.insiders.buy },
                  { value: "sell", label: `▼ ${L.insSell}`, tone: "down", n: ctl.insiders.sell },
                ]} />
              )}
              {/* 국회의원 거래 신고 90일 (하원 PTR) — 표시가 있는 종목이 없는 목록(캐나다 등)이면 숨긴다 */}
              {(f.congress !== "all" || ctl.rows.some((r) => r.info?.congress)) && (
                <ChipRow wide label={L.congress} value={f.congress} none="all" onPick={(v) => ctl.set({ congress: v })} options={[
                  { value: "buy", label: `▲ ${L.congBuy}`, tone: "up", n: ctl.congress.buy, title: L.congHelp },
                  { value: "sell", label: `▼ ${L.congSell}`, tone: "down", n: ctl.congress.sell, title: L.congHelp },
                  { value: "leader", label: L.congLeader, n: ctl.congress.leader, title: L.congLeaderHelp },
                ]} />
              )}
            </div>
          </section>

          {/* ② 차트 신호 · 패턴 — 줄마다 이름 뒤에 그 줄이 보는 봉 */}
          <section className="adv-sec adv-sec--signals" aria-labelledby={`${bodyId}-s2`}>
            <SecHead n={2} id={`${bodyId}-s2`} title={S.sec.signals} hint={S.secHint.signals} />
            <div className="adv-grid adv-grid--one">
              <ChipRow<CrossFilter> label={S.rowCross} value={f.cross} none="all" marked={orMark("cross")} onPick={(v) => ctl.set({ cross: v })}
                tf={<TfPick<PatternTf> label={S.tfAria(S.rowCross)} value={f.crossTf} onPick={(v) => ctl.set({ crossTf: v })}
                  options={PATTERN_TFS.map((p) => ({ value: p, label: L.patternTfShort[p], title: L.crossTfHelp }))} />}
                options={[
                  { value: "pt", label: S.crossPtShort, n: ctl.crosses.pt, title: `${L.crossPt} — ${crossFilterTitle(L, "pt", f.crossTf)}` },
                  { value: "golden_soon", label: `▲ ${L.crossGoldenSoon}`, tone: "up", n: ctl.crosses.golden_soon,
                    title: crossFilterTitle(L, "golden_soon", f.crossTf) },
                  { value: "golden", label: `▲ ${L.crossGolden}`, tone: "up", n: ctl.crosses.golden, title: crossFilterTitle(L, "golden", f.crossTf) },
                  { value: "dead_soon", label: `▼ ${L.crossDeadSoon}`, tone: "down", n: ctl.crosses.dead_soon,
                    title: crossFilterTitle(L, "dead_soon", f.crossTf) },
                  { value: "dead", label: `▼ ${L.crossDead}`, tone: "down", n: ctl.crosses.dead, title: crossFilterTitle(L, "dead", f.crossTf) },
                ]} />
              {/* SQZ 모멘텀 (TradingView Squeeze Momentum [LazyBear]) — 표시 전용. 상태 = 점(압축) · 방향 = 막대 */}
              {(ctl.has.sqz || f.sqz !== "all" || f.sqzDir !== "all") && (
                <>
                  <ChipRow<Filters["sqz"]> label={S.rowSqz} labelTitle={L.sqzNote} value={f.sqz} none="all" marked={orMark("sqz")} onPick={(v) => ctl.set({ sqz: v })}
                    tf={<TfPick<SqzPick> label={S.tfAria(S.rowSqz)} value={f.sqzTf} onPick={(v) => ctl.set({ sqzTf: v })}
                      options={SQZ_PICKS.map((p) => ({ value: p, label: p === "all" ? L.patternTfShort.all : L.sqzTf[p],
                        title: p === "all" ? L.sqzTfAllHelp : L.sqzNote }))} />}
                    options={[
                      ...SQZ_PHASES.map((p) => ({
                        value: p,
                        label: <>{p !== "off" && <span className={`sqz-dot sqz-dot--${p === "on" ? "black" : "gray"}`} aria-hidden="true" />} {S.sqzPhaseShort[p]}</>,
                        n: ctl.sqzPhases[p],
                        title: `${L.sqzPhaseHelp[p]}\n${L.sqzNote}`,
                      })),
                    ]} />
                  <ChipRow<Filters["sqzDir"]> label={S.rowSqzDir} value={f.sqzDir} none="all" marked={orMark("sqzDir")} onPick={(v) => ctl.set({ sqzDir: v })} options={[
                    ...SQZ_DIRS.map((d) => ({
                      value: d,
                      label: <><span className={`sqz-bar sqz-bar--${d}`} aria-hidden="true" /> {sqzUp(d) ? "▲" : "▼"} {S.sqzDirShort[d]}</>,
                      tone: sqzUp(d) ? ("up" as const) : ("down" as const),
                      n: ctl.sqzDirs[d],
                      title: `${L.sqzDirHelp[d]}\n${L.sqzNote}`,
                    })),
                  ]} />
                </>
              )}
              <ChipRow label={S.rowPattern} value={f.pattern} none="all" marked={orMark("pattern")} onPick={(v) => ctl.set({ pattern: v })}
                tf={<TfPick<PatternTf> label={S.tfAria(S.rowPattern)} value={f.patternTf} onPick={(v) => ctl.set({ patternTf: v })}
                  options={PATTERN_TFS.map((p) => ({ value: p, label: L.patternTfShort[p], title: L.patternTfHelp }))} />}
                more={patternsHidden > 0 || patAll ? (
                  <button type="button" className="pill pill--more" aria-expanded={patAll} onClick={() => setPatAll((v) => !v)}>
                    {patAll ? S.patLess : S.patMore(patternsHidden)}
                  </button>
                ) : null}
                options={[
                  ...shownPatterns.map(([p, n]) => ({ value: p, label: <PatternName name={p} tf={patTf} />, n, tone: patternTrend(p) })),
                  // 지금 고른 패턴이 다른 필터 때문에 0개가 돼도 버튼은 남겨 둔다 (끌 수 있게)
                  ...(f.pattern !== "all" && !ctl.patterns.some(([p]) => p === f.pattern)
                    ? [{ value: f.pattern, label: <PatternName name={f.pattern} tf={patTf} />, n: 0, tone: patternTrend(f.pattern) }]
                    : []),
                ]} />
            </div>
          </section>
          {/* ③ 정렬 — 세 줄 (위 막대의 고르기 상자와 같은 상태) */}
          <section className="adv-sec adv-sec--sort" aria-labelledby={`${bodyId}-s3`}>
            <SecHead n={3} id={`${bodyId}-s3`} title={S.sec.sort}>
              <div className="tseg tseg--mini" role="group" aria-label={L.dirLabel}>
                {(["desc", "asc"] as const).map((d) => (
                  <button key={d} type="button" aria-pressed={ctl.sort !== "default" && ctl.dir === d} disabled={ctl.sort === "default"}
                    onClick={() => ctl.setDir(d)}>
                    {L.dir[d]}
                  </button>
                ))}
              </div>
            </SecHead>
            <SortRows ctl={ctl} />
          </section>
          {/* ④ 차트 보기 — 봉 · 크기 · 캡처/실시간 · 지표 */}
          <section className="adv-sec adv-sec--view" aria-labelledby={`${bodyId}-s4`}>
            <SecHead n={4} id={`${bodyId}-s4`} title={S.sec.view} />
            <div className="ctl-view" role="group" aria-label={t.charts.controls}>
              <ViewGroups ctl={ctl} />
            </div>
          </section>
        </div>
        {/* 꼬리 — 몇 개 일치 · 초기화 · 내 조합 저장 · n개 보기 (폰 시트는 바닥에 붙는다) */}
        <div className="adv-foot">
          <p className="adv-foot__match">
            <span className="adv-foot__dot" aria-hidden="true" />
            {match[0]}<b className="num">{match[1]}</b>{match[2]}
            <span className="adv-foot__note">{S.footInstant}</span>
          </p>
          <div className="adv-foot__acts">
            {dirty && (
              <button type="button" className="btn btn--small adv-foot__reset" onClick={ctl.reset}>{L.reset}</button>
            )}
            <button type="button" className="btn btn--small" onClick={save} disabled={!dirty || ctl.mineHas || ctl.mineFull}
              title={ctl.mineFull ? S.mineFull : S.mineHelp}>
              <BookmarkIcon /> {saved || ctl.mineHas ? S.mineSaved : S.mineSave}
            </button>
            <button type="button" className="btn btn--primary adv-foot__show" onClick={() => {
              close();
              onShow?.();
            }}>
              {S.footShow(ctl.shown.length)}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** 고급 필터 칸 머리 — 번호 · 제목 · 짧은 설명 · 오른쪽 버튼(정렬 방향). */
function SecHead({ n, id, title, hint, children }: { n: number; id: string; title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="adv-sec__head">
      <span className="adv-sec__n num" aria-hidden="true">{n}</span>
      <h3 id={id} className="adv-sec__title">{title}</h3>
      {hint && <span className="adv-sec__hint">{hint}</span>}
      {children && <div className="adv-sec__side">{children}</div>}
    </div>
  );
}

/**
 * 정렬 22가지를 네 줄로 (기본 · 수급 / 차트 라벨 / SQZ / 가격 · 기업). 고른 것은 칠하고 방향 화살표, 한 번 더 누르면 뒤집힌다.
 * 차트 라벨 줄은 머리에 봉 고르기 (2026-11-12 — 예전엔 라벨 · SQZ 한 줄이고 봉은 늘 일·주 중 더 최근 것).
 */
const SORT_LINES: { key: "basic" | "isb" | "sqz" | "price"; groups: SortGroup[] }[] = [
  { key: "basic", groups: ["basic", "flow"] },
  { key: "isb", groups: ["isb"] },
  { key: "sqz", groups: ["sqz"] },
  { key: "price", groups: ["price", "company"] },
];

function SortRows({ ctl }: { ctl: StockListCtl }) {
  const { t } = useT();
  const L = t.list;
  const tf = sqzSortTf(ctl.filters.sqzTf);
  const plain = ctl.sort === "default"; // 기본 순서는 방향이 없다
  const groups = new Map(SORT_GROUPS);
  return (
    <div className="adv-grid adv-grid--one" role="group" aria-label={L.sort}>
      {SORT_LINES.map((line) => (
        <div key={line.key} className="adv-row" role="group" aria-label={t.scr.sortRow[line.key]}>
          <span className="adv-row__label">{t.scr.sortRow[line.key]}</span>
          <div className="adv-row__body">
            {line.key === "isb" && <IsbTfPick ctl={ctl} />}
            {line.groups.flatMap((g) => groups.get(g) ?? []).map((k) => {
              const on = ctl.sort === k;
              const isb = isbSortLabel(k);
              const sqz = isSqzSort(k) ? (k as "sqz_run" | "sqz_mom" | "sqz_fade") : null;
              const title = isb
                ? `${L.isbHelp[isb]}\n${L.isbNote}`
                : sqz
                  ? `${L.sqzSortHelp[sqz]} (${L.sqzTfLong[tf]})\n${L.sqzNote}`
                  : on && !plain ? L.dirAria : undefined;
              return (
                <button key={k} type="button" className="pill" aria-pressed={on} title={title} onClick={() => ctl.pickSort(k)}
                  data-tone={isb ? (ISB_UP[isb] ? "up" : "down") : undefined}>
                  {sqz ? `SQZ ${L.sortShort[sqz]}` : L.sorts[k]}
                  {on && !plain && <span className="sortx__arrow" aria-hidden="true">{ctl.dir === "desc" ? "↓" : "↑"}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 고급 필터 한 줄 (2026-11-10 2차) — 이름(왼쪽) + [봉 고르기] + 떨어진 알약들. 알약이 많으면 이름 오른쪽에서 줄바꿈.
 * wide = 두 칸 다 차지 · sheet = 폰 시트에서만 (넓은 화면은 위 막대에 있는 시장 · 시총 · 헬스).
 * 오름 쪽은 초록 테두리 · 내림 쪽은 빨강 테두리, 고르면 그 색으로 칠한다. 0개인 버튼은 흐리게 (고른 채면 끌 수 있게 그대로).
 */
function ChipRow<T extends string>({ label, labelTitle, value, none, options, onPick, tf, more, marked, wide = false, sheet = false }: {
  label: string;
  labelTitle?: string;
  value: T;
  /** 아무것도 안 고른 값 ('all' · 'off') — 고른 알약을 한 번 더 누르면 이 값으로 ('전체' 알약 없이, 촘촘하게) */
  none: T;
  options: ChipOpt<T>[];
  onPick: (v: T) => void;
  tf?: React.ReactNode;
  /** 줄 끝에 붙는 것 (패턴 '+n개 더') */
  more?: React.ReactNode;
  /** 빠른 보기 '하나라도' 묶음이 서는 값 — 점선 버튼으로 (칸에 걸린 것과 따로) */
  marked?: (v: string) => boolean;
  wide?: boolean;
  sheet?: boolean;
}) {
  return (
    <div className={`adv-row${wide ? " adv-row--wide" : ""}${sheet ? " adv-row--sheet" : ""}`} role="group" aria-label={label}>
      <span className="adv-row__label" title={labelTitle}>{label}</span>
      <div className="adv-row__body">
        {tf}
        {options.map((o) => (
          <button key={o.value} type="button" className="pill" aria-pressed={value === o.value} data-tone={o.tone}
            data-zero={o.n === 0 && value !== o.value ? "" : undefined} data-or={marked?.(o.value) ? "" : undefined}
            onClick={() => onPick(value === o.value ? none : o.value)} title={o.title}>
            {o.label}
            {o.n != null && <span className="pill__n num">{o.n.toLocaleString()}</span>}
          </button>
        ))}
        {more}
      </div>
    </div>
  );
}

/** 보기 설정 — 보여 줄 봉 · 차트 크기 · 캡처/실시간 · 지표 (펼친 필터 맨 아래 칸). */
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

function BookmarkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinejoin="round">
      <path d="M6 3h12v18l-6-4.2L6 21z" />
    </svg>
  );
}

function XMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth="2.6" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function CloseIcon() {
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
