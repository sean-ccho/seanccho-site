/**
 * 로그인 관련 주소 (2026-11-20) — proxy.ts · 서버 액션 · 화면이 같이 쓴다 (proxy 에서도 쓰므로 server-only 아님).
 */

/**
 * 관리자만 여는 주소 — 내계좌 묶음 전부(내 계좌 · 관심종목 · PT-1 · PT 거래로그) + 관리. 예측 모델은 2026-11-17 부터 공개.
 * PT-1 · PT 거래로그도 2026-11-24 부터 관리자만 (사용자: "다른사람들은 내계좌탭이 아예 안보이게").
 */
export const ADMIN_PATHS = ["/quant/account", "/quant/watchlist", "/quant/pt1", "/quant/trades", "/quant/admin"] as const;

export const LOGIN_PATH = "/quant/login";

export function isAdminPath(path: string): boolean {
  const p = path.split(/[?#]/, 1)[0];
  return ADMIN_PATHS.some((base) => p === base || p.startsWith(`${base}/`));
}

/**
 * 로그인 뒤 돌아갈 주소 — 이 사이트 안의 경로만 받는다 ('/quant/account?x=1').
 * '//evil.com' · '/\evil.com' (브라우저가 다른 사이트로 읽는다) · 'https://…' · 제어 문자 · 이상한 값은 fallback.
 */
export function safeNext(value: unknown, fallback = "/quant"): string {
  if (typeof value !== "string" || value.length > 2000) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  return value;
}

/**
 * 브라우저가 연 주소의 앞부분 ('https://seancho.vercel.app' · 미리보기 · 내 Mac) — Vercel 이 붙여 주는 x-forwarded-host 를 먼저.
 * 로그인 쿠키는 주소마다 따로라, 구글에서 돌아올 곳과 로그인 뒤 보낼 곳을 브라우저가 연 그 주소로 맞춘다.
 */
export function requestOrigin(h: Headers): string | null {
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  return `${proto}://${host}`;
}

/** 로그인 화면 주소 ('/quant/login?next=…' · 관리자가 아니면 denied=1). */
export function loginHref(next: string, opts: { denied?: boolean; error?: string } = {}): string {
  const q = new URLSearchParams();
  if (opts.denied) q.set("denied", "1");
  if (opts.error) q.set("error", opts.error);
  q.set("next", safeNext(next));
  return `${LOGIN_PATH}?${q.toString()}`;
}
