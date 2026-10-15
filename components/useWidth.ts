"use client";

import { useEffect, useRef, useState } from "react";

/** 요소의 실제 너비(px) — SVG 를 화면 크기에 맞춰 다시 그릴 때 쓴다 (글자가 줄어들지 않게). */
export function useWidth<T extends HTMLElement>(fallback = 720) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(240, Math.round(el.getBoundingClientRect().width)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}
