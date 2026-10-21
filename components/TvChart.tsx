"use client";

import { useEffect, useRef, useState } from "react";
import type { Study } from "./ChartPrefs";
import type { Lang } from "@/lib/i18n";
import type { Timeframe } from "@/lib/types";

/** TradingView 공식 무료 임베드 'Advanced Chart' — 로그인 없는 공개 위젯이라 저장한 레이아웃·커뮤니티 지표는 못 불러온다. */
const SCRIPT_SRC = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

export const TV_INTERVAL: Record<Timeframe, string> = { "1H": "60", "4H": "240", Daily: "D", Weekly: "W", Monthly: "M" };

type WidgetStudy = { id: string; inputs?: Record<string, string | number> };

/**
 * 지표 칩 → 위젯 studies (거래량은 hide_volume 으로). EMA 10·20·100·200 = Project_1 캡처 레이아웃과 같은 선.
 * 무료 위젯은 지표를 5개까지만 그리고, {id} 객체 뒤에 문자열 id 가 오면 그 뒤를 버린다 (10-20 확인) —
 * 그래서 EMA 넷을 내장 'MA Ribbon' 하나에 담고(in_1·6·11·16 = 종류, in_3·8·13·18 = 기간, 선 색도 넷이 따로), 전부 객체로 쓴다.
 */
const STUDY_IDS: Record<Exclude<Study, "volume">, WidgetStudy> = {
  ema: {
    id: "STD;MA%Ribbon",
    inputs: { in_1: "EMA", in_3: 10, in_6: "EMA", in_8: 20, in_11: "EMA", in_13: 100, in_16: "EMA", in_18: 200 },
  },
  rsi: { id: "RSI@tv-basicstudies" },
  macd: { id: "MACD@tv-basicstudies" },
  bb: { id: "BB@tv-basicstudies" },
};

export function widgetConfig(symbol: string, tf: Timeframe, studies: Study[], lang: Lang): Record<string, unknown> {
  return {
    autosize: true,
    symbol,
    interval: TV_INTERVAL[tf],
    timezone: "America/Toronto",
    theme: "dark", // 퀀트 화면은 늘 어두운 터미널 색
    style: "1",
    locale: lang === "ko" ? "kr" : "en",
    backgroundColor: "rgba(11, 16, 25, 1)",
    gridColor: "rgba(255, 255, 255, 0.05)",
    withdateranges: true,
    hide_side_toolbar: false, // 그리기 도구
    allow_symbol_change: false, // 종목은 목록에서 고른 것을 따라간다
    hide_volume: !studies.includes("volume"),
    save_image: true,
    calendar: false,
    studies: studies.flatMap((s) => (s === "volume" ? [] : [STUDY_IDS[s]])),
    support_host: "https://www.tradingview.com",
  };
}

/**
 * 실시간 차트 한 장. 화면 근처에 올 때만 위젯을 띄운다 ('쭉 내려 보기'에서 iframe 수십 개가 한꺼번에 뜨지 않게).
 * 종목·봉·지표·언어가 바뀌면 새로 그린다 — 위젯 안에서 바꾼 것(그린 선·더한 지표)은 그때 초기화된다.
 */
export function TvChart({ symbol, tf, studies, lang, label }: {
  symbol: string;
  tf: Timeframe;
  studies: Study[];
  lang: Lang;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const config = JSON.stringify(widgetConfig(symbol, tf, studies, lang));

  useEffect(() => {
    const el = box.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setNear(true);
        io.disconnect();
      }
    }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    const el = box.current;
    if (!el || !near) return;
    el.replaceChildren();
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.type = "text/javascript";
    script.async = true;
    script.textContent = config;
    el.append(widget, script);
    return () => el.replaceChildren();
  }, [near, config]);

  return (
    <div className="tv-chart">
      {/* 높이는 바깥 칸에 — TradingView 스크립트가 안쪽 칸에 height:100% 를 직접 써 넣는다 */}
      <div className="tv-chart__frame">
        <div ref={box} className="tradingview-widget-container tv-chart__box" data-symbol={symbol} data-interval={TV_INTERVAL[tf]}
          role="region" aria-label={label} />
      </div>
      <a className="tv-chart__credit tiny muted" href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank">
        TradingView
      </a>
    </div>
  );
}
