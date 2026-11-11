"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { pct, stockHref, tone, usd } from "@/lib/format";
import { industry, sector, type Dict } from "@/lib/i18n";
import {
  DEFAULT_PERIOD, FOCUS_TOP, PERIODS, REPS_TOP, quadEtfHref, quadListHref,
  type GroupStats, type MapRow, type Period, type QuadCard, type SectorBlock, type SectorMapData, type SectorSide,
} from "@/lib/sectorMap";
import { regionBasis } from "@/lib/stockStyle";
import type { StockRegion, StockStyle } from "@/lib/types";
import { Hint } from "./Hint";
import { useT } from "./LangProvider";

/**
 * 섹터 지도 화면 (2026-11-10 개편, 사용자 시안 A · B 를 리뷰해서) — 기간(1주 · 1달 · 3달 · 1년)을 고르면 4칸 · 섹터 칩 · 대표 기업 ·
 * ETF 숫자가 같이 바뀐다. 4칸은 자리 고정 + 순위 배지, 관련 ETF 는 예전 그대로 전부. 섹터별 대표 기업은 섹터마다 글로벌 | 내수를
 * 같은 줄에 나란히 (전에는 표 두 개가 따로라 줄이 어긋났다), 섹터 칩을 누르면 그 섹터만 — 상위 10개씩 + 세부 업종별 숫자.
 * 고른 기간 · 섹터는 주소(?p= · ?sec=)에 남겨서 종목 페이지에 갔다가 뒤로 와도 그대로 (페이지는 정적, 붙은 뒤 읽는다).
 */

const isPeriod = (v: string | null): v is Period => PERIODS.includes(v as Period);

function periodLabels(S: Dict["sectors"]): Record<Period, string> {
  return { w1: S.w1, m1: S.m1, m3: S.m3, y1: S.y1 };
}

/** 칩 바탕 진하기 — 가장 크게 움직인 것 기준 8~30% (오늘 탭 섹터 칩과 같은 방식). */
function heat(v: number | null, maxAbs: number): CSSProperties {
  return { "--a": `${Math.round(8 + (22 * Math.abs(v ?? 0)) / (maxAbs || 1))}%` } as CSSProperties;
}

