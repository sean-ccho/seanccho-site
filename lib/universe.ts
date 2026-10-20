import type { UniverseKey } from "./types";

/**
 * 전체분석 데이터 — Project_1 의 별도 워크플로(universe-scan.yml)가 매일 밤 universe-data 브랜치에 덮어쓴다.
 * 시장 목록({key}.json)은 수 MB 라 서버가 페이지에 담지 않고 브라우저가 raw 에서 직접 받는다 (gzip·CORS 됨).
 * 로컬 확인: NEXT_PUBLIC_UNIVERSE_BASE=http://localhost:8765 처럼 정적 서버를 가리킨다.
 * 브라우저·서버 공용 (서버 전용 읽기는 lib/universeServer.ts).
 */
export const UNIVERSE_BASE =
  process.env.NEXT_PUBLIC_UNIVERSE_BASE || "https://raw.githubusercontent.com/sean-ccho/Project_1/universe-data";

export const UNIVERSE_KEYS: UniverseKey[] = ["sp500", "nasdaq", "new"];

export function isUniverseKey(v: unknown): v is UniverseKey {
  return UNIVERSE_KEYS.includes(v as UniverseKey);
}

/** 시장 목록 주소 (브라우저가 받는다). */
export function universeUrl(key: UniverseKey): string {
  return `${UNIVERSE_BASE}/${key}.json`;
}
