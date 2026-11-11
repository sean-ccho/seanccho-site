"use client";

import { useState } from "react";
import { useT } from "./LangProvider";
import { useWidth } from "./useWidth";
import { bigUsd, fmtDate, num, pct, usd } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import { median } from "@/lib/market";
import type { NextQuarter, QuarterEps, QuarterRevenue } from "@/lib/types";

// 종목 상세 '분기 실적' (2026-11-03, 2026-11-10 시안 모양) — 오른쪽 좁은 칸에 EPS · 매출 작은 막대 차트 둘을 나란히.
// 최근 4분기 + 다음 분기 예상(점선 막대). EPS 막대 색 = 예상 상회(파랑) · 하회(빨강), 막대 위 가는 선 = 애널리스트 예상.
// 막대를 올리거나 누르면 그 분기 숫자. 상회 횟수 배지는 받은 분기 전부(보통 8개)로 센다.

const H = 136;
const PT = 18; // 막대 위 값 글자
const PB = 18; // 아래 날짜 글자
const PX = 2;
const SHOWN = 4; // 차트에 그리는 지난 분기 수
const MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(iso: string, lang: Lang): string {
  const [y, m] = iso.split("-").map(Number);
  return lang === "en" ? `${MON_EN[m - 1]} ’${String(y).slice(2)}` : `${String(y).slice(2)}.${m}`;
}

/** 위만 둥근 막대 (아래는 기준선에 붙는다). y0 = 기준선, y1 = 값 — 음수 막대는 아래로. */
function barPath(x: number, w: number, y0: number, y1: number, r = 3): string {
  const h = Math.abs(y1 - y0);
  const rr = Math.min(r, h, w / 2);
  if (y1 <= y0) {
    return `M${x},${y0}V${y1 + rr}Q${x},${y1} ${x + rr},${y1}H${x + w - rr}Q${x + w},${y1} ${x + w},${y1 + rr}V${y0}Z`;
  }
  return `M${x},${y0}V${y1 - rr}Q${x},${y1} ${x + rr},${y1}H${x + w - rr}Q${x + w},${y1} ${x + w},${y1 - rr}V${y0}Z`;
}

function Tip({ x, W, children }: { x: number; W: number; children: React.ReactNode }) {
  return (
    <div className="qc-tip" style={{ left: `${Math.min(70, Math.max(30, (x / W) * 100))}%` }} role="status">
      {children}
    </div>
  );
}

/** 막대 위 금액 — 좁은 칸이라 '$' 를 뺀다 ('$128B' → '128B'). 정확한 값은 말풍선. */
function compactUsd(v: number): string {
  return bigUsd(v).replace("$", "");
}

/** 값 → y. 0 을 늘 넣는다 (막대는 0 에서 시작). */
function scale(vals: number[]) {
  let lo = Math.min(0, ...vals);
  let hi = Math.max(0, ...vals);
  if (hi === lo) hi = lo + 1;
  const span = hi - lo;
  if (lo < 0) lo -= span * 0.2; // 음수 막대 밑 값 글자가 날짜 글자와 겹치지 않게 아래 자리를 더
  hi += span * 0.04;
  return (v: number) => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
}

