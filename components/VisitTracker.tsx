"use client";

import { Analytics } from "@vercel/analytics/next";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * 방문 기록 (2026-11-05) — 페이지가 뜰 때마다(화면 안 이동 포함) /api/visit 로 짧은 기록을 보낸다.
 * 관리 · 방문자 탭(/quant/admin/visitors)이 이걸 모아 보여 준다. Vercel Web Analytics 도 여기서 같이 켠다.
 *
 * - 같은 사람 구분 = localStorage 의 무작위 번호 (IP 아님 · 방문 기록을 지우면 새 사람)
 * - 방문(세션) = 30분 넘게 쉬면 새 방문
 * - 사이트 주인(sc_owner 쿠키 — 비밀번호 화면을 한 번 열면 생긴다)은 둘 다 보내지 않는다
 * - 저장이 막힌 브라우저(사생활 보호 창 등)에서도 화면은 그대로 — 실패는 다 조용히 넘긴다
 */

const VID = "sc_vid";
const SESS = "sc_sess"; // '번호|마지막 활동 ms'
const GAP = 30 * 60_000;

const isOwner = () => {
  try {
    return /(?:^|;\s*)sc_owner=1(?:;|$)/.test(document.cookie);
  } catch {
    return false;
  }
};

function rid(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  } catch {
    return (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 16);
  }
}

function load(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

function save(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    // 저장 막힘 — 다음 페이지에서 새 사람 · 새 방문으로 보일 뿐
  }
}

let last = { p: "", t: 0 }; // 같은 페이지를 연달아 두 번 보내지 않게 (개발 모드 StrictMode 등)

function send(path: string) {
  if (isOwner() || navigator.webdriver) return;
  const now = Date.now();
  if (last.p === path && now - last.t < 2000) return;
  last = { p: path, t: now };

  let v = load(VID);
  const n = v ? 0 : 1;
  if (!v) {
    v = rid();
    save(VID, v);
  }

  const [sid, at] = (load(SESS) ?? "").split("|");
  const prevAt = Number(at) || 0;
  const fresh = !sid || now - prevAt > GAP;
  const s = fresh ? rid() : sid;
  save(SESS, `${s}|${now}`);

  let r = "";
  let u = "";
  let g: number | null = null;
  if (fresh) {
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      if (ref && ref.host !== location.host) r = ref.hostname;
      u = new URLSearchParams(location.search).get("utm_source") ?? "";
    } catch {
      // 이상한 referrer — 비워 둔다
    }
    if (!n && prevAt) g = Math.floor((now - prevAt) / 86_400_000);
  }

  const body = JSON.stringify({ v, s, p: path, f: fresh ? 1 : 0, n, g, r, u, l: navigator.language ?? "" });
  try {
    const blob = new Blob([body], { type: "text/plain" });
    if (!navigator.sendBeacon?.("/api/visit", blob)) {
      void fetch("/api/visit", { method: "POST", body, keepalive: true, credentials: "same-origin" }).catch(() => {});
    }
  } catch {
    // 못 보내도 그만
  }
}

export function VisitTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) send(pathname);
  }, [pathname]);
  return <Analytics beforeSend={(e) => (isOwner() ? null : e)} />;
}
