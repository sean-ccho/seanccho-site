"use client";

import { useMemo, useState } from "react";
import { TickerLink } from "./TickerLink";

/** 칸 하나 — 글자 · 색(cls) · 설명(title). badge = 판정 칸(vm-st 모양), tag = 리서치 칸, mark = 숫자 뒤 작은 경고(베타 하한 · 부채 자료 없음). */
export type VmCell = {
  v: string; cls?: string; title?: string;
  badge?: "pass" | "junior" | "warn" | "bad" | "plain";
  tag?: boolean;
  mark?: { text: string; title: string; cls: string };
};
export type VmSortKey = "j" | "s" | "p";
/** 한 줄 — rank = 주니어 · 시니어 · 수석 PM 순서에서 몇 번째인지 (서버가 정한다). */
export type VmAllRow = { ticker: string; name: string | null; cells: VmCell[]; rank: Record<VmSortKey, number> };
export type VmAllCol = { label: string; cls?: string; title?: string; g0?: boolean };
export type VmAllGroup = { label: string; span: number; t: "x" | "v" | "j" | "s" | "p" };

/**
 * 예측 모델 — 품질 5개 통과 종목 전부를 한 표로 (2026-11-19 사용자: 주니어 대기 · 시니어 대기 · 수석 PM 심사 세 표가 같은 칸이면
 * 따로 있을 이유가 없다 → 하나로). 칸은 같고, 위 버튼으로 순서만 바꾼다 — 주니어 순(통과 → 매수 기준가에 가까운 순) · 시니어 순
 * (통과 → 성장 괴리 큰 순, 반증은 뒤로) · 수석 순(편입 → 심사 통과 → SBC 차감 하방 알파 큰 순, 후보 아님은 뒤로).
 * 글자 · 숫자는 서버(ValueModelViews)가 만든다 — 여기는 순서 · 더 보기만.
 */
export function VmAllTable({ rows, first, groups, cols, sorts, foot, more, initial = 20 }: {
  rows: VmAllRow[];
  /** 첫 칸(종목) 이름 */
  first: string;
  /** 종목 칸 다음부터의 칸 묶음 (span 합 = cols 수) */
  groups: VmAllGroup[];
  /** 종목 칸 다음부터 — cells 와 같은 순서 */
  cols: VmAllCol[];
  sorts: { key: VmSortKey; label: string; note: string }[];
  foot: string;
  /** '더 보기' 글자 — {n} 자리에 남은 종목 수 (서버 → 브라우저라 함수 대신 글자) */
  more: string;
  initial?: number;
}) {
  const [key, setKey] = useState<VmSortKey>(sorts[0]?.key ?? "j");
  const [all, setAll] = useState(false);
  const sorted = useMemo(() => [...rows].sort((a, b) => a.rank[key] - b.rank[key]), [rows, key]);
  const shown = all ? sorted : sorted.slice(0, initial);
  const cur = sorts.find((s) => s.key === key);
  return (
    <div className="vm-all">
      <div className="vm-all__bar">
        <div className="seg" role="group" aria-label={sorts.map((s) => s.label).join(" · ")}>
          {sorts.map((s) => (
            <button key={s.key} type="button" aria-pressed={s.key === key} onClick={() => setKey(s.key)}>{s.label}</button>
          ))}
        </div>
        {cur && <span className="vm-all__note">{cur.note}</span>}
      </div>
      <div className="table-wrap vm-tw">
        <table className="vm-t vm-t--wide">
          <thead>
            <tr className="vm-t__grp">
              <th />
              {groups.map((g, i) => (
                <th key={i} colSpan={g.span} className={g.label ? `vm-t__g vm-t__g--${g.t}` : undefined}>{g.label}</th>
              ))}
            </tr>
            <tr>
              <th>{first}</th>
              {cols.map((c, i) => (
                <th key={i} className={`${c.cls ?? ""}${c.g0 ? " vm-t__g0" : ""}`.trim() || undefined} title={c.title}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.ticker}>
                <td className="vm-who">
                  <TickerLink ticker={r.ticker} />
                  {r.name && <span className="vm-who__name" title={r.name}>{r.name}</span>}
                </td>
                {r.cells.map((c, i) => {
                  const g0 = cols[i]?.g0 ? " vm-t__g0" : "";
                  return (
                    <td key={i} className={`${c.cls ?? ""}${g0}`.trim() || undefined} title={c.badge ? undefined : c.title}>
                      {c.badge
                        ? <span className={`vm-st vm-st--${c.badge}`} title={c.title}>{c.v}</span>
                        : c.tag ? (c.v ? <span className="vm-tag vm-tag--plain">{c.v}</span> : null) : c.v}
                      {c.mark && <span className={c.mark.cls} title={c.mark.title}>{c.mark.text}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!all && sorted.length > shown.length && (
        <button type="button" className="btn btn--small vm-all__more" onClick={() => setAll(true)}>{more.replace("{n}", String(sorted.length - shown.length))}</button>
      )}
      <div className="vm-t__foot"><span>{foot}</span></div>
    </div>
  );
}
