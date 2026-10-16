"use client";

import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useT } from "./LangProvider";
import { useWidth } from "./useWidth";
import { fmtDate, monthLabel, pp, usd } from "@/lib/format";
import type { CurvePoint } from "@/lib/types";

const HEIGHT = 260;
const M = { top: 16, right: 104, bottom: 28, left: 60 };

function niceStep(range: number): number {
  const raw = range / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

/** PT-1 $5,000 계좌와 같은 날 SPY 를 샀을 때의 평가액 — 한 축, 두 줄, 십자선 툴팁. */
export function EquityChart({ curve, initial }: { curve: CurvePoint[]; initial: number }) {
  const { lang, t } = useT();
  const SERIES = [
    { key: "equity" as const, label: t.equity.acct, short: "PT-1", color: "var(--series-1)" },
    { key: "spy" as const, label: t.equity.spy, short: "SPY", color: "var(--series-2)" },
  ];
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const pts = useMemo(() => curve.filter((p) => p.equity != null), [curve]);
  const geo = useMemo(() => {
    const vals = pts.flatMap((p) => [p.equity, p.spy]).filter((v): v is number => v != null);
    vals.push(initial);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const step = niceStep(hi - lo || 100);
    const y0 = Math.floor(lo / step) * step;
    const y1 = Math.ceil(hi / step) * step;
    const innerW = Math.max(40, width - M.left - M.right);
    const innerH = HEIGHT - M.top - M.bottom;
    const x = (i: number) => M.left + (pts.length > 1 ? (i / (pts.length - 1)) * innerW : innerW / 2);
    const y = (v: number) => M.top + (1 - (v - y0) / (y1 - y0 || 1)) * innerH;
    const ticks: number[] = [];
    for (let v = y0; v <= y1 + step / 2; v += step) ticks.push(v);
    const allMonths: { i: number; label: string }[] = [];
    pts.forEach((p, i) => {
      const m = p.date.slice(0, 7);
      if (i === 0 || pts[i - 1].date.slice(0, 7) !== m) allMonths.push({ i, label: monthLabel(Number(p.date.slice(5, 7)), lang) });
    });
    // 좁은 화면에서 달 라벨이 붙으면 하나 건너 하나만
    const every = innerW / Math.max(1, allMonths.length) < 44 ? 2 : 1;
    const months = allMonths.filter((_, k) => k % every === 0);
    const path = (key: "equity" | "spy") =>
      pts
        .map((p, i) => (p[key] == null ? null : `${x(i).toFixed(1)},${y(p[key] as number).toFixed(1)}`))
        .filter(Boolean)
        .map((s, i) => `${i === 0 ? "M" : "L"}${s}`)
        .join(" ");
    return { x, y, ticks, months, innerW, path };
  }, [pts, initial, width, lang]);

  if (pts.length < 2) return <p className="muted">{t.equity.notEnough}</p>;

  const last = pts.length - 1;
  // 끝 라벨 — 너무 가까우면 벌리고 가는 연결선을 그린다
  const ends = SERIES.map((s) => {
    const v = pts[last][s.key];
    return v == null ? null : { ...s, v, y: geo.y(v) };
  }).filter((e): e is NonNullable<typeof e> => e != null);
  const labelY = ends.map((e) => e.y);
  if (labelY.length === 2 && Math.abs(labelY[0] - labelY[1]) < 30) {
    const mid = (labelY[0] + labelY[1]) / 2;
    const up = labelY[0] <= labelY[1] ? 0 : 1;
    labelY[up] = mid - 15;
    labelY[1 - up] = mid + 15;
  }

  const idxFromX = (clientX: number, rect: DOMRect) => {
    const rel = clientX - rect.left - M.left;
    return Math.max(0, Math.min(last, Math.round((rel / geo.innerW) * last)));
  };
  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement;
    if (svg) setHover(idxFromX(e.clientX, svg.getBoundingClientRect()));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const cur = hover ?? last;
      setHover(Math.max(0, Math.min(last, cur + (e.key === "ArrowLeft" ? -1 : 1))));
    } else if (e.key === "Escape") {
      setHover(null);
    }
  };

  const h = hover != null ? pts[hover] : null;
  const hx = hover != null ? geo.x(hover) : 0;
  const tipLeft = Math.min(Math.max(hx + 12, 0), width - 190);

  // 표로 보기: 달마다 마지막 날
  const monthly = pts.filter((p, i) => i === last || pts[i + 1].date.slice(0, 7) !== p.date.slice(0, 7));

  return (
    <div className="viz" ref={ref}>
      <div className="viz-legend">
        {SERIES.map((s) => (
          <span key={s.key} className="legend-key">
            <span className="legend-key__line" style={{ background: s.color }} aria-hidden="true" />
            {s.label}
          </span>
        ))}
      </div>
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label={t.equity.aria(usd(pts[last].equity, 0), usd(pts[last].spy, 0))}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        {geo.ticks.map((t) => (
          <g key={t}>
            <line className="viz-grid" x1={M.left} x2={M.left + geo.innerW} y1={geo.y(t)} y2={geo.y(t)} />
            <text x={M.left - 8} y={geo.y(t)} textAnchor="end" dominantBaseline="middle" className="num">
              {usd(t, 0)}
            </text>
          </g>
        ))}
        {geo.months.map((m) => (
          <text key={m.i} x={geo.x(m.i)} y={HEIGHT - 8} textAnchor="middle">
            {m.label}
          </text>
        ))}
        {SERIES.map((s) => (
          <path key={s.key} d={geo.path(s.key)} fill="none" stroke={s.color} strokeWidth={2}
            strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {ends.map((e, i) => (
          <g key={e.key}>
            {Math.abs(labelY[i] - e.y) > 1 && (
              <line x1={geo.x(last) + 6} y1={e.y} x2={geo.x(last) + 14} y2={labelY[i]} stroke="var(--faint)" strokeWidth={1} />
            )}
            <circle cx={geo.x(last)} cy={e.y} r={4} fill={e.color} stroke="var(--surface)" strokeWidth={2} />
            <text x={geo.x(last) + 16} y={labelY[i]} dominantBaseline="middle" style={{ fill: "var(--ink)" }}>
              <tspan fontWeight={600}>{e.short}</tspan>
              <tspan className="num" dx={6}>
                {usd(e.v, 0)}
              </tspan>
            </text>
          </g>
        ))}
        {h && (
          <g pointerEvents="none">
            <line x1={hx} x2={hx} y1={M.top} y2={HEIGHT - M.bottom} stroke="var(--faint)" strokeWidth={1} />
            {SERIES.map((s) =>
              h[s.key] == null ? null : (
                <circle key={s.key} cx={hx} cy={geo.y(h[s.key] as number)} r={4} fill={s.color}
                  stroke="var(--surface)" strokeWidth={2} />
              ),
            )}
          </g>
        )}
        <rect x={M.left} y={M.top} width={geo.innerW} height={HEIGHT - M.top - M.bottom} fill="transparent"
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {h && (
        <div className="viz-tooltip" style={{ left: tipLeft, top: 40 }} role="status">
          <div style={{ color: "var(--muted)", marginBottom: 4 }}>{fmtDate(h.date, lang, true)}</div>
          {SERIES.map((s) => (
            <div key={s.key} className="viz-tooltip__row">
              <span className="legend-key__line" style={{ background: s.color }} aria-hidden="true" />
              <span className="viz-tooltip__val">{usd(h[s.key], 0)}</span>
              <span className="muted">{s.short}</span>
            </div>
          ))}
          {h.equity != null && h.spy != null && (
            <div style={{ marginTop: 4, color: "var(--muted)" }}>
              {t.common.vsSpy} {pp(h.equity / initial - 1, h.spy / initial - 1)}
            </div>
          )}
        </div>
      )}
      <details className="table-view">
        <summary>{t.equity.tableView}</summary>
        <div className="table-wrap">
          <table className="data-table" style={{ minWidth: 420 }}>
            <thead>
              <tr>
                <th scope="col">{t.equity.colDate}</th>
                <th scope="col" className="r">PT-1</th>
                <th scope="col" className="r">SPY</th>
                <th scope="col" className="r">{t.equity.colGap}</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((p) => (
                <tr key={p.date}>
                  <td>{fmtDate(p.date, lang)}</td>
                  <td className="r num">{usd(p.equity, 0)}</td>
                  <td className="r num">{usd(p.spy, 0)}</td>
                  <td className="r num">
                    {p.equity != null && p.spy != null ? pp(p.equity / initial - 1, p.spy / initial - 1) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
