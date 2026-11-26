import { finMoney, gradeTone, healthText, num, pct } from "@/lib/format";
import { healthBreakdown, isIndexEtf, type HealthItem } from "@/lib/health";
import type { Dict } from "@/lib/i18n";
import type { TickerInfo } from "@/lib/types";

/** ✓ 통과 · ✕ 미달 · – 자료 없음 — 글자 대신 그림 (글꼴마다 ✓ 가 ✕ 보다 가늘게 나와서). */
function Mark({ state }: { state: "pass" | "fail" | "none" }) {
  const d = state === "pass" ? "M5 12.5 L10 17 L19 7" : state === "fail" ? "M7 7 L17 17 M17 7 L7 17" : "M7 12 H17";
  return (
    <svg className="hc-mark" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/** 항목 값 글자 — 성장률은 부호, 부채비율은 배, 현금흐름은 회사 보고 통화. */
function itemValue(it: HealthItem, info: TickerInfo, ticker: string, t: Dict): string {
  const v = it.value;
  if (v == null) return t.hc.noData;
  switch (it.def.key) {
    case "roe":
    case "pm":
      return pct(v, 1, false);
    case "inst":
      return pct(v, 0, false);
    case "rev":
    case "eg":
      return pct(v, Math.abs(v) >= 10 ? 0 : 1); // '+2542%' (1년 전 분기가 아주 작았던 것) — 소수 없이
    case "de":
      return t.stock.times(num(v / 100));
    case "cr":
      return num(v, 2);
    case "fcf":
      return finMoney(v, ticker, info.fundamentals?.fin_ccy, info.fundamentals?.ccy);
  }
}

/** Yahoo 순이익률이 딱 0 — 매출이 없거나 적자인 회사에 Yahoo 가 0 을 준다 (바이오 · 탐사 광산, 2026-11-25 약 2,000종목). */
function zeroMargin(it: HealthItem): boolean {
  return it.def.key === "pm" && it.value === 0;
}

/**
 * 헬스체크 근거 (2026-11-25) — 점수를 만드는 8개 항목마다 ✓ 통과 · ✕ 미달 · – 자료 없음(빼고 계산) + 값 + 받은 점수.
 * chips = 목록 오른쪽 상세 (한 줄 칩) · list = 종목 페이지 재무 카드 (항목마다 기준 · 점수까지).
 * 훅 없이 t 를 받아서 서버 · 클라이언트 둘 다에서 쓴다.
 */
export function HealthItems({ info, ticker, t, variant }: {
  info: TickerInfo;
  ticker: string;
  t: Dict;
  variant: "chips" | "list";
}) {
  if (isIndexEtf(ticker)) return null;
  const b = healthBreakdown(info);
  if (!b || b.got === 0) return null;
  const H = t.hc;
  const math = b.score != null ? H.math(b.got, b.possible, b.earned, b.score) : H.mathNa(b.got);
  const h = info.health;
  if (variant === "chips") {
    return (
      <div className="hc hc--chips">
        <p className="hc__head">
          <span className="hc__title">{H.title}</span>
          <span className="hc__math">{math}</span>
        </p>
        <ul className="hc__chips">
          {b.items.map((it) => {
            const L = H.items[it.def.key];
            const zero = zeroMargin(it);
            return (
              <li key={it.def.key} className="hc-chip" data-state={it.state}
                title={`${L.help}${zero ? `\n${H.zeroMargin}` : ""}\n→ ${H.state[it.state]}${it.state === "none" ? ` (${H.noneRule})` : ""}`}>
                <span className="hc-chip__mark"><Mark state={it.state} /></span>
                <span className="sr-only">{H.state[it.state]}</span>
                <span className="hc-chip__name">{L.name}</span>
                <span className="hc-chip__val num">{zero ? H.zeroShort : itemValue(it, info, ticker, t)}</span>
                {it.edge && it.state === "pass" && <span className="hc-chip__edge" title={H.edgeHelp}>{H.edgePass}</span>}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
  return (
    <div className="hc hc--list">
      <p className="hc__head">
        <span className="hc__title">{H.title}</span>
        {h && <span className={`badge badge--${gradeTone(h.grade)}`}>{healthText(h, t.common.healthNA)}</span>}
        <span className="hc__math">{math}</span>
      </p>
      <ul className="hc__list">
        {b.items.map((it) => {
          const L = H.items[it.def.key];
          const zero = zeroMargin(it);
          return (
            <li key={it.def.key} className="hc-row" data-state={it.state} title={L.help}>
              <span className="hc-row__mark"><Mark state={it.state} /></span>
              <span className="sr-only">{H.state[it.state]}</span>
              <span className="hc-row__name">{L.name}</span>
              <span className="hc-row__val num">
                {zero ? H.zeroShort : itemValue(it, info, ticker, t)}
                {it.edge && it.state === "pass" && <span className="hc-chip__edge" title={H.edgeHelp}> {H.edgePass}</span>}
              </span>
              <span className="hc-row__rule">
                {it.state === "none" ? H.noneRule : L.rule} · {H.pts(it.def.pts)}
                {zero ? ` · ${H.zeroMargin}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="hc__foot">{H.sub}</p>
    </div>
  );
}
