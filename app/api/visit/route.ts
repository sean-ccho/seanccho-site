import { after } from "next/server";
import { isBot, parsePayload, parseUa, recordVisit, storeMode, type VisitEvent } from "@/lib/visits";

/**
 * 방문 기록 받는 곳 (2026-11-05) — components/VisitTracker.tsx 가 페이지마다 sendBeacon 으로 보낸다.
 *
 *   POST /api/visit   본문 = VisitPayload JSON (1KB 이하) · 응답은 늘 본문 없이
 *
 * 이 사이트 안에서 보낸 것만 (Sec-Fetch-Site / Origin), 로봇 UA 와 사이트 주인(sc_owner 쿠키 — proxy.ts 가
 * 비밀번호 통과 때 심는다)은 저장하지 않는다. IP 는 읽지도 저장하지도 않는다 — 위치는 Vercel 이 붙여 주는
 * 나라 · 주 · 도시 헤더만.
 */
export async function POST(request: Request): Promise<Response> {
  const h = request.headers;
  if (!sameOrigin(h)) return new Response(null, { status: 403 });

  const body = await request.text();
  if (body.length > 1024) return new Response(null, { status: 413 });

  const ua = h.get("user-agent") ?? "";
  const owner = /(?:^|;\s*)sc_owner=1(?:;|$)/.test(h.get("cookie") ?? "");
  if (owner || isBot(ua) || storeMode() === "none") return new Response(null, { status: 204 });

  let payload;
  try {
    payload = parsePayload(JSON.parse(body));
  } catch {
    payload = null;
  }
  if (!payload) return new Response(null, { status: 400 });

  const ev: VisitEvent = {
    ...payload,
    t: Date.now(),
    cc: (h.get("x-vercel-ip-country") ?? "").slice(0, 2).toUpperCase(),
    rg: (h.get("x-vercel-ip-country-region") ?? "").slice(0, 8),
    ci: decode(h.get("x-vercel-ip-city")).slice(0, 60),
    ...parseUa(ua),
  };
  // 응답을 먼저 돌려주고 저장 (실패해도 방문자 화면엔 아무 영향 없음)
  after(async () => {
    try {
      await recordVisit(ev);
    } catch (e) {
      console.error("visit 저장 실패", e);
    }
  });
  return new Response(null, { status: 204 });
}

/** 이 사이트 페이지에서 보낸 요청인지 — 요즘 브라우저는 Sec-Fetch-Site 를, 아니면 Origin 이 같은지. */
function sameOrigin(h: Headers): boolean {
  const site = h.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Vercel 도시 헤더는 URL 인코딩 ('S%C3%A3o%20Paulo'). */
function decode(v: string | null): string {
  if (!v) return "";
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}