export function SectorMap({ data, asOf }: { data: SectorMapData; asOf: string | null }) {
  const { lang, t } = useT();
  const S = t.sectors;
  const PL = periodLabels(S);
  const [p, setP] = useState<Period>(DEFAULT_PERIOD);
  const [sec, setSec] = useState<string | null>(null); // null = 11개 섹터 전부
  const repsRef = useRef<HTMLElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // 주소 ?p=m3&sec=Technology — 화면에 붙은 뒤 건다 (서버 그림은 기본값이라 붙을 때 어긋나지 않는다)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const qp = sp.get("p");
    if (isPeriod(qp)) setP(qp);
    const qs = sp.get("sec");
    if (qs && data.sectors.some((b) => b.key === qs)) setSec(qs);
  }, [data]);

  // 고른 섹터 칩이 칩 줄(폰은 옆으로 미는 줄) 밖에 있으면 줄만 옆으로 — 페이지는 안 움직인다 (주소로 돌아온 경우 등)
  useEffect(() => {
    const strip = stripRef.current;
    const chip = strip?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!strip || !chip || strip.scrollWidth <= strip.clientWidth) return;
    const sr = strip.getBoundingClientRect();
    const cr = chip.getBoundingClientRect();
    if (cr.left < sr.left || cr.right > sr.right) strip.scrollLeft += cr.left - sr.left - (sr.width - cr.width) / 2;
  }, [sec]);

  const syncUrl = (np: Period, ns: string | null) => {
    const sp = new URLSearchParams(window.location.search);
    if (np === DEFAULT_PERIOD) sp.delete("p");
    else sp.set("p", np);
    if (ns) sp.set("sec", ns);
    else sp.delete("sec");
    const q = sp.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
  };
  const pickPeriod = (np: Period) => {
    setP(np);
    syncUrl(np, sec);
  };
  const pickSector = (ns: string | null) => {
    setSec(ns);
    syncUrl(p, ns);
    // 표 안으로 내려와 있을 때(섹터 줄이 위에 붙어 있을 때)만 표 맨 위로 — 위쪽 4칸을 보던 중이면 그대로 둔다
    const el = repsRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
  };

  // 4칸 순위 — 자리는 그대로, 이 기간 중앙값 순위만
  const ranks = useMemo(() => {
    const order = data.quads.filter((q) => q.stats.med[p] != null).sort((a, b) => b.stats.med[p]! - a.stats.med[p]!);
    return new Map(order.map((q, i) => [q.quad, i + 1]));
  }, [data, p]);
  const secMax = Math.max(...data.sectors.map((b) => Math.abs(b.stats.med[p] ?? 0)), Math.abs(data.all.med[p] ?? 0));
  const shown = sec ? data.sectors.filter((b) => b.key === sec) : data.sectors;

  return (
    <>
      <div className="page-title smap-title">
        <div className="smap-title__text">
          <h1>{S.title}</h1>
          <p>
            {S.sub}
            {asOf ? ` · ${S.asOf(asOf)}` : ""}
          </p>
        </div>
        <div className="smap-period">
          <Hint text={S.periodHelp} className="smap-period__label">{S.period}</Hint>
          <div className="seg" role="group" aria-label={S.period}>
            {PERIODS.map((k) => (
              <button key={k} type="button" aria-pressed={p === k} onClick={() => pickPeriod(k)}>{PL[k]}</button>
            ))}
          </div>
        </div>
      </div>

      <section className="card" aria-label={S.title}>
        <div className="quads__bands" aria-hidden="true">
          <span>{S.cyclicals}</span>
          <span>{S.defensives}</span>
        </div>
        <div className="quads">
          {data.quads.map((q) => <Quad key={q.quad} q={q} p={p} rank={ranks.get(q.quad) ?? null} />)}
        </div>
      </section>

      <section ref={repsRef} className="card smap-reps" aria-labelledby="smap-reps-h">
        <div className="smap-reps__head">
          <h2 id="smap-reps-h">{S.repsTitle}</h2>
          <p className="tiny muted">{S.repsSub(REPS_TOP)}</p>
        </div>
        <div className="smap-sticky">
          <div ref={stripRef} className="smap-strip" role="group" aria-label={S.secPick}>
            <button type="button" className={`smap-chip smap-chip--all smap-chip--${tone(data.all.med[p])}`}
              aria-pressed={sec === null} onClick={() => pickSector(null)} style={heat(data.all.med[p], secMax)}
              title={S.secChipTitle(S.secAll(data.sectors.length), PL[p], pct(data.all.med[p]), data.all.n)}>
              <span>{S.secAll(data.sectors.length)}</span>
              <b className={`num ${tone(data.all.med[p])}`}>{pct(data.all.med[p])}</b>
            </button>
            {data.sectors.map((b) => {
              const v = b.stats.med[p];
              const name = sector(lang, b.key);
              return (
                <button key={b.key} type="button" className={`smap-chip smap-chip--${tone(v)}`} aria-pressed={sec === b.key}
                  onClick={() => pickSector(sec === b.key ? null : b.key)} style={heat(v, secMax)}
                  title={S.secChipTitle(name, PL[p], pct(v), b.stats.n)}>
                  <span>{name}</span>
                  <b className={`num ${tone(v)}`}>{pct(v)}</b>
                </button>
              );
            })}
          </div>
          <div className="smap-pair smap-cols" aria-hidden="true">
            {(["global", "domestic"] as const).map((r) => (
              <div key={r} className="smap-cols__half">
                <ColTable head={r} p={p} PL={PL} S={S} />
              </div>
            ))}
          </div>
        </div>
        {shown.map((b) => (
          <Band key={b.key} b={b} no={data.sectors.indexOf(b) + 1} focus={sec != null} p={p} PL={PL}
            onFocus={() => pickSector(b.key)} onAll={() => pickSector(null)} />
        ))}
      </section>
    </>
  );
}