function EpsMini({ eps, next }: { eps: QuarterEps[]; next: NextQuarter }) {
  const { lang, t } = useT();
  const I = t.invest;
  const S = t.sp;
  const [hov, setHov] = useState<number | null>(null);
  const { ref, width: W } = useWidth<HTMLDivElement>(200, 120);
  const rows = eps.filter((q) => q.act != null || q.est != null).slice(-SHOWN);
  const hasNext = next.eps_est != null;
  const n = rows.length + (hasNext ? 1 : 0);
  if (!n) return null;
  const vals = [...rows.flatMap((q) => [q.act, q.est]), hasNext ? next.eps_est : null].filter((v): v is number => v != null);
  const y = scale(vals);
  const slot = (W - PX * 2) / n;
  const bw = Math.min(26, slot * 0.6);
  const cx = (i: number) => PX + slot * (i + 0.5);
  const lab = (v: number, top: boolean) => (top ? y(v) - 5 : y(v) + 12);
  const h = hov != null && hov < rows.length ? rows[hov] : null;
  return (
    <figure className="sdq">
      <figcaption>{S.epsShort}</figcaption>
      <div className="sdq-plot" ref={ref} onPointerLeave={() => setHov(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={I.epsTitle}>
          <line x1={PX} x2={W - PX} y1={y(0)} y2={y(0)} className="sdq-base" />
          {rows.map((q, i) => {
            const kind = q.act == null || q.est == null ? "" : q.act > q.est ? " sdq-bar--beat" : q.act < q.est ? " sdq-bar--miss" : "";
            return (
              <g key={q.date}>
                {q.act != null && (
                  <path d={barPath(cx(i) - bw / 2, bw, y(0), y(q.act))} className={`sdq-bar${kind}${hov === i ? " sdq-bar--hov" : ""}`} />
                )}
                {q.est != null && (
                  <line x1={cx(i) - bw / 2 - 3} x2={cx(i) + bw / 2 + 3} y1={y(q.est)} y2={y(q.est)} className="sdq-est" />
                )}
                {q.act != null && (
                  // 값 글자는 막대와 예상 선 중 높은 쪽 위에 (예상 하회 막대에서 글자가 선에 겹치지 않게)
                  <text x={cx(i)} y={q.act >= 0 ? Math.min(y(q.act), y(Math.max(q.est ?? q.act, 0))) - 5 : lab(q.act, false)}
                    className="sdq-val" textAnchor="middle">{num(q.act, 2)}</text>
                )}
                <text x={cx(i)} y={H - 4} className="sdq-axis" textAnchor="middle">{shortDate(q.date, lang)}</text>
              </g>
            );
          })}
          {hasNext && (
            <g>
              <path d={barPath(cx(rows.length) - bw / 2, bw, y(0), y(next.eps_est!))} className="sdq-bar--next" />
              <text x={cx(rows.length)} y={lab(next.eps_est!, next.eps_est! >= 0)} className="sdq-val sdq-val--next" textAnchor="middle">
                {num(next.eps_est!, 2)}
              </text>
              <text x={cx(rows.length)} y={H - 4} className="sdq-axis" textAnchor="middle">{I.nextShort}</text>
            </g>
          )}
          {Array.from({ length: n }, (_, i) => (
            <rect key={i} x={PX + slot * i} y={0} width={slot} height={H} fill="transparent"
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
    </figure>
  );
}

function RevMini({ rev, next }: { rev: QuarterRevenue[]; next: NextQuarter }) {
  const { lang, t } = useT();
  const I = t.invest;
  const S = t.sp;
  const [hov, setHov] = useState<number | null>(null);
  const { ref, width: W } = useWidth<HTMLDivElement>(200, 120);
  const off = Math.max(0, rev.length - SHOWN);
  const rows = rev.slice(off);
  const hasNext = next.rev_est != null;
  const n = rows.length + (hasNext ? 1 : 0);
  if (!n) return null;
  const y = scale([...rows.map((q) => q.revenue), next.rev_est ?? 0]);
  const slot = (W - PX * 2) / n;
  const bw = Math.min(26, slot * 0.6);
  const cx = (i: number) => PX + slot * (i + 0.5);
  const last = rows.length - 1;
  // 1년 전 같은 분기 — 받은 분기(보통 5개) 안에 있을 때만
  const yoy = (i: number) => (off + i >= 4 ? rev[off + i].revenue / rev[off + i - 4].revenue - 1 : null);
  return (
    <figure className="sdq">
      <figcaption>{S.revShort}</figcaption>
      <div className="sdq-plot" ref={ref} onPointerLeave={() => setHov(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={I.revTitle}>
          <line x1={PX} x2={W - PX} y1={y(0)} y2={y(0)} className="sdq-base" />
          {rows.map((q, i) => (
            <g key={q.end}>
              <path d={barPath(cx(i) - bw / 2, bw, y(0), y(q.revenue))}
                className={`sdq-bar${i === last ? " sdq-bar--last" : " sdq-bar--soft"}${hov === i ? " sdq-bar--hov" : ""}`} />
              <text x={cx(i)} y={y(q.revenue) - 5} className="sdq-val" textAnchor="middle">{compactUsd(q.revenue)}</text>
              <text x={cx(i)} y={H - 4} className="sdq-axis" textAnchor="middle">{shortDate(q.end, lang)}</text>
            </g>
          ))}
          {hasNext && (
            <g>
              <path d={barPath(cx(rows.length) - bw / 2, bw, y(0), y(next.rev_est!))} className="sdq-bar--next" />
              <text x={cx(rows.length)} y={y(next.rev_est!) - 5} className="sdq-val sdq-val--next" textAnchor="middle">
                {compactUsd(next.rev_est!)}
              </text>
              <text x={cx(rows.length)} y={H - 4} className="sdq-axis" textAnchor="middle">{I.nextShort}</text>
            </g>
          )}
          {Array.from({ length: n }, (_, i) => (
            <rect key={i} x={PX + slot * i} y={0} width={slot} height={H} fill="transparent"
              onPointerEnter={() => setHov(i)} onClick={() => setHov(i)} />
          ))}
        </svg>
        {hov != null && (
          <Tip x={cx(hov)} W={W}>
            {hov < rows.length ? (
              <>
                <span className="muted">{I.quarterEnd(fmtDate(rows[hov].end, lang))}</span>
                <b className="num">{bigUsd(rows[hov].revenue)}</b>
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
    </figure>
  );
}

/** 분기 실적 카드 — 머리 오른쪽 상회 배지, 작은 차트 둘, 읽는 법 한 줄, 다음 실적 예상. */
export function QuarterCard({ eps, revenue, next, className = "" }: {
  eps: QuarterEps[];
  revenue: QuarterRevenue[];
  next: NextQuarter;
  className?: string;
}) {
  const { lang, t } = useT();
  const I = t.invest;
  const S = t.sp;
  const done = eps.filter((q) => q.est != null && q.act != null);
  const beat = done.filter((q) => q.act! > q.est!).length;
  const med = median(done.map((q) => q.surprise).filter((v): v is number => v != null));
  const hasNext = next.date != null || next.eps_est != null || next.rev_est != null;
  return (
    <section className={`card sd-card ${className}`} aria-labelledby="q-title">
      <div className="sd-card__head">
        <h2 id="q-title">{I.qTitle}</h2>
        {done.length > 0 && (
          <span className={`sd-badge ${beat * 2 >= done.length ? "sd-badge--good" : "sd-badge--bad"}`}
            title={I.beatSummary(beat, done.length, med != null ? pct(med / 100) : "—")}>
            {S.qBeat(beat, done.length)}
          </span>
        )}
      </div>
      <div className="sdq-row">
        <EpsMini eps={eps} next={next} />
        <RevMini rev={revenue} next={next} />
      </div>
      <p className="sdq-legend tiny muted">
        <span><i className="sdq-key sdq-key--beat" />{S.beatBar}</span>
        <span><i className="sdq-key sdq-key--miss" />{S.missBar}</span>
        <span><i className="sdq-key sdq-key--est" />{S.estLine}</span>
        <span><i className="sdq-key sdq-key--next" />{I.nextShort} ({S.estTag})</span>
      </p>
      {hasNext && (
        <p className="sdq-next small">
          <b>{I.nextTitle}</b> {next.date ? fmtDate(next.date, lang, true) : I.tbd}
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
        </p>
      )}
      <p className="tiny muted sd-note">{I.qNote}</p>
    </section>
  );
}
