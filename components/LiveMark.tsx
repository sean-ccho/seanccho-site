import { num, pct } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import type { HeatItem, LiveMark as Mark, TickerInfo } from "@/lib/types";
import { Hint } from "./Hint";

/*
 * 장중 숫자 표시 (2026-11-09, lib/live.ts) — 사용자가 15분마다 바뀌는 값과 밤에 확정된 값을 바로 구분하게.
 *  - LiveChip  카드 · 표 제목 옆 '● 11:30' (장중, 파란 점이 천천히 깜빡) · '● 16:00 마감' (마감 잠정, 회색)
 *  - LiveDot   표 칸 제목 옆 작은 ● — 그 칸만 장중 값 (점수처럼 밤 값인 칸은 표시 없음)
 *  - Prov      판단 값(PT-1 평가액 · 매도선 · 과열) 옆 '잠정'
 * mark 가 없으면(밤 값 그대로인 때) 아무것도 그리지 않는다. 색만으로 구분하지 않게 시각 글자를 같이 쓴다.
 */

export function LiveChip({ mark, t }: { mark?: Mark | null; t: Dict }) {
  if (!mark) return null;
  const L = t.live;
  const closing = mark.state === "closing";
  return (
    <Hint text={closing ? L.hintClosing(mark.at) : L.hint(mark.at)} className={`live-chip${closing ? " live-chip--closing" : ""}`}>
      <span className="live-dot" aria-hidden="true" />
      {closing ? L.chipClosing(mark.at) : L.chip(mark.at)}
    </Hint>
  );
}

export function LiveDot({ mark, t }: { mark?: Mark | null; t: Dict }) {
  if (!mark) return null;
  return (
    <span className={`live-dot live-dot--col${mark.state === "closing" ? " live-dot--closing" : ""}`}
      title={t.live.col} aria-label={t.live.col} role="img" />
  );
}

export function Prov({ mark, t }: { mark?: Mark | null; t: Dict }) {
  if (!mark) return null;
  return <Hint text={t.live.provHint} className="prov">{t.live.prov}</Hint>;
}

function heatText(h: HeatItem, t: Dict): string {
  const I = t.live.heatItem;
  const n = (v: number | null, d: number) => (v == null ? "—" : num(v, d));
  switch (h.k) {
    case "rsi":
      return I.rsi(n(h.v, 0), n(h.lim, 0));
    case "bband":
      return I.bband(n(h.v, 2), n(h.lim, 2));
    case "ret5":
      return I.ret5(pct(h.v), pct(h.lim, 0, false));
    case "bottom_pos":
      return I.bottom_pos(n(h.v, 2), n(h.lim, 2));
    case "bottom_rsi":
      return I.bottom_rsi(n(h.v, 0));
  }
}

/**
 * 매수 후보 '과열' 배지 (장중 · 잠정) — 지금 가격으로 마감하면 PT-1 하드필터(과열)에 걸리는 종목.
 * 사라고 하는 신호가 아니라 '이 가격이면 PT-1 은 안 산다'는 사실만 (진입 시점 신호는 검증에서 전부 실패했다).
 */
export function HeatBadge({ info, t }: { info: TickerInfo | null | undefined; t: Dict }) {
  const heat = info?.live_heat;
  if (!heat?.length) return null;
  return (
    <Hint text={t.live.heatHint(heat.map((h) => heatText(h, t)).join(" · "))} className="live-heat">
      {t.live.heat}
    </Hint>
  );
}