/** 표 열 폭 — 맨 위 고정 머리와 섹터마다의 표가 같은 colgroup 이라 세로줄이 맞는다. */
function ColTable({ head, caption, p, PL, S, children }: {
  head?: StockRegion; // 맨 위 고정 머리 — 넓은 화면은 첫 칸에 지역 이름, 한 줄로 쌓이는 좁은 화면은 '종목 · 세부 업종'
  caption?: string;
  p: Period;
  PL: Record<Period, string>;
  S: Dict["sectors"];
  children?: React.ReactNode;
}) {
  const cols = (
    <colgroup>
      <col />
      <col className="smap-c-price" />
      <col className="smap-c-us" />
      <col className="smap-c-ret" />
    </colgroup>
  );
  if (head) {
    return (
      <table className="smap-tbl smap-tbl--head">
        {cols}
        <thead>
          <tr>
            <th>
              <span className="smap-cols__rg">
                {head === "global" ? S.global : S.domestic} <span>{head === "global" ? S.globalRule : S.domesticRule}</span>
              </span>
              <span className="smap-cols__stock">{S.colStock}</span>
              <span className="smap-cols__stock-ph">{S.colStockPhone}</span>
            </th>
            <th className="r">{S.colPrice}</th>
            <th>{S.colUs}</th>
            <th className="r">{PL[p]}</th>
          </tr>
        </thead>
      </table>
    );
  }
  return (
    <table className="smap-tbl">
      {caption && <caption className="sr-only">{caption}</caption>}
      {cols}
      {/* 읽기 프로그램용 머리 — 눈에 보이는 머리는 위에 붙은 공용 머리 */}
      <thead className="smap-tbl__sr">
        <tr>
          <th scope="col"><span className="sr-only">{S.colStock}</span></th>
          <th scope="col"><span className="sr-only">{S.colPrice}</span></th>
          <th scope="col"><span className="sr-only">{S.colUs}</span></th>
          <th scope="col"><span className="sr-only">{PL[p]}</span></th>
        </tr>
      </thead>
      {children}
    </table>
  );
}

