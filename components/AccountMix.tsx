"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "./LangProvider";
import { QUAD_HEAVY, SECTOR_HEAVY, type AccountMix as Mix, type MixFill, type MixKey, type MixPart } from "@/lib/accountMix";
import { pct, usd } from "@/lib/format";
import { sector } from "@/lib/i18n";
import type { Quad } from "@/lib/stockStyle";

// 내 계좌 쏠림 카드 (2026-11-26 사용자 시안으로 개편) — 도넛 + 방어주/순환주 두 칸(내수·글로벌 나눔과 종목 이름) + 네 칸 범례,
// '내수/글로벌 상세'는 네 칸 막대 · 비어 있는 칸을 채울 ETF · 설명. 아래 줄은 섹터 비중과 한 칸 쏠림 여부. 보기 전용.
// 숫자는 서버(page.tsx)가 계산해서 넘긴다 — 여기는 그리기 · 보기 전환만.

type View = "cycle" | "quad";
type Group = "defensive" | "cyclical";
type Seg = { key: string; label: string; share: number; value: number; color: string };

const VIEW_KEY = "acct:mixView";
/** 도넛 · 범례 순서 — 방어(진한 파랑 → 옅은 파랑) 다음 순환(옅은 주황 → 진한 주황), 같은 색 계열끼리 붙게. */
const QUAD_ORDER: Quad[] = ["defensive_domestic", "defensive_global", "cyclical_global", "cyclical_domestic"];
const GROUP_QUADS: Record<Group, Quad[]> = {
  defensive: ["defensive_domestic", "defensive_global"],
  cyclical: ["cyclical_domestic", "cyclical_global"],
};
// 색은 globals.css 의 --mix-* (dataviz 검증: 명도 · 채도 · 색약 구분 통과). 진한 쪽 = 내수
const COLOR: Record<MixKey | Group, string> = {
  defensive_domestic: "var(--mix-dd)",
  defensive_global: "var(--mix-dg)",
  cyclical_global: "var(--mix-cg)",
  cyclical_domestic: "var(--mix-cd)",
  defensive: "var(--mix-dd)",
  cyclical: "var(--mix-cd)",
  other: "var(--mix-other)",
};

function Dot({ color }: { color: string }) {
  return <span className="mixd-dot" style={{ background: color }} aria-hidden="true" />;
}

/** 도넛 — 조각 사이 2px 틈, 12시부터 시계 방향. 조각에 마우스를 올리면 이름 · 비중 · 금액. 가운데는 가장 큰 조각. */
function Donut({ segs, aria }: { segs: Seg[]; aria: string }) {
  const size = 168;
  const sw = 26;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const shown = segs.filter((s) => s.share > 0.0005);
  const gap = shown.length > 1 ? 2 : 0;
  const top = shown.reduce<Seg | null>((a, s) => (a && a.share >= s.share ? a : s), null);
  let acc = 0;
  return (
    <div className="mixd-donut">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={aria}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw} style={{ stroke: "var(--line-soft)" }} />
        {shown.map((s) => {
          const len = s.share * c;
          const dash = Math.max(0.5, len - gap);
          const el = (
            <circle key={s.key} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw}
              style={{ stroke: s.color }} strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-acc}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}>
              <title>{`${s.label} ${pct(s.share, 0, false)} · ${usd(s.value, 0)}`}</title>
            </circle>
          );
          acc += len;
          return el;
        })}
      </svg>
      {top && (
        <div className="mixd-donut__center" aria-hidden="true">
          <span>{top.label}</span>
          <b className="num">{pct(top.share, 0, false)}</b>
        </div>
      )}
    </div>
  );
}

