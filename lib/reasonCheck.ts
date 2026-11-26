import type { Account, TickerInfo } from "./types";

// 매수 이유가 아직 맞나 (2026-11-26, 사용자: "개선할 아이디어들도 전부 진행해") — 보유 줄 '매수이유' 글자로
// PT-1 · ISB · 골든크로스 세 가지만 사이트 자료와 대 본다. 실적 · 뉴스 · 직감 · 기타는 자동으로 알 수 없어서 판정하지 않는다.
// 표시 전용 — 시트 · 알림 · PT-1 에 쓰지 않는다.

export type ReasonState = "ok" | "weak" | "gone";
export type MaTf = "daily" | "weekly" | "monthly";
export type IsbExit = { label: "exit" | "top"; tf: "D" | "W" | "M"; date: string };

export type ReasonCheck =
  /** PT-1 후보 — PT-1 이 지금 갖고 있으면 유지, 내가 산 뒤 팔았으면 사라짐, 둘 다 아니고 후보 목록에도 없으면 약해짐 */
  | { kind: "pt1"; state: ReasonState; sold?: { date: string; why: string | null }; held?: boolean; candidate?: boolean }
  /** ISB 신호 — 내가 산 뒤 EXIT 라벨이면 사라짐, ◆ TOP 이면 약해짐 */
  | { kind: "isb"; state: ReasonState; hit?: IsbExit }
  /** 골든크로스 — 차트 EMA10 이 EMA20 아래(간격 < 0)면 데드크로스. tf = 매수이유에 적은 봉 (없으면 일·주봉 둘 다 본다) */
  | { kind: "golden"; state: ReasonState; tf: MaTf | null; gaps: Partial<Record<MaTf, number>> };

export type ReasonCtx = {
  pt1: Account | null; // dashboard accounts 의 key 'pt1'
  candidates: Set<string>; // 지금 PT-1 매수 후보 (대문자 티커)
  info: TickerInfo | null; // 사이트 종목 정보 (ma_gap · isb)
};

/** 매수이유 글자 → 확인할 종류. PT-1N 은 2026-11 에 없어져서 비교할 기록이 없다. */
export function reasonKind(reason: string): ReasonCheck["kind"] | null {
  const s = reason.toUpperCase().replace(/\s+/g, "");
  if (/PT-?1N/.test(s)) return null;
  if (/PT-?1/.test(s)) return "pt1";
  if (s.includes("ISB")) return "isb";
  if (s.includes("골든") || s.includes("GOLDEN")) return "golden";
  return null;
}

/** '골든크로스(주봉)'처럼 봉을 적었으면 그 봉만 본다. */
export function reasonTf(reason: string): MaTf | null {
  if (/주봉|weekly/i.test(reason)) return "weekly";
  if (/월봉|monthly/i.test(reason)) return "monthly";
  if (/일봉|daily/i.test(reason)) return "daily";
  return null;
}

const TF_ORDER: ("D" | "W" | "M")[] = ["D", "W", "M"];

export function checkReason(r: { ticker: string; buyDate: string; reason: string }, ctx: ReasonCtx): ReasonCheck | null {
  const kind = reasonKind(r.reason);
  if (!kind) return null;
  const tk = r.ticker.trim().toUpperCase();
  const since = r.buyDate || "";

  if (kind === "pt1") {
    if (!ctx.pt1) return null;
    if (ctx.pt1.positions.some((p) => p.ticker.toUpperCase() === tk)) return { kind, state: "ok", held: true };
    // 내가 산 날(그날 포함) 뒤에 PT-1 이 판 기록 — 가장 최근 것
    const log: { ticker: string; exit_date: string; exit_reason: string | null }[] = ctx.pt1.log ?? ctx.pt1.trades.recent;
    const sold = log
      .filter((x) => x.ticker.toUpperCase() === tk && x.exit_date >= since)
      .sort((a, b) => b.exit_date.localeCompare(a.exit_date))[0];
    if (sold) return { kind, state: "gone", sold: { date: sold.exit_date, why: sold.exit_reason } };
    if (ctx.candidates.has(tk)) return { kind, state: "ok", candidate: true };
    return { kind, state: "weak" };
  }

  if (kind === "isb") {
    const isb = ctx.info?.isb;
    if (!isb) return null; // 계산 안 한 종목 (TSXV 등)
    let hit: IsbExit | undefined;
    for (const tf of TF_ORDER) {
      for (const label of ["exit", "top"] as const) {
        const h = isb[tf]?.[label];
        if (!h || h.date < since) continue;
        // EXIT 가 TOP 보다 무겁다 — 같은 무게면 최근 것
        const better = !hit || (label === "exit" && hit.label === "top") || (label === hit.label && h.date > hit.date);
        if (better) hit = { label, tf, date: h.date };
      }
    }
    if (!hit) return { kind, state: "ok" };
    return { kind, state: hit.label === "exit" ? "gone" : "weak", hit };
  }

  const g = ctx.info?.ma_gap;
  if (!g) return null;
  const gaps: Partial<Record<MaTf, number>> = {};
  for (const tf of ["daily", "weekly", "monthly"] as const) {
    const v = g[tf];
    if (v != null && Number.isFinite(v)) gaps[tf] = v;
  }
  const tf = reasonTf(r.reason);
  if (tf) {
    const v = gaps[tf];
    if (v == null) return null;
    return { kind, state: v < 0 ? "gone" : "ok", tf, gaps };
  }
  // 봉을 안 적었으면 일봉 · 주봉 — 둘 다 데드크로스면 사라짐, 하나만이면 약해짐
  const seen = [gaps.daily, gaps.weekly].filter((v): v is number => v != null);
  if (!seen.length) return null;
  const dead = seen.filter((v) => v < 0).length;
  return { kind, state: dead === 0 ? "ok" : dead === seen.length ? "gone" : "weak", tf: null, gaps };
}