function Quad({ q, p, rank }: { q: QuadCard; p: Period; rank: number | null }) {
  const { lang, t } = useT();
  const S = t.sectors;
  const PL = periodLabels(S);
  const v = q.stats.med[p];
  const cyc = q.quad.split("_")[0];
  // 3달 · 1년은 2026-10-31 밤 실행부터 — 그 전 데이터면 안 보인다
  const rets = PERIODS.filter((k) => k === "w1" || k === "m1" || q.stats.med[k] != null);
  return (
    <article className={`quad quad--${cyc}`} aria-labelledby={`quad-${q.quad}`}>
      <div className="quad__top">
        <h3 id={`quad-${q.quad}`} className="quad__h">
          {t.style.quad[q.quad]} <span className="muted small">{t.style.quadEn[q.quad]}</span>
        </h3>
        {rank != null && (
          <Hint text={S.rankHelp} className={`quad__rank${rank === 1 ? " quad__rank--top" : rank === 4 ? " quad__rank--low" : ""}`}>
            {S.rank(PL[p], rank)}
          </Hint>
        )}
      </div>
      <p className="small muted quad__count">{S.count(q.stats.n)}</p>
      <div className="quad__kpi">
        <div className="quad__big">
          <b className={`num ${tone(v)}`}>{pct(v)}</b>
          <Hint text={S.medianHelp} className="tiny muted">{S.medianOf(PL[p])}</Hint>
        </div>
        <Breadth s={q.stats} p={p} />
      </div>
      <dl className="quad__rets" aria-label={S.median}>
        {rets.map((k) => (
          <div key={k} className={`quad__ret${k === p ? " quad__ret--on" : ""}`}>
            <dt>{PL[k]}</dt>
            <dd className={`num ${tone(q.stats.med[k])}`}>{pct(q.stats.med[k])}</dd>
          </div>
        ))}
      </dl>
      <p className="tiny muted quad__label">{S.industries}</p>
      <ul className="quad__chips">
        {q.industries.map(([name, n]) => (
          <li key={name} className="chip">{industry(lang, name)} <span className="tseg__count">{n}</span></li>
        ))}
      </ul>
      <p className="tiny muted quad__label">{S.leaders}</p>
      <ul className="quad__leaders">
        {q.leaders.map((s) => (
          <li key={s.ticker}>
            <Link className="tick" href={stockHref(s.ticker)} prefetch={false}>{s.ticker}</Link>{" "}
            <span className="muted quad__name">{s.company ?? ""}</span>{" "}
            <span className={`num small ${tone(s.ret[p])}`}>{pct(s.ret[p])}</span>
          </li>
        ))}
      </ul>
      <Link className="link-strong small quad__all" href={quadListHref(q.quad)} prefetch={false} title={S.allTitle}>
        {S.allStocks(q.stats.n)}
      </Link>
      {/* 관련 ETF — 예전 그대로 전부 (숫자만 고른 기간) */}
      <p className="tiny muted quad__label">
        {S.etfs}
        {q.etfs.length > 0 && (
          <>
            {" · "}
            <Link className="link-strong" href={quadEtfHref(q.quad)} prefetch={false}>{S.etfTable}</Link>
          </>
        )}
      </p>
      {q.etfs.length ? (
        <ul className="quad__chips">
          {q.etfs.map((e) => (
            <li key={e.ticker}>
              <Link className="chip" href={`/quant/etf#etf-${e.ticker}`} prefetch={false}
                title={S.etfTitle(e.name ?? e.ticker, PL[p], pct(e.ret[p]))}>
                <span className="tick">{e.ticker}</span> <span className={`num ${tone(e.ret[p])}`}>{pct(e.ret[p])}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="tiny muted" style={{ margin: 0 }}>{S.noEtf}</p>
      )}
    </article>
  );
}

/** 오른 종목 n/N + 막대 (초록 = 오른 비율). */
function Breadth({ s, p, compact }: { s: GroupStats; p: Period; compact?: boolean }) {
  const { t } = useT();
  const S = t.sectors;
  const n = s.has[p];
  if (!n) return null;
  const up = s.up[p];
  return (
    <span className={`smap-breadth${compact ? " smap-breadth--compact" : ""}`}>
      <Hint text={S.breadthHelp}>{S.breadth(up, n)}</Hint>
      <span className="smap-breadth__bar" aria-hidden="true"><i style={{ width: `${(up / n) * 100}%` }} /></span>
    </span>
  );
}

function Band({ b, no, focus, p, PL, onFocus, onAll }: {
  b: SectorBlock;
  no: number;
  focus: boolean;
  p: Period;
  PL: Record<Period, string>;
  onFocus: () => void;
  onAll: () => void;
}) {
  const { lang, t } = useT();
  const S = t.sectors;
  const v = b.stats.med[p];
  const name = sector(lang, b.key);
  const hid = `smap-sec-${no}`;
  return (
    <article className={`smap-band${focus ? " smap-band--focus" : ""}`} aria-labelledby={hid}>
      <header className="smap-band__head">
        <h3 id={hid}>
          <span className="smap-band__no num" aria-hidden="true">{no}</span>
          {name}
        </h3>
        <span className="smap-band__meta">
          {S.sectorCycle[b.key] && <span className="smap-band__cycle">{S.sectorCycle[b.key]}</span>}
          <span className="smap-band__stats">
            {S.sideCount(b.stats.n)} · {S.medianOf(PL[p])} <b className={`num ${tone(v)}`}>{pct(v)}</b>
          </span>
          <Breadth s={b.stats} p={p} compact />
          {b.etf && (
            <span className="smap-band__etf">
              <Hint text={S.sectorEtfHelp}>{S.sectorEtf}</Hint>
              <Link className="chip" href={`/quant/etf#etf-${b.etf.ticker}`} prefetch={false}
                title={S.etfTitle(b.etf.name ?? b.etf.ticker, PL[p], pct(b.etf.ret[p]))}>
                <span className="tick">{b.etf.ticker}</span> <span className={`num ${tone(b.etf.ret[p])}`}>{pct(b.etf.ret[p])}</span>
              </Link>
            </span>
          )}
        </span>
        <button type="button" className="smap-band__nav" onClick={focus ? onAll : onFocus}>
          {focus ? S.backAll : S.onlyThis}
        </button>
      </header>
      {focus && b.industries.length > 1 && <Industries b={b} p={p} PL={PL} />}
      <div className="smap-pair">
        {(["global", "domestic"] as const).map((r) => (
          <Side key={r} region={r} side={b[r]} top={focus ? FOCUS_TOP : REPS_TOP} p={p} PL={PL} secName={name} />
        ))}
      </div>
    </article>
  );
}

function Side({ region, side, top, p, PL, secName }: {
  region: StockRegion;
  side: SectorSide;
  top: number;
  p: Period;
  PL: Record<Period, string>;
  secName: string;
}) {
  const { t } = useT();
  const S = t.sectors;
  const rows = side.rows.slice(0, top);
  const v = side.stats.med[p];
  const regionName = region === "global" ? S.global : S.domestic;
  return (
    <div className={`smap-side smap-side--${region}`}>
      <p className="smap-side__head">
        <b>{t.style.region[region]}</b>
        <span className="smap-side__rule">{region === "global" ? S.globalRule : S.domesticRule}</span>
        <span>{S.sideCount(side.stats.n)}</span>
        {side.stats.n > 0 && (
          <span>
            {S.medianOf(PL[p])} <b className={`num ${tone(v)}`}>{pct(v)}</b>
          </span>
        )}
        {side.stats.n > 0 && <Breadth s={side.stats} p={p} compact />}
        {rows.length > REPS_TOP && <span className="smap-side__top">{S.topN(rows.length)}</span>}
      </p>
      {rows.length ? (
        <ColTable caption={`${secName} — ${regionName}`} p={p} PL={PL} S={S}>
          <tbody>
            {rows.map((r) => <Row key={r.ticker} r={r} p={p} />)}
          </tbody>
        </ColTable>
      ) : (
        <p className="smap-side__none tiny muted">{S.noSide}</p>
      )}
    </div>
  );
}

function Row({ r, p }: { r: MapRow; p: Period }) {
  const { lang } = useT();
  const v = r.ret[p];
  const ind = industry(lang, r.industry);
  const sub = [r.exchange, ind].filter(Boolean).join(" · ");
  return (
    <tr>
      <td className="smap-name">
        <span className="smap-name__l1">
          <Link className="tick" href={stockHref(r.ticker)} prefetch={false}>{r.ticker}</Link>
          <span className="smap-name__co" title={r.company ?? undefined}>{r.company ?? ""}</span>
        </span>
        {/* 넓은 화면 '거래소 · 업종', 폰은 가격 칸을 빼고 여기에 '가격 · 업종' */}
        <span className="smap-name__l2" title={sub}>
          <span className="smap-name__px num">{usd(r.price)}{ind ? " · " : ""}</span>
          {r.exchange && <span className="smap-name__ex">{r.exchange}{ind ? " · " : ""}</span>}
          {ind}
        </span>
      </td>
      <td className="r num">{usd(r.price)}</td>
      <td><UsBar s={r.style} /></td>
      <td className={`r num smap-ret ${tone(v)}`}>{pct(v)}</td>
    </tr>
  );
}

/**
 * 미국 · 해외 매출 막대 — SEC 10-K 숫자가 있을 때만 숫자 · 막대. 없으면 숫자를 지어내지 않고 '추정' + 빗금 막대,
 * 근거(지역별 공시 없음 · 해외 기업 · 업종 기준 …)는 말풍선.
 */
function UsBar({ s }: { s: StockStyle }) {
  const { t } = useT();
  const S = t.sectors;
  const basis = regionBasis(t, s);
  if (s.us_share == null) {
    return (
      <Hint text={basis} className="smap-us smap-us--est">
        <span className="smap-us__lbl">{S.estimated}</span>
        <span className="smap-us__bar" aria-hidden="true" />
      </Hint>
    );
  }
  const us = Math.max(0, Math.min(1, s.us_share));
  return (
    <span className="smap-us" title={basis}>
      <span className="smap-us__lbl">
        <span>{S.us(pct(us, 0, false))}</span>
        <span className="smap-us__ab">{S.abroad(pct(1 - us, 0, false))}</span>
      </span>
      <span className="smap-us__bar" aria-hidden="true"><i style={{ width: `${us * 100}%` }} /></span>
    </span>
  );
}

function Industries({ b, p, PL }: { b: SectorBlock; p: Period; PL: Record<Period, string> }) {
  const { lang, t } = useT();
  const S = t.sectors;
  const list = b.industries
    .filter((x) => x.stats.has[p] > 0)
    .sort((a, z) => (z.stats.med[p] ?? 0) - (a.stats.med[p] ?? 0));
  const maxAbs = Math.max(...list.map((x) => Math.abs(x.stats.med[p] ?? 0)));
  return (
    <div className="smap-ind">
      <Hint text={S.indHelp} className="smap-ind__label">{S.indTitle(PL[p])}</Hint>
      <ul>
        {list.map((x) => {
          const v = x.stats.med[p];
          const name = industry(lang, x.name);
          return (
            <li key={x.name} className={`mkt-secchip mkt-secchip--${tone(v)}`} style={heat(v, maxAbs)} title={`${name} · ${x.stats.n}`}>
              <span>{name} <small className="smap-ind__n">{x.stats.n}</small></span>
              <b className={`num ${tone(v)}`}>{pct(v)}</b>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
