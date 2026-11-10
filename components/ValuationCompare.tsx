"use client";

import { useId, useState } from "react";
import { num } from "@/lib/format";
import { cmpText, compareVal, peSpike } from "@/lib/market";
import type { ValKey, Valuation } from "@/lib/types";
import { Hint } from "./Hint";
import { useT } from "./LangProvider";

/**
 * 밸류에이션 카드 (2026-11-03, 2026-11-09 '비교 대상' 고르기) — 6개 지표를 고른 묶음의 중앙값과 나란히 + 대비 막대.
 * 기본 = 같은 세부 업종 (종목 파일 valuation.ind). market.json ind_val 이 있으면 같은 섹터 전체 · 시장 전체 · 다른 업종 전부를
 * 고를 수 있다 (이름 · 설명 글자는 서버가 번역해서 넘긴다). 묶음이 기본 하나뿐이면 고르기 없이 예전 그대로.
 */

export type ValOpt = {
  key: string;
  label: string; // 고르기 목록 글자
  group: string; // optgroup 이름
  sub: string; // 카드 머리 설명
  name: string | null; // 요약 '…보다 쌈' 앞 이름 — null 이면 기본(같은 업종) 문구
  med: Partial<Record<ValKey, number | null>>;
};

const VAL_ORDER: ValKey[] = ["pe", "fpe", "peg", "ps", "pb", "ev_ebitda"];

export function ValuationCompare({ v, opts }: { v: Valuation; opts: ValOpt[] }) {
  const { t } = useT();
  const I = t.invest;
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
  const cols = own ? I.valCols : { ...I.valCols, ...I.valColsOther };
  // optgroup 순서는 opts 순서 그대로 (서버가 기본 → 같은 섹터 업종 → 다른 섹터 순으로 넘긴다)
  const groups: { name: string; items: ValOpt[] }[] = [];
  for (const o of opts) {
    const g = groups.find((x) => x.name === o.group);
    if (g) g.items.push(o);
    else groups.push({ name: o.group, items: [o] });
  }
  return (
    <section className="card" aria-labelledby="val-title">
      <div className="section-head">
        <h2 id="val-title">{I.valTitle}</h2>
        <p>{opt?.sub}</p>
      </div>
      {opts.length > 1 && (
        <p className="val-pick">
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
      {cheap + same + dear > 0 && (
        <p className="val-sum">{own ? I.valSummary(cheap, same, dear) : I.valSummaryVs(opt!.name!, cheap, same, dear)}</p>
      )}
      <table className="data-table val-table">
        <thead>
          <tr>
            <th>{cols.metric}</th>
            <th className="num">{cols.self}</th>
            <th className="num">{cols.ind}</th>
            <th>{cols.cmp}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            // 대비 막대 — 가운데 = 고른 묶음 중앙값, 왼쪽 = 쌈, 오른쪽 = 비쌈 (±100% 에서 자름)
            const d = r.c.ratio != null ? Math.max(-1, Math.min(1, r.c.ratio - 1)) : null;
            return (
              <tr key={r.k}>
                <td>
                  <Hint text={I.valHelp[r.k]}>{I.valNames[r.k]}</Hint>
                </td>
                <td className="num">{r.self == null ? "—" : r.self <= 0 ? I.valLoss : num(r.self, 1)}</td>
                <td className="num muted">{r.ind != null ? num(r.ind, 1) : "—"}</td>
                <td>
                  <span className="val-cmp">
                    <span className="val-bar" aria-hidden="true">
                      {d != null && (
                        <i
                          className={d < 0 ? "lo" : "hi"}
                          style={d < 0 ? { right: "50%", width: `${-d * 50}%` } : { left: "50%", width: `${d * 50}%` }}
                        />
                      )}
                    </span>
                    <span className="small">{cmpText(r.c, t)}</span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {peSpike(v) && <p className="small val-warn">{I.valSpike}</p>}
      <p className="tiny muted" style={{ margin: "8px 0 0" }}>{I.valNote}</p>
    </section>
  );
}
