"use client";

import { useState } from "react";
import { BuyButton } from "./BuyDialog";
import { useChartPrefs } from "./ChartPrefs";
import { useT } from "./LangProvider";
import type { ChartSize } from "./StockControls";
import { TvChart } from "./TvChart";
import { tvSymbol } from "@/lib/format";
import type { ChartImages, TickerInfo, Timeframe } from "@/lib/types";

/** 봉 짧은 이름 (차트 칸 머리 태그). */
export const TF_CODE: Record<Timeframe, string> = { "1H": "1H", "4H": "4H", Daily: "1D", Weekly: "1W", Monthly: "1M" };

/** 크게(바깥 화살표) · 작게(안쪽 화살표). */
export function ExpandIcon({ shrink = false }: { shrink?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      {shrink ? (
        <path d="M20 4l-6 6M14 5v5h5M4 20l6-6M10 19v-5H5" />
      ) : (
        <path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" />
      )}
    </svg>
  );
}

/**
 * 고른 봉들의 차트를 나란히 — 캡처는 누르면 한 장을 크게, 다시 누르면 작게. 봉마다 '매수' (그 봉을 보고 샀다고 메모).
 * 차트 모드가 '실시간'이면 캡처 대신 TradingView 위젯 (그 종목·그 봉으로 열리고, 지표·그리기는 직접).
 */
export function ChartGrid({ ticker, images, tfs, info = null, size = "auto" }: {
  ticker: string;
  images: ChartImages | undefined;
  tfs: Timeframe[];
  info?: TickerInfo | null;
  size?: ChartSize;
}) {
  const { lang, t } = useT();
  const { mode, studies } = useChartPrefs();
  const live = mode === "live";
  const [big, setBig] = useState<Timeframe | null>(null);
  return (
    <div className="chart-grid" data-size={size} data-live={live}>
      {tfs.map((k) => {
        const isBig = big === k;
        const src = images?.[k];
        const tf = t.common.tf[k];
        const toggle = () => setBig(isBig ? null : k);
        return (
          <figure key={k} className="chart-card" data-big={isBig}>
            <figcaption className="chart-card__head">
              <span className="tf-tag">{TF_CODE[k]}</span>
              <span>{tf}</span>
              <span className="chart-card__tools">
                <BuyButton ticker={ticker} info={info} tf={k} compact />
                {(src || live) && (
                  <button type="button" className="icon-btn" onClick={toggle} aria-label={t.charts.bigAria(ticker, tf, isBig)}
                    title={isBig ? t.screen.shrink : t.screen.expand}>
                    <ExpandIcon shrink={isBig} />
                  </button>
                )}
              </span>
            </figcaption>
            {live ? (
              <TvChart symbol={tvSymbol(ticker, info?.tv)} tf={k} studies={studies} lang={lang}
                label={t.common.liveAlt(ticker, tf)} />
            ) : src ? (
              // 키보드는 머리의 화살표 버튼으로 (같은 버튼이 두 번 잡히지 않게)
              <button type="button" className="shot" data-big={isBig} onClick={toggle} tabIndex={-1}
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
