"use client";

import { useMemo, useState, type PointerEvent } from "react";

const W = 200;
const H = 40;
const PAD = 3;

export type SparkPoint = { d: string; v: number; s: string }; // 날짜 · 값 · 보여 줄 글자

/** 지표 작은 차트 — 선 하나 + 기준선(있으면, 점선) + 올리면 그 날짜 · 값. 숫자는 옆 글자에 있어서 차트는 흐름만. */
export function MacroSpark({ points, refLine, label }: { points: SparkPoint[]; refLine?: number | null; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const geo = useMemo(() => {
    if (points.length < 2) return null;
    const vs = points.map((p) => p.v);
    let lo = Math.min(...vs);
    let hi = Math.max(...vs);
    if (refLine != null) {
      lo = Math.min(lo, refLine);
      hi = Math.max(hi, refLine);
    }
    if (hi === lo) hi = lo + 1;
    const x = (i: number) => (i / (points.length - 1)) * W;
    const y = (v: number) => PAD + (1 - (v - lo) / (hi - lo)) * (H - PAD * 2);
    return { x, y, path: points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("") };
  }, [points, refLine]);
  if (!geo) return null;

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setHover(Math.round(f * (points.length - 1)));
  };
  const first = points[0];
  const last = points[points.length - 1];
  const h = hover != null ? points[hover] : null;
  return (
    <div className="spark" onPointerMove={move} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
        aria-label={`${label}: ${first.d} ${first.s} → ${last.d} ${last.s}`}>
        {refLine != null && (
          <line x1={0} x2={W} y1={geo.y(refLine)} y2={geo.y(refLine)} className="spark__ref" vectorEffect="non-scaling-stroke" />
        )}
        <path d={geo.path} className="spark__line" vectorEffect="non-scaling-stroke" />
      </svg>
      {h && hover != null && (
        <>
          <span className="spark__dot" aria-hidden="true"
            style={{ left: `${(geo.x(hover) / W) * 100}%`, top: `${(geo.y(h.v) / H) * 100}%` }} />
          <span className="spark__tip" style={{ left: `${Math.min(80, Math.max(20, (geo.x(hover) / W) * 100))}%` }}>
            {h.d} · <b>{h.s}</b>
          </span>
        </>
      )}
    </div>
  );
}
