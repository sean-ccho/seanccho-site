import type { UniverseKey, UniverseMarket, UniverseTab } from "./types";

/**
 * 전체분석 데이터 — Project_1 의 별도 워크플로(universe-scan.yml)가 매일 밤 universe-data 브랜치에 덮어쓴다.
 * 시장 목록({key}.json)은 수 MB 라 서버가 페이지에 담지 않고 브라우저가 raw 에서 직접 받는다 (gzip·CORS 됨).
 * 로컬 확인: NEXT_PUBLIC_UNIVERSE_BASE=http://localhost:8765 처럼 정적 서버를 가리킨다.
 * 브라우저·서버 공용 (서버 전용 읽기는 lib/universeServer.ts).
 */
export const UNIVERSE_BASE =
  process.env.NEXT_PUBLIC_UNIVERSE_BASE || "https://raw.githubusercontent.com/sean-ccho/Project_1/universe-data";

export const UNIVERSE_KEYS: UniverseKey[] = ["sp500", "nasdaq", "new"];

/** 위 탭 순서 — 전체(기본)가 맨 앞. */
export const UNIVERSE_TABS: UniverseTab[] = ["all", ...UNIVERSE_KEYS];

/** 탭마다 받을 시장 파일 — 전체는 S&P 500 과 나스닥·NYSE 둘 (겹치는 종목 없음, 순서는 전체차트처럼 S&P 500 먼저). */
export const TAB_KEYS: Record<UniverseTab, UniverseKey[]> = {
  all: ["sp500", "nasdaq"],
  sp500: ["sp500"],
  nasdaq: ["nasdaq"],
  new: ["new"],
};

export function isUniverseTab(v: unknown): v is UniverseTab {
  return UNIVERSE_TABS.includes(v as UniverseTab);
}

/** 시장 목록 주소 (브라우저가 받는다). */
export function universeUrl(key: UniverseKey): string {
  return `${UNIVERSE_BASE}/${key}.json`;
}

/**
 * 시장 목록 받기 (브라우저). raw.githubusercontent 는 몇 MB 넘는 파일을 압축해 주지 않아서(나스닥 8MB 가 그대로)
 * Project_1 이 같이 올리는 {key}.json.gz 를 먼저 받아 DecompressionStream 으로 푼다 (약 1MB).
 * .gz 가 아직 없거나(첫 밤 실행 전) 풀지 못하는 브라우저면 {key}.json.
 */
export async function fetchUniverse(key: UniverseKey): Promise<UniverseMarket> {
  if (typeof DecompressionStream !== "undefined") {
    try {
      const res = await fetch(`${UNIVERSE_BASE}/${key}.json.gz`, { cache: "no-cache" });
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
