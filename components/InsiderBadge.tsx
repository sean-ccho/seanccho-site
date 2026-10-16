"use client";

import { useT } from "./LangProvider";
import { bigUsd } from "@/lib/format";
import type { Insider } from "@/lib/types";

/** 내부자 거래 90일 요약 한 줄 — 매수는 초록, 매도는 붉은색. 정보가 없으면 '—'. */
export function InsiderBadge({ insider, withNet = false }: { insider: Insider | null | undefined; withNet?: boolean }) {
  const { t } = useT();
  if (!insider) return <span className="muted">—</span>;
  if (!insider.signal) return <span className="muted small">{t.insider.quiet}</span>;
  const cls = insider.signal === "sell" ? "badge--bad" : "badge--good";
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      <span className={`badge ${cls}`}>{t.insider[insider.signal]}</span>
      <span className="num small">
        {insider.buys}/{insider.sells}
        {withNet && insider.net_value != null ? ` · ${bigUsd(insider.net_value)}` : ""}
      </span>
    </span>
  );
}
