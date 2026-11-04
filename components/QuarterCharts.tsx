"use client";

import { useState } from "react";
import { useT } from "./LangProvider";
import { useWidth } from "./useWidth";
import { bigUsd, fmtDate, pct, usd } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import { median } from "@/lib/market";
import type { NextQuarter, QuarterEps, QuarterRevenue } from "@/lib/types";

// 종목 상세 '분기 실적' (2026-11-03) — EPS 예상 vs 실제 점 차트 + 분기 매출 막대, 올리면 그 분기 숫자.

const H = 190;
const PL = 44; // 왼쪽 축 글자
const PR = 8;
const PT = 14;
const PB = 26; // 아래 날짜 글자
const MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(iso: string, lang: Lang): string {
  const [y, m] = iso.split("-").map(Number);
  return lang === "en" ? `${MON_EN[m - 1]} ’${String(y).slice(2)}` : `${String(y).slice(2)}.${m}`;
}

/** 축 눈금 3~4개 — 1 · 2 · 2.5 · 5 × 10^k 간격. */
function ticks(lo: number, hi: number): number[] {
  const raw = (hi - lo) / 3;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

/** 축 글자 — 5e9 → '$5B', 2.5e10 → '$25B' (소수 끝 0 은 뺀다). */
function axisUsd(v: number): string {
  if (v === 0) return "0";
  const [d, u] = v >= 1e12 ? [1e12, "T"] : v >= 1e9 ? [1e9, "B"] : v >= 1e6 ? [1e6, "M"] : [1, ""];
  return `$${Number((v / d).toFixed(1))}${u}`;
}

/** 위만 둥근 막대 (아래는 바닥에 붙는다). */
function barPath(x: number, w: number, y0: number, y1: number, r = 4): string {
  const top = Math.min(y0, y1);
  const h = Math.abs(y1 - y0);
  const rr = Math.min(r, h, w / 2);
  return `M${x},${top + h}V${top + rr}Q${x},${top} ${x + rr},${top}H${x + w - rr}Q${x + w},${top} ${x + w},${top + rr}V${top + h}Z`;
}

function Tip({ x, W, children }: { x: number; W: number; children: React.ReactNode }) {
  return (
    <div className="qc-tip" style={{ left: `${Math.min(78, Math.max(22, (x / W) * 100))}%` }} role="status">
      {children}
    </div>
  );
}

function EpsChart({ eps, next }: { eps: QuarterEps[]; next: NextQuarter }) {
  const { lang, t } = useT();
  const I = t.invest;
  const [hov, setHov] = useState<number | null>(null);
  const { ref, width: W } = useWidth<HTMLDivElement>(480);
  const hasNext = next.eps_est != null;
  const n = eps.length + (hasNext ? 1 : 0);
  if (!n) return null;
  const vals = [...eps.flatMap((q) => [q.est, q.act]), hasNext ? next.eps_est : null].filter(
    (v): v is number => v != null,
  );
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (lo < 0) hi = Math.max(hi, 0);
  const pad = (hi - lo || 1) * 0.12;
  lo -= pad;
  hi += pad;
  const slot = (W - PL - PR) / n;
  const cx = (i: number) => PL + slot * (i + 0.5);
  const y = (v: number) => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
  const tk = ticks(lo, hi);
  const h = hov != null ? (hov < eps.length ? eps[hov] : null) : null;
  return (
    <figure className="qc">
      <figcaption>
        <b>{I.epsTitle}</b>
        <span className="qc-legend">
          <span><i className="qc-key qc-key--est" />{I.est}</span>
          <span><i className="qc-key qc-key--act" />{I.act}</span>
        </span>
      </figcaption>
      <div className="qc-plot" ref={ref} onPointerLeave={() => setHov(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={I.epsTitle}>
          {tk.map((v) => (
            <g key={v}>
              <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} className={v === 0 ? "qc-zero" : "qc-grid"} />
              <text x={PL - 6} y={y(v)} className="qc-axis" textAnchor="end" dominantBaseline="middle">
                {v.toFixed(Math.abs(v) < 10 ? 2 : 0)}
              </text>
            </g>
          ))}
          {eps.map((q, i) => (
            <g key={q.date}>
              {q.est != null && <circle cx={cx(i)} cy={y(q.est)} r={6} className="qc-est" />}
              {q.act != null && <circle cx={cx(i)} cy={y(q.act)} r={6} className="qc-act" />}
              <text x={cx(i)} y={H - 8} className="qc-axis" textAnchor="middle">{shortDate(q.date, lang)}</text>
            </g>
          ))}
          {hasNext && (
            <g>
              <circle cx={cx(eps.length)} cy={y(next.eps_est!)} r={6} className="qc-next" />
              <text x={cx(eps.length)} y={H - 8} className="qc-axis" textAnchor="middle">{I.nextShort}</text>
            </g>
          )}
          {hov != null && <line x1={cx(hov)} x2={cx(hov)} y1={PT} y2={H - PB} className="qc-cross" />}
          {Array.from({ length: n }, (_, i) => (
            <rect key={i} x={PL + slot * i} y={0} width={slot} height={H} fill="transparent"
              onPointerEnter={() => setHov(i)} onClick={() => setHov(i)} />
          ))}
        </svg>
        {hov != null && (
          <Tip x={cx(hov)} W={W}>
            {h ? (
              <>
                <span className="muted">{I.reported(fmtDate(h.date, lang))}</span>
                <span>{I.est} <b className="num">{usd(h.est)}</b> · {I.act} <b className="num">{usd(h.act)}</b></span>
                {h.est != null && h.act != null && (
                  <span>
                    {h.act > h.est ? `▲ ${I.beat}` : h.act < h.est ? `▼ ${I.miss}` : I.inline}
                    {h.surprise != null ? ` ${pct(h.surprise / 100)}` : ""}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="muted">{I.nextTitle} · {next.date ? fmtDate(next.date, lang) : I.tbd}</span>
                <span>{I.est} <b className="num">{usd(next.eps_est)}</b></span>
                {next.eps_year_ago != null && <span className="muted">{I.yearAgo(usd(next.eps_year_ago))}</span>}
              </>
            )}
          </Tip>
        )}
      </div>
      <p className="qc-axis-note tiny muted">{I.epsAxis}</p>
    </figure>
  );
}

function RevChart({ rev, next }: { rev: QuarterRevenue[]; next: NextQuarter }) {
  const { lang, t } = useT();
  const I = t.invest;
  const [hov, setHov] = useState<number | null>(null);
  const { ref, width: W } = useWidth<HTMLDivElement>(480);
  const hasNext = next.rev_est != null;
  const n = rev.length + (hasNext ? 1 : 0);
  if (!n) return null;
  const hi = Math.max(...rev.map((q) => q.revenue), next.rev_est ?? 0) * 1.15;
  const slot = (W - PL - PR) / n;
  const bw = Math.min(44, slot * 0.6);
  const cx = (i: number) => PL + slot * (i + 0.5);
  const y = (v: number) => PT + (1 - v / hi) * (H - PT - PB);
  const tk = ticks(0, hi);
  const yoy = (i: number) => (i >= 4 ? rev[i].revenue / rev[i - 4].revenue - 1 : null);
  const last = rev.length - 1;
  return (
    <figure className="qc">
      <figcaption>
        <b>{I.revTitle}</b>
        {hasNext && (
          <span className="qc-legend">
            <span><i className="qc-key qc-key--bar" />{I.act}</span>
            <span><i className="qc-key qc-key--nextbar" />{I.est}</span>
          </span>
        )}
      </figcaption>
      <div className="qc-plot" ref={ref} onPointerLeave={() => setHov(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={I.revTitle}>
          {tk.map((v) => (
            <g key={v}>
              <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} className={v === 0 ? "qc-zero" : "qc-grid"} />
              <text x={PL - 6} y={y(v)} className="qc-axis" textAnchor="end" dominantBaseline="middle">
                {axisUsd(v)}
              </text>
            </g>
          ))}
          {rev.map((q, i) => (
            <g key={q.end}>
              <path d={barPath(cx(i) - bw / 2, bw, y(0), y(q.revenue))} className={hov === i ? "qc-bar qc-bar--hov" : "qc-bar"} />
              {i === last && (
                <text x={cx(i)} y={y(q.revenue) - 6} className="qc-val" textAnchor="middle">{bigUsd(q.revenue)}</text>
              )}
              <text x={cx(i)} y={H - 8} className="qc-axis" textAnchor="middle">{shortDate(q.end, lang)}</text>
            </g>
          ))}
          {hasNext && (
            <g>
              <path d={barPath(cx(rev.length) - bw / 2, bw, y(0), y(next.rev_est!))} className="qc-bar--next" />
              <text x={cx(rev.length)} y={y(next.rev_est!) - 6} className="qc-val" textAnchor="middle">{bigUsd(next.rev_est)}</text>
              <text x={cx(rev.length)} y={H - 8} className="qc-axis" textAnchor="middle">{I.nextShort}</text>
            </g>
          )}
          {Array.from({ length: n }, (_, i) => (
            <rect key={i} x={PL + slot * i} y={0} width={slot} height={H} fill="transparent"
              onPointerEnter={() => setHov(i)} onClick={() => setHov(i)} />
          ))}
        </svg>
        {hov != null && (
          <Tip x={cx(hov)} W={W}>
            {hov < rev.length ? (
              <>
                <span className="muted">{I.quarterEnd(fmtDate(rev[hov].end, lang))}</span>
                <b className="num">{bigUsd(rev[hov].revenue)}</b>
                {yoy(hov) != null && <span>{I.yoy(pct(yoy(hov)))}</span>}
              </>
            ) : (
              <>
                <span className="muted">{I.nextTitle} · {next.date ? fmtDate(next.date, lang) : I.tbd}</span>
                <span>{I.nextRev} <b className="num">{bigUsd(next.rev_est)}</b></span>
                {next.rev_growth != null && <span>{I.yoy(pct(next.rev_growth))}</span>}
              </>
            )}
          </Tip>
        )}
      </div>
      <p className="qc-axis-note tiny muted">{I.revAxis}</p>
    </figure>
  );
}

/** 분기 실적 카드 — 위 한 줄 요약(몇 번 상회 · 다음 실적 예상) + 차트 둘. */
export function QuarterCard({ eps, revenue, next }: { eps: QuarterEps[]; revenue: QuarterRevenue[]; next: NextQuarter }) {
  const { lang, t } = useT();
  const I = t.invest;
  const done = eps.filter((q) => q.est != null && q.act != null);
  const beat = done.filter((q) => q.act! > q.est!).length;
  const med = median(done.map((q) => q.surprise).filter((v): v is number => v != null));
  return (
    <section className="card" aria-labelledby="q-title">
      <div className="section-head">
        <h2 id="q-title">{I.qTitle}</h2>
        <p>{I.qSub}</p>
      </div>
      <dl className="q-sum">
        {done.length > 0 && (
          <div>
            <dt>{I.epsTitle.split(" — ")[0]}</dt>
            <dd>{I.beatSummary(beat, done.length, med != null ? pct(med / 100) : "—")}</dd>
          </div>
        )}
        <div>
          <dt>{I.nextTitle}</dt>
          <dd>
            {next.date ? fmtDate(next.date, lang, true) : I.tbd}
            {next.eps_est != null && (
              <>
                {" · "}{I.nextEps} <b className="num">{usd(next.eps_est)}</b>
                {next.eps_year_ago != null && <span className="muted"> ({I.yearAgo(usd(next.eps_year_ago))})</span>}
              </>
            )}
            {next.rev_est != null && (
              <>
                {" · "}{I.nextRev} <b className="num">{bigUsd(next.rev_est)}</b>
                {next.rev_growth != null && <span className="muted"> ({pct(next.rev_growth)})</span>}
              </>
            )}
          </dd>
        </div>
      </dl>
      <div className="qc-row">
        <EpsChart eps={eps} next={next} />
        <RevChart rev={revenue} next={next} />
      </div>
      <p className="tiny muted" style={{ margin: "8px 0 0" }}>{I.qNote}</p>
    </section>
  );
}
