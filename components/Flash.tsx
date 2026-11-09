"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 장중 숫자가 바뀌면 1.5초 동안 연한 초록(오름) · 빨강(내림) 배경 (2026-11-09) — 15분 펄스 뒤 새로고침(router.refresh)해도
 * 같은 자리는 직전 값을 기억한다 (React 상태 유지). 첫 화면에서는 깜빡이지 않고, 움직임 줄이기 설정이면 CSS 가 끈다.
 */
export function Flash({ v, children, className }: { v: number | null | undefined; children: React.ReactNode; className?: string }) {
  const prev = useRef(v);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = v;
    if (p == null || v == null || p === v) return;
    setDir(v > p ? "up" : "down");
    const id = window.setTimeout(() => setDir(null), 1500);
    return () => window.clearTimeout(id);
  }, [v]);
  const cls = [className, dir ? `flash-${dir}` : null].filter(Boolean).join(" ");
  return <span className={cls || undefined}>{children}</span>;
}
