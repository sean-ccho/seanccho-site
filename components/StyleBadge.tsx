"use client";

import { useT } from "./LangProvider";
import { styleShort, styleTitle } from "@/lib/stockStyle";
import type { StockStyle } from "@/lib/types";

/** 경기순환/방어 × 내수/글로벌 — '방어·내수' 작은 표시. 마우스를 올리면 근거 (SEC 미국 매출 비중 · 추정 …). 데이터가 없으면 안 보인다. */
export function StyleBadge({ style }: { style?: StockStyle | null }) {
  const { t } = useT();
  if (!style || (!style.cycle && !style.region)) return null;
  return (
    <span className={`badge badge--style badge--style-${style.cycle ?? "none"}`} title={styleTitle(t, style)}>
      {styleShort(t, style)}
    </span>
  );
}
