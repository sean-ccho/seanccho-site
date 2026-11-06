import type { UniverseKey, UniverseMarket, UniverseTab } from "./types";

/**
 * 전체분석 데이터 — Project_1 의 별도 워크플로(universe-scan.yml)가 매일 밤 universe-data 브랜치에 덮어쓴다.
 * 캐나다(ca)만 다른 워크플로(canada-scan.yml)가 canada-data 브랜치에 (universe-data 는 미국 작업이 통째로 덮어써서 · 2026-11-05).
 * 시장 목록({key}.json)은 수 MB 라 서버가 페이지에 담지 않고 브라우저가 raw 에서 직접 받는다 (gzip·CORS 됨).
 * 로컬 확인: NEXT_PUBLIC_UNIVERSE_BASE=http://localhost:8765 처럼 정적 서버를 가리킨다 (캐나다는 NEXT_PUBLIC_CANADA_BASE,
 * 없으면 같은 곳).
 * 브라우저·서버 공용 (서버 전용 읽기는 lib/universeServer.ts).
 */
export const UNIVERSE_BASE =
  process.env.NEXT_PUBLIC_UNIVERSE_BASE || "https://raw.githubusercontent.com/sean-ccho/Project_1/universe-data";

export const CANADA_BASE =
  process.env.NEXT_PUBLIC_CANADA_BASE ||
  (process.env.NEXT_PUBLIC_UNIVERSE_BASE ? UNIVERSE_BASE : "https://raw.githubusercontent.com/sean-ccho/Project_1/canada-data");

/** 시장 파일이 있는 곳 — 캐나다만 canada-data. */
export function universeBase(key: UniverseKey): string {
  return key === "ca" ? CANADA_BASE : UNIVERSE_BASE;
}

/** 시장 파일 순서 — 위 탭 순서이자 종목 찾기(⌘K)에서 같은 티커는 앞 파일 것. */
export const UNIVERSE_KEYS: UniverseKey[] = ["sp500", "nasdaq", "new", "ca", "extra"];

/** 위 탭 순서 — 전체(기본)가 맨 앞, 캐나다 · 번외가 맨 끝. */
export const UNIVERSE_TABS: UniverseTab[] = ["all", ...UNIVERSE_KEYS];

/**
 * 없어도 되는 시장 파일 — 번외(extra.json)는 Project_1 이 2026-11-05 부터 싣는다, 캐나다(ca.json)는 canada-data 첫 실행부터.
 * 없으면 그 탭을 숨기고(page.tsx), 전체 탭은 두 시장만 보여 준다(UniverseScreen).
 */
export const OPTIONAL_KEYS: UniverseKey[] = ["extra", "ca"];

/**
 * 탭마다 받을 시장 파일 — 전체는 S&P 500 · 나스닥·NYSE (겹치는 종목 없음, 전체차트처럼 S&P 500 먼저) + 번외.
 * 캐나다는 통화(C$)도 휴장일도 달라서 전체에 섞지 않고 자기 탭에만.
 */
export const TAB_KEYS: Record<UniverseTab, UniverseKey[]> = {
  all: ["sp500", "nasdaq", "extra"],
  sp500: ["sp500"],
  nasdaq: ["nasdaq"],
  new: ["new"],
  ca: ["ca"],
  extra: ["extra"],
};

export function isUniverseTab(v: unknown): v is UniverseTab {
  return UNIVERSE_TABS.includes(v as UniverseTab);
}

/** 시장 목록 주소 (브라우저가 받는다). */
export function universeUrl(key: UniverseKey): string {
  return `${universeBase(key)}/${key}.json`;
}

/**
 * 시장 목록 받기 (브라우저). raw.githubusercontent 는 몇 MB 넘는 파일을 압축해 주지 않아서(나스닥 8MB 가 그대로)
 * Project_1 이 같이 올리는 {key}.json.gz 를 먼저 받아 DecompressionStream 으로 푼다 (약 1MB).
 * .gz 가 아직 없거나(첫 밤 실행 전) 풀지 못하는 브라우저면 {key}.json.
 */
export async function fetchUniverse(key: UniverseKey): Promise<UniverseMarket> {
  if (typeof DecompressionStream !== "undefined") {
    try {
      const res = await fetch(`${universeBase(key)}/${key}.json.gz`, { cache: "no-cache" });
      if (res.ok) {
        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf[0] === 0x1f && buf[1] === 0x8b) {
          const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
          return JSON.parse(await new Response(stream).text()) as UniverseMarket;
        }
        return JSON.parse(new TextDecoder().decode(buf)) as UniverseMarket; // 중간에서 이미 풀어 준 경우
      }
    } catch {
      // 아래 .json 으로
    }
  }
  const res = await fetch(universeUrl(key), { cache: "no-cache" });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as UniverseMarket;
}
