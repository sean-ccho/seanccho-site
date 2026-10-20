"use client";

import { createContext, useContext, useEffect, useState } from "react";

/** 차트 칸에 무엇을 — 'shot' = Project_1 이 찍은 TradingView 캡처, 'live' = TradingView 위젯(직접 조작). */
export type ChartMode = "shot" | "live";
/** 실시간 차트에 미리 켜 둘 지표 (위젯 안에서 더 넣거나 지울 수도 있지만, 종목을 바꾸면 이 설정으로 돌아간다). */
export type Study = "ema" | "volume" | "rsi" | "macd" | "bb";
export const STUDIES: Study[] = ["ema", "volume", "rsi", "macd", "bb"];
const DEFAULT_STUDIES: Study[] = ["ema", "volume"]; // 캡처 레이아웃과 같은 EMA 10·20·100·200 + 거래량

const MODE_KEY = "charts:mode";
const STUDY_KEY = "charts:studies";

type Prefs = {
  mode: ChartMode;
  /** 전체분석처럼 캡처가 없는 화면 — 늘 실시간, 전환 버튼을 숨긴다. */
  forced: boolean;
  setMode: (m: ChartMode) => void;
  studies: Study[];
  toggleStudy: (s: Study) => void;
};

const Ctx = createContext<Prefs | null>(null);

function read<T>(key: string, ok: (v: unknown) => v is T): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    const v: unknown = raw == null ? null : JSON.parse(raw);
    return ok(v) ? v : null;
  } catch {
    return null; // 저장이 막힌 브라우저 — 기본값
  }
}

function write(key: string, v: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // 기억만 못 할 뿐
  }
}

const isMode = (v: unknown): v is ChartMode => v === "shot" || v === "live";
const isStudies = (v: unknown): v is Study[] => Array.isArray(v) && v.every((s) => STUDIES.includes(s as Study));

/** 차트 모드·지표 — 이 브라우저에 기억, 퀀트 페이지 전체가 같이 쓴다 (서버 렌더는 캡처·기본 지표로 그리고 붙은 뒤 바꾼다). */
export function ChartPrefsProvider({ children, forceLive = false }: { children: React.ReactNode; forceLive?: boolean }) {
  const parent = useContext(Ctx);
  const [mode, setModeState] = useState<ChartMode>("shot");
  const [studies, setStudies] = useState<Study[]>(DEFAULT_STUDIES);

  useEffect(() => {
    if (parent) return; // 안쪽 공급자(전체분석)는 바깥 설정을 그대로 쓴다
    const m = read(MODE_KEY, isMode);
    if (m) setModeState(m);
    const s = read(STUDY_KEY, isStudies);
    if (s) setStudies(s);
  }, [parent]);

  if (parent && forceLive) {
    return <Ctx.Provider value={{ ...parent, mode: "live", forced: true }}>{children}</Ctx.Provider>;
  }

  const value: Prefs = {
    mode: forceLive ? "live" : mode,
    forced: forceLive,
    setMode: (m) => {
      setModeState(m);
      write(MODE_KEY, m);
    },
    studies,
    toggleStudy: (s) =>
      setStudies((cur) => {
        const next = cur.includes(s) ? cur.filter((x) => x !== s) : STUDIES.filter((x) => x === s || cur.includes(x));
        write(STUDY_KEY, next);
        return next;
      }),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const FALLBACK: Prefs = { mode: "shot", forced: false, setMode: () => {}, studies: DEFAULT_STUDIES, toggleStudy: () => {} };

export function useChartPrefs(): Prefs {
  return useContext(Ctx) ?? FALLBACK;
}
