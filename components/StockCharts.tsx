"use client";

import { useState } from "react";
import { BuyButton } from "./BuyDialog";
import { ChartModeSeg, StudyChips } from "./ChartModeBar";
import { useChartPrefs } from "./ChartPrefs";
import { ChartShot } from "./ChartShot";
import { useT } from "./LangProvider";
import { TvChart } from "./TvChart";
import { tvSymbol, tvUrl } from "@/lib/format";
import { TIMEFRAMES, type ChartImages, type TickerInfo, type Timeframe } from "@/lib/types";

/**
 * 종목 상세 — 봉 단위를 골라 차트 한 장을 크게 (화면 높이에 맞춰). 보던 봉으로 '매수'.
 * 캡처가 하나도 없는 종목(전체분석에만 있는 종목)은 늘 실시간 차트. '같이'면 캡처 | 실시간 나란히 (폰은 위아래).
 */
export function StockCharts({ ticker, images, info = null }: { ticker: string; images: ChartImages | undefined; info?: TickerInfo | null }) {
  const { lang, t } = useT();
  const { mode, studies } = useChartPrefs();
  const hasShots = TIMEFRAMES.some((k) => images?.[k]);
  const live = mode === "live" || !hasShots;
  const both = mode === "both" && hasShots;
  const [tf, setTf] = useState<Timeframe>(images?.Daily || !hasShots ? "Daily" : (TIMEFRAMES.find((k) => images?.[k]) ?? "Daily"));
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
        <span className="viewer-head__tools">
          {hasShots && <ChartModeSeg />}
          <StudyChips live={live || both} />
          <a className="link-strong" href={tvUrl(ticker, info?.tv)} target="_blank" rel="noopener noreferrer">
            {t.common.tvOpen}
          </a>
          <BuyButton ticker={ticker} info={info} tf={tf} />
        </span>
      </div>
      {both ? (
        <div className="stock-chart-pair">
          <figure className="stock-chart" data-live={false}>
            <ChartShot src={images?.[tf]} alt={t.common.chartAlt(ticker, t.common.tf[tf])} />
          </figure>
          <figure className="stock-chart" data-live={true}>
            <TvChart symbol={tvSymbol(ticker, info?.tv)} tf={tf} studies={studies} lang={lang} label={t.common.liveAlt(ticker, t.common.tf[tf])} />
          </figure>
        </div>
      ) : (
        <figure className="stock-chart" data-live={live} style={{ margin: "10px 0 0" }}>
          {live ? (
            <TvChart symbol={tvSymbol(ticker, info?.tv)} tf={tf} studies={studies} lang={lang} label={t.common.liveAlt(ticker, t.common.tf[tf])} />
          ) : (
            <ChartShot src={images?.[tf]} alt={t.common.chartAlt(ticker, t.common.tf[tf])} />
          )}
        </figure>
      )}
    </>
  );
}
