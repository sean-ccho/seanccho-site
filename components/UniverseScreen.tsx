"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "./LangProvider";
import { ScreenView } from "./ScreenView";
import type { GoldenList, ScreenRow } from "@/lib/dashboard";
import { fmtDate } from "@/lib/format";
import type { Dashboard, UniverseKey, UniverseMarket } from "@/lib/types";
import { universeUrl } from "@/lib/universe";

type Load = { status: "loading" } | { status: "error" } | { status: "ok"; data: UniverseMarket };

/** 전체분석 한 시장 — 브라우저가 raw 에서 받아(수 MB, gzip) 보유·숏스퀴즈 상태를 합쳐 전체차트와 같은 화면으로. */
export function UniverseScreen({ market, held, squeeze, known }: {
  market: UniverseKey;
  held: string[];
  squeeze?: Dashboard["squeeze"];
  known: string[];
}) {
  const { lang, t } = useT();
  const U = t.universe;
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoad({ status: "loading" });
    fetch(universeUrl(market), { cache: "no-cache" })
      .then((r) => (r.ok ? (r.json() as Promise<UniverseMarket>) : Promise.reject(new Error(String(r.status)))))
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
    return Object.entries(data.items).map(([ticker, info]) => ({
      ticker,
      held: heldSet.has(ticker),
      market: info.market,
      info: { ...info, squeeze: status.get(ticker) ?? null },
      images: undefined,
    }));
  }, [data, held, squeeze]);

  const golden = useMemo<GoldenList[]>(() => {
    if (!data || !data.golden.length || market === "new") return [];
    return [{
      market,
      items: data.golden.map((g) => {
        const info = data.items[g.ticker];
        return { ticker: g.ticker, company: info?.company ?? null, timeframes: g.timeframes, score: info?.score ?? null,
          vol_ratio: info?.vol_ratio ?? null, listed: Boolean(info) };
      }),
    }];
  }, [data, market]);

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

  const c = data.counts;
  const counts = market === "new" ? "" : U.counts(c.listed, c.analyzed ?? 0, c.young ?? 0, c.no_data ?? 0);
  const asOf = data.bar_date ? U.asOf(fmtDate(data.bar_date, lang, true)) : "";
  return (
    <ScreenView page="universe" rows={rows} golden={golden} squeeze={squeeze}
      known={Array.from(new Set([...known, ...Object.keys(data.items)]))} captured={null}
      heading={{ title: `${U.title} · ${U.tab[market]}`, sub: [U.sub[market], counts, asOf].filter(Boolean).join(" · ") }}
      notice={market === "new" ? null : U.note} pageSize={30} listPageSize={200} />
  );
}
