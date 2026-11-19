// 서버 자료 읽기에 시간 제한 (2026-11-18 Vercel 오류 기록 — 종목 페이지에서 GitHub raw 연결이 멈춰 'headers timeout after 300000',
// 즉 Node 기본값 5분을 기다린 뒤에야 실패했다). 이미 signal 을 준 요청은 그대로. 실패는 예전처럼 부르는 쪽이 받는다.

export const FETCH_TIMEOUT_MS = 20_000; // 가장 큰 파일(나스닥 목록 2MB · dashboard.json 2MB)도 보통 1~2초

export function fetchT(input: string | URL, init: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } } = {},
  ms: number = FETCH_TIMEOUT_MS): Promise<Response> {
  return fetch(input, init.signal ? init : { ...init, signal: AbortSignal.timeout(ms) });
}
