"use client";

import { useT } from "./LangProvider";
import { daysBetween, isSoon } from "@/lib/earnings";
import { pct, todayToronto } from "@/lib/format";
import type { TickerInfo } from "@/lib/types";

/**
 * '📅 실적 D-5 · ±8.8%' — 실적이 14일 안일 때만 (빨강, 2026-10-29). 마우스를 올리면 최근 n번 평균·최악·보통 시간.
 * 전에는 '실적 임박' 글자만 있어서 며칠 남았는지도, 이 종목이 실적 때 얼마나 움직이는지도 안 보였다.
 */
export function EarnBadge({ info }: { info: Pick<TickerInfo, "earnings_date" | "earnings_move"> | null }) {
  const { t } = useT();
  const d = daysBetween(todayToronto(), info?.earnings_date);
  if (!isSoon(d)) return null;
  const m = info?.earnings_move ?? null;
  const title = m
    ? t.earn.badgeTitle(m.n, pct(m.avg, 1, false), pct(m.worst), m.timing ? t.earn.timing[m.timing] : "")
    : undefined;
  return (
    <span className="badge badge--bad" title={title}>
      📅 {t.earn.badge(d)}{m ? ` · ±${pct(m.avg, 1, false)}` : ""}
    </span>
  );
}
