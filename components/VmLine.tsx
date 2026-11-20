"use client";

import { useT } from "./LangProvider";
import { money } from "@/lib/format";
import type { VmBuy } from "@/lib/valueModel";

const TIP = {
  ko: "예측 모델 (품질 5개 통과 종목만) — 기준 = 매수 기준가: 이 가격 이하면 기대수익률이 요구수익률보다 5%p 이상 높다 "
    + "(지금 가격이 그 이하면 파랑). 적정 = 기대수익률이 요구수익률과 같아지는 주가 (하방 ~ 기본 가정). "
    + "목표가가 아니다 — 과거 시험에서 적정가보다 싼 종목을 사도 SPY 를 이기지 못했다.",
  en: "Value model (only stocks passing all 5 quality gates) — Buy-below: at or below this price, expected return beats "
    + "required return by 5%p+ (blue when the current price is at or below it). Fair: the price where expected return equals "
    + "required return (bear ~ base). Not a target price — in past tests, buying below fair value did not beat SPY.",
};

/**
 * 매수 후보 · 전체분석 티커 아래 작은 줄 (2026-11-19 사용자, A안) — '기준 $20.21 · 적정 $16~$34'. vm 이 없으면(품질 탈락 ·
 * 대상 밖 · 현금흐름 마이너스) 아무것도 안 그린다. 지금 가격이 매수 기준가 이하면 기준을 파랑.
 */
export function VmLine({ vm, price, ticker, className }: {
  vm: VmBuy | undefined; price: number | null | undefined; ticker: string; className?: string;
}) {
  const { lang } = useT();
  if (!vm) return null;
  const en = lang === "en";
  const cheap = price != null && price <= vm.buy;
  const fm = (v: number) => money(v, ticker, Math.abs(v) >= 10 ? 0 : 2);
  return (
    <span className={`vm-line${className ? ` ${className}` : ""}`} title={TIP[lang]}>
      {en ? "Buy-below " : "기준 "}
      <b className={cheap ? "vm-line__ok" : undefined}>{money(vm.buy, ticker)}</b>
      {vm.low != null && vm.base != null && <>{" · "}{en ? "Fair " : "적정 "}{fm(vm.low)}~{fm(vm.base)}</>}
    </span>
  );
}
