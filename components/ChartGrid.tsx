"use client";

import { useState } from "react";
import { useT } from "./LangProvider";
import type { ChartImages, Timeframe } from "@/lib/types";

/** 고른 봉들의 TradingView 캡처를 나란히 — 누르면 한 장을 크게, 다시 누르면 작게. */
export function ChartGrid({ ticker, images, tfs }: { ticker: string; images: ChartImages | undefined; tfs: Timeframe[] }) {
  const { t } = useT();
  const [big, setBig] = useState<Timeframe | null>(null);
  return (
    <div className="chart-grid">
      {tfs.map((k) => {
        const isBig = big === k;
        const src = images?.[k];
        const tf = t.common.tf[k];
        return (
          <figure key={k} data-big={isBig}>
            <figcaption>
              <span>{tf}</span>
              {src && <span className="tiny muted" style={{ fontWeight: 500 }}>{isBig ? t.charts.tapSmall : t.charts.tapBig}</span>}
            </figcaption>
            {src ? (
              <button type="button" className="shot" data-big={isBig} onClick={() => setBig(isBig ? null : k)}
                aria-label={t.charts.bigAria(ticker, tf, isBig)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- GitHub raw 이미지를 그대로 쓴다 */}
                <img src={src} alt={t.common.chartAlt(ticker, tf)} loading="lazy" decoding="async" />
              </button>
            ) : (
              <div className="shot-missing">{t.charts.missing}</div>
            )}
          </figure>
        );
      })}
    </div>
  );
}