export function AccountMix({ mix, fill }: { mix: Mix; fill: MixFill[] }) {
  const { lang, t } = useT();
  const A = t.accountMix;
  const [view, setView] = useState<View>("cycle");
  // 고른 보기는 이 브라우저에 기억 (못 읽으면 기본 '방어 vs 순환')
  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === "quad") setView("quad");
    } catch {}
  }, []);
  const pick = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  const q: Partial<Record<string, MixPart>> = Object.fromEntries(mix.quads.map((p) => [p.key, p]));
  const share = (k: MixKey) => q[k]?.share ?? 0;
  const value = (k: MixKey) => q[k]?.value ?? 0;
  const quadName = (k: MixKey) => (k === "other" ? A.other : t.style.quad[k]);
  const tickers = (keys: MixKey[]) => mix.holdings.filter((h) => keys.includes(h.key)).map((h) => h.ticker);
  const group = (g: Group) => ({
    share: GROUP_QUADS[g].reduce((a, k) => a + share(k), 0),
    value: GROUP_QUADS[g].reduce((a, k) => a + value(k), 0),
  });
  const other = { share: share("other"), value: value("other") };

  const segs: Seg[] = view === "cycle"
    ? (["defensive", "cyclical"] as const).map((g) => ({ key: g, label: A.group[g], ...group(g), color: COLOR[g] }))
    : QUAD_ORDER.map((k) => ({ key: k, label: quadName(k), share: share(k), value: value(k), color: COLOR[k] }));
  if (other.share > 0.0005) segs.push({ key: "other", label: A.other, ...other, color: COLOR.other });
  const aria = A.donutAria(segs.filter((s) => s.share > 0.0005).map((s) => `${s.label} ${pct(s.share, 0, false)}`).join(", "));

  const heavyQuad = mix.quads.find((p) => p.key !== "other" && p.share >= QUAD_HEAVY);
  const sectorName = (k: string) => (k === "other" ? A.otherSector : sector(lang, k));
  const sectors = mix.sectors.filter((s) => s.share >= 0.005);

  return (
    <section className="card acct-mix" aria-labelledby="acct-mix-title">
      <div className="acct-card-head">
        <h2 id="acct-mix-title">{A.title}</h2>
        <span className="chip acct-chip" title={A.basisTitle}>{mix.etfCount ? A.basisEtf(mix.etfCount) : A.basis}</span>
        <div className="seg acct-card-head__seg" role="group" aria-label={A.viewAria}>
          <button type="button" aria-pressed={view === "cycle"} onClick={() => pick("cycle")}>{A.viewCycle}</button>
          <button type="button" aria-pressed={view === "quad"} onClick={() => pick("quad")}>{A.viewQuad}</button>
        </div>
      </div>

      <div className="mixd-body">
        <Donut segs={segs} aria={aria} />
        {view === "cycle" ? (
          <div className="mixd-side">
            <div className="mixd-groups">
              {(["defensive", "cyclical"] as const).map((g) => {
                const [dom, glob] = [`${g}_domestic`, `${g}_global`] as Quad[];
                const names = tickers(GROUP_QUADS[g]);
                return (
                  <div key={g} className={`mixd-group mixd-group--${g}`}>
                    <div className="mixd-group__head">
                      <Dot color={COLOR[g]} />
                      <span>{A.group[g]}</span>
                      <b className="num">{pct(group(g).share, 0, false)}</b>
                    </div>
                    <div className="mixd-group__sub num">{A.regionSplit(pct(share(dom), 0, false), pct(share(glob), 0, false))}</div>
                    <div className="mixd-group__tk" title={names.join(" · ")}>{names.length ? names.join(" · ") : "—"}</div>
                  </div>
                );
              })}
            </div>
            <ul className="mixd-legend">
              {QUAD_ORDER.map((k) => (
                <li key={k}>
                  <Dot color={COLOR[k]} />
                  <span className="mixd-legend__name">{quadName(k)}</span>
                  <span className="num">{pct(share(k), 0, false)}</span>
                </li>
              ))}
              {other.share >= 0.005 && (
                <li>
                  <Dot color={COLOR.other} />
                  <span className="mixd-legend__name">{A.other}</span>
                  <span className="num">{pct(other.share, 0, false)}</span>
                </li>
              )}
            </ul>
          </div>
        ) : (
          <div className="mixd-side">
            <ul className="mixd-quads">
              {[...QUAD_ORDER, ...(other.share >= 0.005 ? (["other"] as const) : [])].map((k) => {
                const names = tickers([k]);
                return (
                  <li key={k} className="mixd-quad">
                    <div className="mixd-quad__head">
                      <Dot color={COLOR[k]} />
                      <span className="mixd-legend__name">{quadName(k)}</span>
                      <b className="num">{pct(share(k), 0, false)}</b>
                    </div>
                    <span className="mixd-quad__bar" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, share(k) * 100)}%`, background: COLOR[k] }} />
                    </span>
                    <div className="mixd-quad__tk">{names.length ? names.join(" · ") : "—"}</div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {view === "quad" && (
        <div className="mixd-more">
          {fill.length > 0 && (
            <>
              <p className="tiny muted mix-fill__h">{A.fillTitle}</p>
              <ul className="mix-fill">
                {fill.map((f) => (
                  <li key={f.quad} className="small">
                    <b>{t.style.quad[f.quad]}</b>{" "}
                    {f.etfs.length ? f.etfs.map((e) => (
                      <Link key={e.ticker} className="chip" href={`/quant/etf#etf-${e.ticker}`} prefetch={false}
                        title={`${e.name ?? e.ticker} — ${t.style.quad[f.quad]} ${pct(e.share, 0, false)}`}>
                        <span className="tick">{e.ticker}</span> <span className="muted">{pct(e.share, 0, false)}</span>
                      </Link>
                    )) : <span className="muted">{A.noFill}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="tiny muted" style={{ margin: "8px 0 0" }}>{A.note}</p>
        </div>
      )}

      <div className="mixd-foot">
        <p className="mixd-sectors">
          <span className="muted">{A.sectorsLabel}:</span>
          {sectors.map((s) => {
            const heavy = s.key !== "other" && s.share >= SECTOR_HEAVY;
            return (
              <span key={s.key} className={`mixd-sec${heavy ? " mixd-sec--heavy" : ""}`} title={heavy ? A.heavySectorTitle : undefined}>
                {sectorName(s.key)} <b className="num">{pct(s.share, 0, false)}</b>
              </span>
            );
          })}
        </p>
        {heavyQuad ? (
          <span className="mixd-status mixd-status--warn">{A.heavyQuad(quadName(heavyQuad.key as MixKey), pct(heavyQuad.share, 0, false))}</span>
        ) : (
          <span className="mixd-status mixd-status--ok" title={A.balancedTitle}>{A.balanced}</span>
        )}
      </div>
      {mix.cadSkipped && <p className="tiny" style={{ margin: "6px 0 0", color: "var(--warn)" }}>{A.cadSkipped}</p>}
    </section>
  );
}
