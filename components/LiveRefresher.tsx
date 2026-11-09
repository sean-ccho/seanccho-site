"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const POLL_MS = 90_000;

/** 토론토 시각 평일 09:40~16:50 — 장중 펄스(09:45~15:45 15분마다 · 16:20 마감)가 새로 나올 수 있는 때. */
function inWindow(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  if (p.weekday === "Sat" || p.weekday === "Sun") return false;
  const hm = Number(p.hour) * 100 + Number(p.minute);
  return hm >= 940 && hm <= 1650;
}

/**
 * 장중 자동 새로고침 (2026-11-09) — 탭이 보이고 장중 시간대일 때만 90초마다 /api/live 의 펄스 시각을 묻고, 이 화면을 그린
 * 펄스 시각(stamp)과 다르면 router.refresh() (새로고침 없이 숫자만 바뀐다 — 스크롤 · 고른 탭 · 입력은 그대로).
 * 펄스가 끊겨 장중 표시가 꺼질 때(stamp → null)도 다시 그려 밤 숫자로 돌아간다. 다른 때는 아무것도 하지 않는다.
 */
export function LiveRefresher({ stamp }: { stamp: string | null }) {
  const router = useRouter();
  const shown = useRef(stamp);
  useEffect(() => {
    shown.current = stamp;
  }, [stamp]);

  useEffect(() => {
    let busy = false;
    const check = async () => {
      if (busy || document.visibilityState !== "visible" || !inWindow()) return;
      busy = true;
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        if (res.ok) {
          const { stamp: latest } = (await res.json()) as { stamp: string | null };
          if (latest !== shown.current) router.refresh();
        }
      } catch {
        // 네트워크가 잠깐 끊겨도 다음 차례에 다시 묻는다
      } finally {
        busy = false;
      }
    };
    const timer = window.setInterval(check, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
