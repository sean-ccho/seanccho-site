"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useT } from "./LangProvider";
import { universeHref } from "@/lib/format";

/** 티커 글자 — 누르면 전체분석에서 그 종목을 고른 채로. 전체분석에 없는 캐나다 상장(.V·.TO…)은 글자만. */
export function TickerLink({ ticker, style }: { ticker: string; style?: CSSProperties }) {
  const { t } = useT();
  const href = universeHref(ticker);
  if (!href) return <span className="tick" style={style}>{ticker}</span>;
  return (
    <Link className="tick" style={style} href={href} title={t.common.toUniverse}>
      {ticker}
    </Link>
  );
}
