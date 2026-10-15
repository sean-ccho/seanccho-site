import { readFile } from "node:fs/promises";
import type { ChartImages, Dashboard } from "./types";

// Project_1 의 CI 가 매일 덮어쓰는 파일. 이 리포와 Project_1 은 배포가 서로 엮이지 않는다.
export const DEFAULT_DASHBOARD_URL =
  "https://raw.githubusercontent.com/sean-ccho/Project_1/dashboard-data/dashboard.json";

/** dashboard.json 캐시 태그 — /api/revalidate 가 이 태그로 비운다. */
export const DASHBOARD_TAG = "dashboard";

/**
 * dashboard.json 을 읽는다. 못 읽으면 null (페이지는 '데이터 없음' 안내를 보여 준다).
 * DASHBOARD_FILE 이 있으면 로컬 파일, 아니면 DASHBOARD_URL(기본: GitHub raw)을 받는다.
 * 보통은 Project_1 CI 가 실행 끝에 /api/revalidate 를 불러 바로 새로 받고, 그게 실패해도 30분마다 새로 받는다.
 */
export async function getDashboard(): Promise<Dashboard | null> {
  try {
    const file = process.env.DASHBOARD_FILE;
    if (file) {
      return JSON.parse(await readFile(file, "utf8")) as Dashboard;
    }
    const res = await fetch(process.env.DASHBOARD_URL || DEFAULT_DASHBOARD_URL, {
      next: { revalidate: 1800, tags: [DASHBOARD_TAG] },
    });
    if (!res.ok) {
      console.error(`[dashboard] ${res.status} ${res.statusText}`);
      return null;
    }
    return (await res.json()) as Dashboard;
  } catch (err) {
    console.error("[dashboard] 읽기 실패", err);
    return null;
  }
}

/** 티커 → 차트 이미지 주소 (두 시장 합쳐서). */
export function chartIndex(data: Dashboard): Record<string, ChartImages> {
  const out: Record<string, ChartImages> = {};
  for (const market of data.charts) {
    for (const item of market.items) {
      if (!out[item.ticker]) out[item.ticker] = item.images;
    }
  }
  return out;
}

/** 가장 최근 차트 캡처 시각. */
export function latestCapture(data: Dashboard): string | null {
  const stamps = data.charts.map((m) => m.captured_at).filter((s): s is string => Boolean(s));
  return stamps.length ? stamps.sort().at(-1) ?? null : null;
}
