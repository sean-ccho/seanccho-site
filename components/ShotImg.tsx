"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "./LangProvider";

/**
 * 캡처 한 장 (img) — 불러오는 동안 은은한 반짝임, 실패하면 안내 글 (2026-11-02).
 * 전에는 캡처(한 장 약 800KB)가 올 때까지 빈 상자만 보였다. 자리는 .shot img 의 aspect-ratio 가 미리 잡는다.
 * 주소가 바뀌면 부르는 쪽이 key={src} 로 새로 그린다.
 */
export function ShotImg({ src, alt }: { src: string; alt: string }) {
  const { t } = useT();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const ref = useRef<HTMLImageElement>(null);
  // 화면에 붙기 전에 이미 다 받은 이미지는 onLoad 를 놓친다
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.currentSrc) setState(img.naturalWidth ? "ok" : "error");
  }, []);
  return (
    <span className="shot-img" data-state={state}>
      {/* eslint-disable-next-line @next/next/no-img-element -- GitHub raw 이미지를 그대로 쓴다 */}
      <img ref={ref} src={src} alt={alt} loading="lazy" decoding="async"
        onLoad={() => setState("ok")} onError={() => setState("error")} />
      {state === "error" && <span className="shot-img__err">{t.charts.loadFailed}</span>}
    </span>
  );
}
