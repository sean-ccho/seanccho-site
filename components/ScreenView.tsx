"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GoldenPanel } from "./GoldenPanel";
import { useT } from "./LangProvider";
import { PanelHint } from "./PanelHint";
import { SqueezePanel } from "./SqueezePanel";
import { StockControls, useStockList, ViewBar } from "./StockControls";
import { SqzBadge } from "./StockChips";
import { StockPanel } from "./StockPanel";
import type { GoldenList, ScreenRow } from "@/lib/dashboard";
import { bigUsd, fmtDate, fmtDateTime, gradeTone, num, pct, tone } from "@/lib/format";
import { term, type Dict, type Lang } from "@/lib/i18n";
import {
  crossMarks,
  ISB_UP,
  isbLatest,
  isbSortLabel,
  isSqzSort,
  sqzFadeWarn,
  sqzFading,
  sqzInUse,
  sqzPhase,
  sqzSortTf,
  sqzState,
  sqzUp,
  type ListRow,
  type SortKey,
  type SqzPick,
} from "@/lib/stockList";
import type { Dashboard, SqzTf, TickerInfo } from "@/lib/types";

export type ScreenPage = "candidates" | "charts" | "all" | "universe";
type View = "deck" | "stack";
const VIEWS: View[] = ["deck", "stack"];

function anchorId(ticker: string): string {
  return `c-${ticker.replace(/[^A-Za-z0-9]/g, "-")}`;
}

function earningsSoon(info: TickerInfo | null): boolean {
  return info?.days_to_earnings != null && info.days_to_earnings >= 0 && info.days_to_earnings <= 14;
}

/** 목록 오른쪽 아래 숫자 — 지금 정렬 기준 값 (기본·적합도 정렬이면 20일 수익률). */
function sortFigure(info: TickerInfo | null, key: SortKey, t: Dict, lang: Lang, sqzTf: SqzTf): { text: string; cls?: string } {
  if (!info) return { text: "—" };
  if (isSqzSort(key)) {
    const s = sqzState(info, sqzTf);
    if (!s) return { text: "—" };
    const tf = t.list.sqzTf[sqzTf];
    if (key === "sqz_mom") return { text: s.val_pct != null ? pct(s.val_pct / 100) : "—", cls: tone(s.val_pct) };
    if (key === "sqz_fade") {
      if (!sqzFading(s.color) || s.color_run == null) return { text: `${tf} —` };
      return { text: `${tf} ${t.list.sqzBars(s.color_run)}${sqzFadeWarn(s) ? " ⚠" : ""}` };
    }
    const p = sqzPhase(s);
    if (p === "on") return { text: `${tf} ${t.list.sqzRunNow(s.run)}` };
    if (p === "fire" && s.fire) return { text: `${tf} ${t.list.sqzFiredAfter(s.fire.run)}`, cls: sqzUp(s.fire.color) ? "up" : "down" };
    return { text: `${tf} —` };
  }
  const isb = isbSortLabel(key);
  if (isb) {
    const m = isbLatest(info, isb);
    const [, mo, d] = m ? m.date.split("-").map(Number) : [];
    return m ? { text: `${t.list.isbTf[m.tf]} ${mo}/${d}`, cls: ISB_UP[isb] ? "up" : "down" } : { text: "—" };
  }
  switch (key) {
    case "health":
      return { text: info.health ? `${info.health.score} · ${info.health.grade}` : "—" };
    case "volume":
      return { text: info.vol_ratio != null ? `${num(info.vol_ratio, 1)}×` : "—" };
    case "insider":
      return { text: info.insider?.signal ? bigUsd(info.insider.net_value) : "—" };
    case "golden":
      return { text: info.golden ? `#${info.golden.rank + 1}` : "—" };
    case "rsi":
      return { text: info.rsi?.toFixed(0) ?? "—" };
    case "ret5":
      return { text: pct(info.ret_5d), cls: tone(info.ret_5d) };
    case "pos52":
      return { text: pct(info.position_52w, 0, false) };
    case "revenue":
      return { text: pct(info.fundamentals?.revenue_growth), cls: tone(info.fundamentals?.revenue_growth) };
    case "earnings":
      return { text: info.earnings_date ? fmtDate(info.earnings_date, lang) : t.common.tbd };
    case "marketcap":
      return { text: bigUsd(info.fundamentals?.market_cap) };
    default:
      return { text: pct(info.ret_20d), cls: tone(info.ret_20d) };
  }
}

