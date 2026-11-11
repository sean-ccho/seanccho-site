"use client";

import { useId, useState } from "react";
import { num } from "@/lib/format";
import { cmpText, compareVal, peSpike } from "@/lib/market";
import type { ValKey, Valuation } from "@/lib/types";
import { Hint } from "./Hint";
import { useT } from "./LangProvider";

/**
 * 밸류에이션 카드 (2026-11-03, 2026-11-09 '비교 대상' 고르기, 2026-11-10 시안 모양) — 6개 지표를 고른 묶음의 중앙값과 나란히.
 * 머리 오른쪽에 쌈 · 비슷 · 비쌈 개수 배지, 대비 칸은 글자 색으로 (쌈 초록 · 비쌈 빨강 · 비슷 회색).
 * 기본 = 같은 세부 업종 (종목 파일 valuation.ind). market.json ind_val 이 있으면 같은 섹터 전체 · 시장 전체 · 다른 업종 전부를
 * 고를 수 있다 (이름 · 설명 글자는 서버가 번역해서 넘긴다). 묶음이 기본 하나뿐이면 고르기 없이.
 */

export type ValOpt = {
  key: string;
  label: string; // 고르기 목록 글자
  group: string; // optgroup 이름
  sub: string; // 카드 머리 설명
  name: string | null; // 요약 '…보다' 앞 이름 — null 이면 기본(같은 업종) 문구
  med: Partial<Record<ValKey, number | null>>;
};

const VAL_ORDER: ValKey[] = ["pe", "fpe", "peg", "ps", "pb", "ev_ebitda"];

export function ValuationCompare({ v, opts, selfLabel }: { v: Valuation; opts: ValOpt[]; selfLabel?: string }) {
  const { t } = useT();
  const I = t.invest;
  const S = t.sp;
  const selId = useId();
  const [key, setKey] = useState(opts[0]?.key ?? "own");
  const opt = opts.find((o) => o.key === key) ?? opts[0];
  const own = !opt || opt.name == null;
  const rows = VAL_ORDER.map((k) => {
    const ind = opt?.med[k] ?? null;
    return { k, self: v[k], ind, c: compareVal(v[k], ind) };
  });
  const count = (k: ReturnType<typeof compareVal>["kind"]) => rows.filter((r) => r.c.kind === k).length;
  const [cheap, same, dear] = [count("cheaper"), count("similar"), count("pricier")];
  // optgroup 순서는 opts 순서 그대로 (서버가 기본 → 같은 섹터 업종 → 다른 섹터 순으로 넘긴다)
  const groups: { name: string; items: ValOpt[] }[] = [];
  for (const o of opts) {
    const g = groups.find((x) => x.name === o.group);
    if (g) g.items.push(o);
    else groups.push({ name: o.group, items: [o] });
  }
  return (
    <section className="card sd-card" aria-labelledby="val-title">
      <div className="sd-card__head">
        <h2 id="val-title">{I.valTitle}</h2>
        {cheap + same + dear > 0 && (
          <p className="sd-valsum">
            <span className="muted">{own ? S.valVsOwn : S.valVs(opt!.name!)}</span>
            <span className="sd-chip sd-chip--good">{S.valCheap(cheap)}</span>
            <span className="sd-chip sd-chip--mid">{S.valSame(same)}</span>
            <span className="sd-chip sd-chip--bad">{S.valDear(dear)}</span>
          </p>
        )}
      </div>
      <p className="sd-sub">{opt?.sub}</p>
      {opts.length > 1 && (
        <p className="val-pick sd-valpick">
          <label htmlFor={selId} className="small muted">{I.valCompare}</label>
          <select id={selId} className="input val-pick__sel" value={key} onChange={(e) => setKey(e.target.value)}>
            {groups.map((g) => (
              <optgroup key={g.name} label={g.name}>
                {g.items.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </p>
      )}
      <table className="data-table sd-valtable">
        <thead>
          <tr>
            <th>{I.valCols.metric}</th>
            <th className="num">{selfLabel ?? I.valCols.self}</th>
            <th className="num">{own ? S.valIndCol : I.valColsOther.ind}</th>
            <th className="r">{own ? S.valCmpCol : I.valColsOther.cmp}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k}>
              <td>
                <Hint text={I.valHelp[r.k]}>{I.valNames[r.k]}</Hint>
              </td>
              <td className="num sd-valtable__self">{r.self == null ? "—" : r.self <= 0 ? I.valLoss : num(r.self, 1)}</td>
              <td className="num muted">{r.ind != null ? num(r.ind, 1) : "—"}</td>
              <td className={`r sd-cmp sd-cmp--${r.c.kind}`}>{cmpText(r.c, t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {peSpike(v) && <p className="small val-warn">{I.valSpike}</p>}
      <p className="tiny muted sd-note">{I.valNote}</p>
    </section>
  );
}
