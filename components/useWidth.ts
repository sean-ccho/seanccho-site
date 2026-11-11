"use client";

import { useEffect, useRef, useState } from "react";

/** 요소의 실제 너비(px) — SVG 를 화면 크기에 맞춰 다시 그릴 때 쓴다 (글자가 줄어들지 않게). min = 이보다 좁게는 안 잰다. */
export function useWidth<T extends HTMLElement>(fallback = 720, min = 240) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(min, Math.round(el.getBoundingClientRect().width)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return { ref, width };
}
