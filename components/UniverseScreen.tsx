"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "./LangProvider";
import { ScreenView } from "./ScreenView";
import type { GoldenList, ScreenRow } from "@/lib/dashboard";
import { fmtDate } from "@/lib/format";
import { newer, overlayInfo, quoteOf, type LiveQuotes } from "@/lib/liveShared";
import type { ListPreset } from "@/lib/stockList";
import type { Dashboard, LiveMark, TickerInfo, UniverseKey, UniverseMarket, UniverseTab } from "@/lib/types";
import { fetchUniverse, OPTIONAL_KEYS, TAB_KEYS } from "@/lib/universe";

type Load = { status: "loading" } | { status: "error" } | { status: "ok"; data: UniverseMarket[] };

/**
 * 전체분석 한 탭 — 브라우저가 raw 에서 받아(수 MB, gzip) 보유·숏스퀴즈 상태를 합쳐 1차 선별과 같은 화면으로.
 * 전체 탭은 S&P 500·나스닥·NYSE 두 파일을 같이 받아 이어 붙인다 (아래 시장 버튼으로 다시 나눠 볼 수 있다).
 */
export function UniverseScreen({ market, held, squeeze, focus, preset, live }: {
  market: UniverseTab;
  held: string[];
  squeeze?: Dashboard["squeeze"];
  /** 처음 고를 종목 (다른 페이지 티커 링크의 ?t=). */
  focus?: string | null;
  /** 처음 걸어 둘 필터·정렬 (섹터 지도의 '전부 보기' — ?cycle=&region=&s=, 오늘 탭 52주 신고가 · 신저가 — ?hl=). */
  preset?: ListPreset;
  /** 장중 펄스 상태 (2026-11-09, 서버가 정함) — 있으면 브라우저가 quotes.json 을 받아 가격 · 등락 · 52주 · 신고가를 고친다. */
  live?: LiveMark | null;
}) {
  const { lang, t } = useT();
  const U = t.universe;
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [quotes, setQuotes] = useState<LiveQuotes | null>(null);

  // 장중 시세 — 새 펄스(stamp)마다 다시 받는다. 서버가 토큰으로 읽은 quotes.json (/api/live/quotes, 약 250KB) —
  // raw 에서 직접 받으면 GitHub CDN 5분 캐시로 새 펄스가 늦게 보였다 (11-10)
  const liveStamp = live?.stamp ?? null;
  const liveDay = live?.day ?? null;
  useEffect(() => {
    if (!liveStamp) {
      setQuotes(null);
      return;
    }
    let alive = true;
    fetch("/api/live/quotes", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<LiveQuotes>) : null))
      .then((q) => alive && setQuotes(q && q.day === liveDay ? q : null))
      .catch(() => alive && setQuotes(null));
    return () => {
      alive = false;
    };
  }, [liveStamp, liveDay]);

  useEffect(() => {
    let alive = true;
    setLoad({ status: "loading" });
    // 전체 탭의 번외처럼 없어도 되는 파일은 못 받으면 빼고 보여 준다 (그 탭 자체를 열었을 때만 실패로)
    const get = (k: UniverseKey) => (k !== market && OPTIONAL_KEYS.includes(k) ? fetchUniverse(k).catch(() => null) : fetchUniverse(k));
    Promise.all(TAB_KEYS[market].map(get))
      .then((got) => alive && setLoad({ status: "ok", data: got.filter((d): d is UniverseMarket => d != null) }))
      .catch(() => alive && setLoad({ status: "error" }));
    return () => {
      alive = false;
    };
  }, [market, attempt]);

  const data = load.status === "ok" ? load.data : null;
  const rows = useMemo<ScreenRow[]>(() => {
    if (!data) return [];
    const heldSet = new Set(held);
    const status = new Map((squeeze?.items ?? []).map((q) => [q.ticker, q.status]));
    return data.flatMap((d) => {
      // 장중(2026-11-09) — 그 목록의 밤 날짜보다 펄스가 새것이면 시세가 있는 종목은 장중 값, 없는 종목(소형주 등)은 '어제 마감'
      const liveOk = live && quotes && newer(live, d.bar_date) ? live : null;
      return Object.entries(d.items).map(([ticker, info]) => {
        let row: TickerInfo = { ...info, squeeze: status.get(ticker) ?? null };
        if (liveOk) {
          const q = quoteOf(quotes, ticker);
          row = q ? overlayInfo(row, q, null, liveOk) : { ...row, live_stale: true };
        }
        return { ticker, held: heldSet.has(ticker), market: info.market, info: row, images: undefined };
      });
    });
  }, [data, held, squeeze, quotes, live]);

  const golden = useMemo<GoldenList[]>(() => {
    if (!data) return [];
    // PT 골든크로스 표는 시장 단위만 — S&P 500 · 나스닥·NYSE · 캐나다 (신규 상장 · 번외는 목록 행의 골든 표시만)
    return data.filter((d) => d.key !== "new" && d.key !== "extra" && d.golden.length).map((d) => ({
      market: d.key,
      items: d.golden.map((g) => {
        const info = d.items[g.ticker];
        return { ticker: g.ticker, company: info?.company ?? null, timeframes: g.timeframes, score: info?.score ?? null,
          vol_ratio: info?.vol_ratio ?? null, listed: Boolean(info) };
      }),
    }));
  }, [data]);

  if (!data) {
    return (
      <section className="card empty" aria-live="polite">
        <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>{`${U.title} · ${U.tab[market]}`}</h1>
        <p style={{ margin: 0 }}>{load.status === "error" ? U.failed : U.loading}</p>
        {load.status === "error" && (
          <button type="button" className="btn btn--small" style={{ marginTop: 10 }} onClick={() => setAttempt((n) => n + 1)}>
            {U.retry}
          </button>
        )}
      </section>
    );
  }

  // 숫자 · 기준일은 두 시장 것 (번외는 '번외 N종목'만 덧붙인다 — 캐나다 상장은 휴장일이 달라 기준일이 하루 다를 수 있다)
  const core = market === "extra" ? data : data.filter((d) => d.key !== "extra");
  const sum = (k: keyof UniverseMarket["counts"]) => core.reduce((s, d) => s + (d.counts[k] ?? 0), 0);
  const counts = market === "new" || market === "extra" ? "" : U.counts(sum("listed"), sum("analyzed"), sum("young"), sum("no_data"));
  const extraN = market === "all" ? data.filter((d) => d.key === "extra").reduce((s, d) => s + Object.keys(d.items).length, 0) : 0;
  const barDate = core.map((d) => d.bar_date).filter((b): b is string => Boolean(b)).sort().at(-1);
  const asOf = barDate ? U.asOf(fmtDate(barDate, lang, true)) : "";
  const sub = [U.sub[market], counts, extraN ? U.extraCount(extraN) : "", asOf].filter(Boolean).join(" · ");
  // 숏스퀴즈 감시는 미국 종목(FINRA) 목록이라 캐나다 탭에선 뺀다
  return (
    <ScreenView page="universe" rows={rows} golden={golden} squeeze={market === "ca" ? undefined : squeeze}
      captured={null}
      heading={{ title: `${U.title} · ${U.tab[market]}`, sub }}
      notice={market === "new" ? null : market === "extra" ? U.noteExtra : market === "ca" ? U.noteCa : U.note}
      pageSize={30} listPageSize={200}
      focus={focus} preset={preset} />
  );
}