/** 목록 한 줄 — 순위 · 티커·회사 · 전략·헬스·표시 · 적합도. */
function DeckItem({ row, rank, active, sort, sqzPick, sqzAlways, onPick }: {
  row: ListRow;
  rank: number;
  active: boolean;
  sort: SortKey;
  sqzPick: SqzPick;
  sqzAlways: boolean;
  onPick: () => void;
}) {
  const { lang, t } = useT();
  const info = row.info;
  const marks = crossMarks(info);
  const sec = (info?.sec_flags ?? []).find((x) => x.severity !== "yellow"); // 가장 심한 것 하나만
  const fig = sortFigure(info, sort, t, lang, sqzSortTf(sqzPick));
  return (
    <button type="button" className="deck-item" aria-pressed={active} data-ticker={row.ticker} onClick={onPick}>
      <span className="deck-item__rank num">{rank}</span>
      <span className="deck-item__main">
        <span className="deck-item__line">
          <span className="tick">{row.ticker}</span>
          <span className="deck-item__name">{info?.company ?? ""}</span>
        </span>
        <span className="deck-item__badges">
          {info?.strategy && <span className="deck-item__strat">{term(lang, info.strategy)}</span>}
          {info?.health && (
            <span className={`badge badge--${gradeTone(info.health.grade)}`}>
              {info.health.score} · {info.health.grade}
            </span>
          )}
          {marks.some((m) => m.kind.startsWith("golden")) && <span className="badge badge--good">▲ {t.list.crossGolden}</span>}
          {marks.some((m) => m.kind.startsWith("dead")) && <span className="badge badge--bad">▼ {t.list.crossDead}</span>}
          <SqzBadge info={info} pick={sqzPick} always={sqzAlways} />
          {/* 내부자 (시트 '내부자(90일)' 칸과 같은 세 가지) */}
          {info?.insider?.signal && (
            <span className={`badge ${info.insider.signal === "sell" ? "badge--bad" : "badge--good"}`}>
              {info.insider.signal === "cluster_buy" ? t.insider.cluster_buy : info.insider.signal === "buy" ? t.insider.listBuy : t.insider.listSell}
            </span>
          )}
          {earningsSoon(info) && <span className="badge badge--warn">{t.common.earningsSoon}</span>}
          {sec && (
            <span className={`badge ${sec.severity === "red" ? "badge--bad" : "badge--warn"}`} title={t.sec.title}>
              {sec.severity === "red" ? "🔴" : "🟠"} {t.sec.codes[sec.code] ?? sec.label}
            </span>
          )}
          {info?.squeeze && (
            <span className={`badge ${info.squeeze === "fire" ? "badge--bad" : "badge--warn"}`}>
              {info.squeeze === "fire" ? t.squeeze.badgeFire : t.squeeze.badgeFuel}
            </span>
          )}
          {row.held && <span className="badge badge--held">{t.common.held}</span>}
          {!info && <span className="tiny muted">{t.screen.noInfo}</span>}
        </span>
      </span>
      <span className="deck-item__fig">
        <span className="num gold deck-item__score">☆ {info?.score?.toFixed(1) ?? "—"}</span>
        <span className={`num deck-item__sub${fig.cls ? ` ${fig.cls}` : ""}`}>{fig.text}</span>
      </span>
    </button>
  );
}

/** 맨 아래 읽는 법 세 칸. */
function ScreenHelp() {
  const { t } = useT();
  const items = [
    { title: t.common.score, body: t.cands.helpScore, icon: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /> },
    { title: t.common.health, body: t.cands.helpHealth, icon: <path d="M3 12h4l2-5 4 10 2-5h6" /> },
    { title: t.cands.warnTitle, body: t.cands.helpWarn, icon: <path d="M12 4l9 16H3zM12 10v4M12 17.5v.5" /> },
  ];
  return (
    <section className="help-row" aria-label={t.cands.howTo}>
      {items.map((it) => (
        <div key={it.title} className="card help-card">
          <h2>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              {it.icon}
            </svg>
            {it.title}
          </h2>
          <p>{it.body}</p>
        </div>
      ))}
    </section>
  );
}

