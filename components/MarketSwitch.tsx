"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * 오늘 탭 미국 · 캐나다 전환 (2026-11-06) — '시장 한눈에'와 '실적 발표 일정'이 같은 선택을 따른다.
 * 서버가 두 시장을 다 그려 두고([data-show="us"|"ca"]), 이 감싸개의 data-mkt 로 한쪽만 보인다 (CSS — .mkt-pick).
 * 두 시장이 다 있는 칸만 [data-both] 를 달아서, 캐나다 파일이 없는 날 캐나다를 골라 둔 사람도 미국 칸이 숨지 않는다.
 * 마지막 선택은 이 브라우저에만 기억한다 (localStorage — 못 쓰면 늘 미국).
 */
export type TodayMarket = "us" | "ca";

const KEY = "sc.todayMarket";
const Ctx = createContext<{ mkt: TodayMarket; set: (m: TodayMarket) => void } | null>(null);

export function MarketPick({ children }: { children: ReactNode }) {
  const [mkt, setMkt] = useState<TodayMarket>("us");
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "ca") setMkt("ca");
    } catch {
      // 저장소를 못 쓰면 미국
    }
  }, []);
  const set = (m: TodayMarket) => {
    setMkt(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {
      // 기억만 못 할 뿐
    }
  };
  return (
    <Ctx.Provider value={{ mkt, set }}>
      <div className="mkt-pick" data-mkt={mkt}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function MarketSwitch({ labels, aria }: { labels: Record<TodayMarket, string>; aria: string }) {
  const c = useContext(Ctx);
  // 버튼은 Suspense 안에서 늦게 붙는다 — 그사이 감싸개가 기억한 '캐나다'로 바뀌어 있으면 서버 HTML(미국)과 달라지는데,
  // React 는 붙일 때 다른 속성을 고치지 않는다. 그래서 붙을 때는 서버와 같은 '미국'으로, 붙은 뒤 한 번 더 그린다.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!c) return null;
  const mkt: TodayMarket = ready ? c.mkt : "us";
  return (
    <div className="tseg mkt-switch" role="group" aria-label={aria}>
      {(["us", "ca"] as const).map((k) => (
        <button key={k} type="button" aria-pressed={mkt === k} onClick={() => c.set(k)}>
          {labels[k]}
        </button>
      ))}
    </div>
  );
}
