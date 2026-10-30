"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "./LangProvider";
import { ScreenView } from "./ScreenView";
import type { GoldenList, ScreenRow } from "@/lib/dashboard";
import { fmtDate } from "@/lib/format";
import type { ListPreset } from "@/lib/stockList";
import type { Dashboard, UniverseMarket, UniverseTab } from "@/lib/types";
import { fetchUniverse, TAB_KEYS } from "@/lib/universe";

type Load = { status: "loading" } | { status: "error" } | { status: "ok"; data: UniverseMarket[] };

/**
 * 전체분석 한 탭 — 브라우저가 raw 에서 받아(수 MB, gzip) 보유·숏스퀴즈 상태를 합쳐 전체차트와 같은 화면으로.
 * 전체 탭은 S&P 500·나스닥·NYSE 두 파일을 같이 받아 이어 붙인다 (아래 시장 버튼으로 다시 나눠 볼 수 있다).
 */
export function UniverseScreen({ market, held, squeeze, focus, preset }: {
  market: UniverseTab;
  held: string[];
  squeeze?: Dashboard["squeeze"];
  /** 처음 고를 종목 (다른 페이지 티커 링크의 ?t=). */
  focus?: string | null;
  /** 처음 걸어 둘 필터·정렬 (섹터 지도의 '전부 보기' — ?cycle=&region=&s=). */
  preset?: ListPreset;
}) {
  const { lang, t } = useT();
  const U = t.universe;
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoad({ status: "loading" });
    Promise.all(TAB_KEYS[market].map(fetchUniverse))
      .then((data) => alive && setLoad({ status: "ok", data }))
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
    return data.flatMap((d) => Object.entries(d.items).map(([ticker, info]) => ({
      ticker,
      held: heldSet.has(ticker),
      market: info.market,
      info: { ...info, squeeze: status.get(ticker) ?? null },
      images: undefined,
    })));
  }, [data, held, squeeze]);

  const golden = useMemo<GoldenList[]>(() => {
    if (!data) return [];
    return data.filter((d) => d.key !== "new" && d.golden.length).map((d) => ({
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

  const sum = (k: keyof UniverseMarket["counts"]) => data.reduce((s, d) => s + (d.counts[k] ?? 0), 0);
  const counts = market === "new" ? "" : U.counts(sum("listed"), sum("analyzed"), sum("young"), sum("no_data"));
  const barDate = data.map((d) => d.bar_date).filter((b): b is string => Boolean(b)).sort().at(-1);
  const asOf = barDate ? U.asOf(fmtDate(barDate, lang, true)) : "";
  return (
    <ScreenView page="universe" rows={rows} golden={golden} squeeze={squeeze}
      captured={null}
      heading={{ title: `${U.title} · ${U.tab[market]}`, sub: [U.sub[market], counts, asOf].filter(Boolean).join(" · ") }}
      notice={market === "new" ? null : U.note} pageSize={30} listPageSize={200} focus={focus} preset={preset} />
  );
}
