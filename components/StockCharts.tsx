"use client";

import { useState } from "react";
import { ChartShot } from "./ChartShot";
import { useT } from "./LangProvider";
import { tvUrl } from "@/lib/format";
import { TIMEFRAMES, type ChartImages, type Timeframe } from "@/lib/types";

/** 종목 상세 — 봉 단위를 골라 TradingView 캡처 한 장을 크게. */
export function StockCharts({ ticker, images }: { ticker: string; images: ChartImages | undefined }) {
  const { t } = useT();
  const [tf, setTf] = useState<Timeframe>(images?.Daily ? "Daily" : (TIMEFRAMES.find((k) => images?.[k]) ?? "Daily"));
  return (
    <>
      <div className="viewer-head">
        <div className="seg" role="group" aria-label={t.common.tfGroup}>
          {TIMEFRAMES.map((k) => (
            <button key={k} type="button" aria-pressed={k === tf} onClick={() => setTf(k)}>
              {t.common.tf[k]}
            </button>
          ))}
        </div>
        <a className="link-strong" href={tvUrl(ticker)} target="_blank" rel="noopener noreferrer">
          {t.common.tvOpen}
        </a>
      </div>
      <figure style={{ margin: "10px 0 0" }}>
        <ChartShot src={images?.[tf]} alt={t.common.chartAlt(ticker, t.common.tf[tf])} />
      </figure>
    </>
  );
}
