"use client";

import { useT } from "./LangProvider";
import { bigUsd, fmtDate } from "@/lib/format";
import type { Insider } from "@/lib/types";

/**
 * 내부자 거래 90일 요약 — 시트·이메일 '내부자(90일)' 칸과 같은 내용.
 * 클러스터매수·매수는 초록, 매도는 붉은색 + '매수 n/매도 n'. full 이면 순 금액·마지막 거래일까지.
 * 조회하지 않은 종목은 '정보 없음' (거래가 없는 것과 구분).
 */
export function InsiderBadge({ insider, full = false }: { insider: Insider | null | undefined; full?: boolean }) {
  const { lang, t } = useT();
  const I = t.insider;
  if (!insider) return <span className="muted" title={I.noneHelp}>{I.none}</span>;
  if (!insider.signal) return <span className="muted">{I.quiet}</span>;
  const cls = insider.signal === "sell" ? "badge--bad" : "badge--good";
  const net = insider.net_value;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      <span className={`badge ${cls}`}>{I[insider.signal]}</span>
      <span className="num small">
        {I.counts(insider.buys, insider.sells)}
        {full && net != null ? ` · ${I.net(`${net > 0 ? "+" : ""}${bigUsd(net)}`)}` : ""}
        {full && insider.last_date ? ` ${I.last(fmtDate(insider.last_date, lang))}` : ""}
      </span>
    </span>
  );
}
