"use client";

import { useEffect, useState } from "react";
import { useT } from "./LangProvider";

const SHOW_AFTER = 480; // 이만큼(px) 내려가면 버튼이 나온다

/** 오른쪽 아래 '맨 위로' — 모든 페이지 (루트 레이아웃). 조금 내려가야 보인다. */
export function ScrollTop() {
  const { t } = useT();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > SHOW_AFTER);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <button type="button" className="scroll-top" data-shown={shown} onClick={toTop} aria-label={t.common.toTop}
      title={t.common.toTop} tabIndex={shown ? 0 : -1} aria-hidden={!shown}>
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