/**
 * 스크리너 후보 · 차트추천 · 전체차트 공통 화면.
 * '한 종목씩' = 왼쪽 목록 + 오른쪽 상세·멀티차트, '쭉 내려 보기' = 구글 시트 차트분석 탭처럼 종목마다 차트 (고른 방식은 페이지마다 기억).
 */
export function ScreenView({ page, rows, golden, squeeze, captured, notice, pageSize, listPageSize, heading, focus }: {
  page: ScreenPage;
  rows: ScreenRow[];
  golden: GoldenList[];
  squeeze?: Dashboard["squeeze"];
  captured: string | null;
  notice?: string | null;
  /** '쭉 내려 보기'에서 처음엔 이만큼만 그리고 '더 보기'로 늘린다 (전체차트 — 종목이 수백 개). */
  pageSize?: number;
  /** '한 종목씩' 왼쪽 목록·바로가기도 이만큼씩 (전체분석 — 종목이 수천 개라 다 그리면 느리다). */
  listPageSize?: number;
  /** 제목·설명을 페이지 기본값 대신 (전체분석 — 시장마다 다르다). */
  heading?: { title: string; sub: string };
  /** 처음 고를 종목 (전체분석 ?t=). 주소 끝 #c-티커 가 있으면 그쪽이 먼저 (안에서 다른 종목을 고른 뒤 새로고침). */
  focus?: string | null;
}) {
  const { lang, t } = useT();
  const S = t.screen;
  const viewKey = `screen:view:${page}`;

  const listRows = useMemo<ListRow[]>(
    () => rows.map((r, i) => ({ ticker: r.ticker, held: r.held, market: r.market, info: r.info, order: i })),
    [rows],
  );
  const byTicker = useMemo(() => new Map(rows.map((r) => [r.ticker, r])), [rows]);
  const tickers = useMemo(() => rows.map((r) => r.ticker), [rows]);
  const ctl = useStockList(listRows);
  const shown = ctl.shown;

  const [view, setView] = useState<View>("deck");
  // focus(전체분석 ?t=)가 있으면 처음부터 그 종목 — 첫 종목을 잠깐 그렸다가(차트까지 불러오며) 바꾸지 않게
  const [sel, setSel] = useState(() => (focus && rows.some((r) => r.ticker === focus) ? focus : rows[0]?.ticker ?? ""));
  const [jumpTo, setJumpTo] = useState<string | null>(null);
  // '더 보기' 개수 — 필터·정렬이 바뀌면(목록이 새로 만들어지면) 처음 한 쪽으로
  const step = pageSize ?? Number.POSITIVE_INFINITY;
  const [more, setMore] = useState<{ of: ListRow[]; n: number }>({ of: shown, n: step });
  const limit = more.of === shown ? more.n : step;
  const listStep = listPageSize ?? Number.POSITIVE_INFINITY;
  const [listMore, setListMore] = useState<{ of: ListRow[]; n: number }>({ of: shown, n: listStep });
  const listLimit = listMore.of === shown ? listMore.n : listStep;
  const listRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLElement>(null);

  const cur = shown.find((r) => r.ticker === sel) ?? shown[0] ?? null;
  const curIdx = cur ? shown.indexOf(cur) : -1;
  const visible = view === "stack" ? shown.slice(0, limit) : [];
  // 고른 종목이 목록 끝 너머여도(바로가기·이전/다음) 거기까지는 그린다
  const deckRows = shown.slice(0, Math.max(listLimit, curIdx + 1));
  const jumpRows = shown.slice(0, listLimit);

  // 보기 방식은 이 브라우저에 페이지마다 기억 (서버 렌더는 '한 종목씩')
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(viewKey) as View | null;
      if (v && VIEWS.includes(v)) setView(v);
    } catch {
      // 저장이 막힌 브라우저 — '한 종목씩'
    }
  }, [viewKey]);
  const pickView = (v: View) => {
    setView(v);
    if (cur && curIdx > 0) setJumpTo(cur.ticker); // 보던 종목을 새 보기에서도 (맨 앞이면 그대로)
    try {
      window.localStorage.setItem(viewKey, v);
    } catch {
      // 기억만 못 할 뿐
    }
  };

  // 주소 끝 #c-티커 (또는 focus) 로 들어오면 그 종목부터
  useEffect(() => {
    const id = window.location.hash.slice(1) || (focus ? anchorId(focus) : "");
    const hit = id ? rows.find((r) => anchorId(r.ticker) === id) : undefined;
    if (hit) {
      setSel(hit.ticker);
      setJumpTo(hit.ticker);
    }
  }, [rows, focus]);

  // 고른 종목이 목록 칸 안에서 보이게 (페이지는 안 움직이고 목록 칸만)
  useEffect(() => {
    const box = listRef.current;
    if (!box || !cur) return;
    const el = box.querySelector<HTMLElement>(`[data-ticker="${CSS.escape(cur.ticker)}"]`);
    if (!el) return;
    if (el.offsetTop < box.scrollTop) box.scrollTop = el.offsetTop;
    else if (el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = el.offsetTop + el.offsetHeight - box.clientHeight;
    }
  }, [cur, view]);

  // 바로가기·차트 보기: 쭉 보기면 그 카드로 (아직 안 그렸으면 거기까지 늘린 다음), 한 종목씩이면 상세가 화면에 들어오게
  useEffect(() => {
    if (!jumpTo) return;
    if (view === "stack") {
      const i = shown.findIndex((r) => r.ticker === jumpTo);
      if (i >= limit) {
        setMore({ of: shown, n: i + 1 });
        return; // 다음 렌더에서 다시
      }
      document.getElementById(anchorId(jumpTo))?.scrollIntoView({ block: "start" });
    } else {
      const el = detailRef.current;
      const top = el?.getBoundingClientRect().top ?? 0;
      if (el && (top < 0 || top > window.innerHeight * 0.6)) el.scrollIntoView({ block: "start" });
    }
    setJumpTo(null);
  }, [jumpTo, view, shown, limit]);

  const remember = (ticker: string) => {
    try {
      window.history.replaceState(window.history.state, "", `#${anchorId(ticker)}`);
    } catch {
      // 주소만 못 바꿀 뿐
    }
  };
  /** 목록·바로가기·이전/다음에서 고르기. scroll=false 면 화면은 그대로 (키보드로 넘길 때). */
  const go = (ticker: string, scroll = true) => {
    setSel(ticker);
    remember(ticker);
    if (scroll) setJumpTo(ticker);
  };
  /** 골든크로스·숏스퀴즈 표의 '차트 보기' — 필터에 걸려 안 보이면 필터를 비우고. */
  const showChart = (ticker: string) => {
    if (!shown.some((r) => r.ticker === ticker)) ctl.reset();
    go(ticker);
  };
  const step1 = (d: 1 | -1) => {
    const next = shown[curIdx + d];
    if (next) go(next.ticker, false);
    return next;
  };
  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const next = step1(e.key === "ArrowDown" ? 1 : -1);
    if (next) listRef.current?.querySelector<HTMLElement>(`[data-ticker="${CSS.escape(next.ticker)}"]`)?.focus({ preventScroll: true });
  };

  const visibleGolden = golden.filter((g) => ctl.filters.market === "all" || g.market === ctl.filters.market);
  const title = heading?.title ?? (page === "candidates" ? t.cands.title : page === "charts" ? t.charts.title : t.charts.allTitle);
  const sub = heading?.sub ?? (page === "candidates" ? t.cands.sub : page === "charts" ? t.charts.sub : t.charts.allSub);
  const showMarket = ctl.filters.market === "all";
  const sqzOn = sqzInUse(ctl.filters, ctl.sort); // SQZ 필터·정렬을 쓰는 중이면 목록 배지를 모든 종목에

  return (
    <>
      <header className="screen-head">
        <div className="screen-head__main">
          <p className="eyebrow">{S.eyebrow[page]}</p>
          <div className="screen-head__title">
            <h1>{title}</h1>
            <span className="count-badge num">{S.countBadge(rows.length)}</span>
          </div>
          <p className="screen-head__sub">
            {sub}
            {captured ? t.charts.captured(fmtDateTime(captured, lang)) : ""}
          </p>
          {notice && <p className="small" style={{ margin: "6px 0 0", color: "var(--warn)" }}>{notice}</p>}
        </div>
        <div className="screen-head__side">
          <div className="tseg" role="group" aria-label={S.view}>
            {VIEWS.map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => pickView(v)}>
                {v === "deck" ? S.viewDeck : S.viewStack}
              </button>
            ))}
          </div>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="card empty">{t.charts.noneToday}</p>
      ) : (
        <>
          <SqueezePanel squeeze={squeeze} listed={tickers} onShowChart={showChart} />
          <GoldenPanel lists={visibleGolden} onShowChart={showChart} />
          <details className="card panel">
            <summary>
              <span className="panel__title">{t.charts.jump}</span>
              <span className="chip">
                <span className="num" style={{ fontWeight: 600 }}>{t.charts.jumpCount(shown.length)[0]}</span>
                {t.charts.jumpCount(shown.length)[1]}
              </span>
              <PanelHint />
            </summary>
            <p className="tiny muted" style={{ margin: "10px 0 0" }}>{S.jumpHint}</p>
            <nav className="jump" aria-label={t.charts.jump} style={{ marginTop: 8 }}>
              {jumpRows.map((r) => (
                <a key={r.ticker} href={`#${anchorId(r.ticker)}`} data-held={r.held}
                  aria-current={view === "deck" && cur?.ticker === r.ticker ? "true" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    go(r.ticker);
                  }}>
                  {r.ticker}
                </a>
              ))}
            </nav>
          </details>

          <StockControls ctl={ctl} idPrefix={page} />
          <ViewBar ctl={ctl} />

          {shown.length === 0 && <p className="card empty">{t.list.empty}</p>}

          {view === "deck" && shown.length > 0 && (
            <div className="deck">
              <section className="card deck-list" aria-label={t.cands.list}>
                <div className="deck-list__head">
                  <span>{S.listHead}</span>
                  <span>{ctl.sort === "default" ? t.list.colScore : t.list.sorts[ctl.sort]}</span>
                </div>
                <div className="deck-list__body" ref={listRef} onKeyDown={onListKey}>
                  {deckRows.map((r) => (
                    <DeckItem key={r.ticker} row={r} rank={r.order + 1} active={cur?.ticker === r.ticker} sort={ctl.sort}
                      sqzPick={ctl.filters.sqzTf} sqzAlways={sqzOn} onPick={() => go(r.ticker)} />
                  ))}
                  {deckRows.length < shown.length && (
                    <button type="button" className="btn btn--small deck-list__more"
                      onClick={() => setListMore({ of: shown, n: deckRows.length + listStep })}>
                      {S.listMore(Math.min(listStep, shown.length - deckRows.length), shown.length - deckRows.length)}
                    </button>
                  )}
                </div>
                <div className="deck-list__foot">
                  <span className="num">{S.countBadge(shown.length)}</span>
                  <span className="deck-list__keys">{S.listKeys}</span>
                </div>
              </section>

              {cur && (
                <section className="card deck-detail" ref={detailRef} aria-labelledby={`${anchorId(cur.ticker)}-t`}>
                  <div className="deck-nav">
                    <button type="button" className="btn btn--small" disabled={curIdx <= 0} onClick={() => step1(-1)}>
                      {S.prev}
                    </button>
                    <span className="num tiny muted">{S.pos(curIdx + 1, shown.length)}</span>
                    <button type="button" className="btn btn--small" disabled={curIdx >= shown.length - 1} onClick={() => step1(1)}>
                      {S.next}
                    </button>
                  </div>
                  <StockPanel row={byTicker.get(cur.ticker)!} mode="deck" tfs={ctl.tfs} size={ctl.size} showMarket={showMarket}
                    detail={page === "universe"}
                    headingId={`${anchorId(cur.ticker)}-t`} />
                </section>
              )}
            </div>
          )}

          {view === "stack" &&
            visible.map((r) => (
              <section key={r.ticker} id={anchorId(r.ticker)} className="card chart-section" aria-labelledby={`${anchorId(r.ticker)}-t`}>
                <StockPanel row={byTicker.get(r.ticker)!} mode="stack" tfs={ctl.tfs} size={ctl.size} showMarket={showMarket}
                  detail={page === "universe"}
                  headingId={`${anchorId(r.ticker)}-t`} />
              </section>
            ))}

          {view === "stack" && visible.length < shown.length && (
            <div className="card more-row">
              <button type="button" className="btn btn--primary" onClick={() => setMore({ of: shown, n: limit + (pageSize ?? 30) })}>
                {t.charts.more(Math.min(pageSize ?? 30, shown.length - visible.length))}
              </button>
              <span className="small muted">{t.charts.showing(visible.length, shown.length)}</span>
            </div>
          )}
        </>
      )}

      <ScreenHelp />
    </>
  );
}
