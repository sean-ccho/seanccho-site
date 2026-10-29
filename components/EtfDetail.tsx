"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AboutText } from "./CompanyAbout";
import { useT } from "./LangProvider";
import type { About } from "@/lib/about";
import type { EtfDetail, EtfItem, EtfTwin } from "@/lib/etf";
import { bigUsd, pct, stockHref } from "@/lib/format";
import { sector } from "@/lib/i18n";

type Got = { detail: EtfDetail | null; about: About | null } | "error";
const cache = new Map<string, Got>(); // 같은 ETF 를 다시 펼치면 다시 받지 않는다 (화면 이동 전까지)

const ASSET_KEYS = ["stock", "bond", "cash", "other"] as const;
const RATING_KEYS = ["aaa", "aa", "a", "bbb", "bb", "b", "below_b", "other"] as const;
// 미국 밖 · 캐나다 ETF 가 담은 종목은 우리 종목 화면이 없다 (2330.TW · RY …) → 링크 없이 이름만
const NO_STOCK_PAGE = new Set(["international", "canada"]);
const US_SYMBOL = /^[A-Z]{1,5}(?:[.-][A-Z])?$/;

/** 운용자산 — 'US$809B' · 'C$22.6B' (그 ETF 통화). */
export function etfMoney(v: number | null, currency: string | null): string {
  if (v == null) return "—";
  const s = bigUsd(v);
  return currency === "CAD" ? s.replace("$", "C$") : s;
}

/** 가로 막대 한 줄 — 이름 · 막대 · 비중. */
function Bar({ label, w, max, title }: { label: React.ReactNode; w: number; max: number; title?: string }) {
  return (
    <div className="etf-bar" title={title}>
      <span className="etf-bar__label">{label}</span>
      <span className="etf-bar__track" aria-hidden="true">
        <span className="etf-bar__fill" style={{ width: `${Math.min(100, (w / (max || 1)) * 100)}%` }} />
      </span>
      <span className="etf-bar__v num">{pct(w, 1, false)}</span>
    </div>
  );
}

/** 같은 지수 · 비슷한 것 — 보수와 함께, 가장 싼 것에 표시. 누르면 그 줄을 연다. */
function TwinLine({ item, twin, byTicker, onOpen }: {
  item: EtfItem; twin: EtfTwin; byTicker: Map<string, EtfItem>; onOpen: (t: string) => void;
}) {
  const { lang, t } = useT();
  const E = t.etf;
  const members = twin.tickers.map((tk) => byTicker.get(tk)).filter((r): r is EtfItem => !!r);
  const fees = members.map((r) => r.expense).filter((v): v is number => v != null);
  const low = fees.length ? Math.min(...fees) : null;
  return (
    <p className="small etf-twins">
      <span className="muted">{twin.kind === "same" ? E.twin.same : E.twin.similar} · {lang === "en" ? twin.en : twin.ko}:</span>{" "}
      {members.map((r, i) => (
        <span key={r.ticker}>
          {i > 0 && " · "}
          {r.ticker === item.ticker ? (
            <b className="tick">{r.ticker}</b>
          ) : (
            <button type="button" className="etf-link tick" onClick={() => onOpen(r.ticker)} title={E.detail.openEtf(r.ticker)}>
              {r.ticker}
            </button>
          )}{" "}
          <span className="num">{pct(r.expense, 2, false)}</span>
          {low != null && r.expense != null && r.expense - low < 0.00005 && (
            <span className="badge badge--good etf-twins__low">{E.twin.cheapest}</span>
          )}
        </span>
      ))}
    </p>
  );
}

/**
 * ETF 줄을 펼치면 차트 위에 보이는 상세 — 설명(기계번역) · 사실 · 같은 것 · 상위 10개 보유 종목 · 섹터 비중 · 자산 구성 · 채권 등급.
 * 데이터는 /api/etf/[티커] (Project_1 밤 실행의 etf_detail.json, Yahoo funds_data).
 */
export function EtfDetailPanel({ item, twin, byTicker, onOpen }: {
  item: EtfItem; twin?: EtfTwin; byTicker: Map<string, EtfItem>; onOpen: (t: string) => void;
}) {
  const { lang, t } = useT();
  const E = t.etf;
  const D = E.detail;
  const key = `${lang}:${item.ticker}`;
  const [got, setGot] = useState<{ key: string; v: Got } | null>(null);
  const cached = cache.get(key);

  useEffect(() => {
    if (cache.has(key)) return;
    const ctl = new AbortController();
    fetch(`/api/etf/${encodeURIComponent(item.ticker)}?lang=${lang}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { detail: EtfDetail | null; about: About | null }) => {
        cache.set(key, j);
        setGot({ key, v: j });
      })
      .catch(() => {
        if (!ctl.signal.aborted) setGot({ key, v: "error" }); // 실패는 저장하지 않는다 — 다시 펼치면 다시 받는다
      });
    return () => ctl.abort();
  }, [key, item.ticker, lang]);

  const v = cached ?? (got?.key === key ? got.v : null);
  const detail = v && v !== "error" ? v.detail : null;
  const facts: [string, string, string?][] = [
    [D.family, item.family ?? "—"],
    [D.inception, item.inception ?? "—"],
    [E.colExpense, pct(item.expense, 2, false), E.help.expense],
    [E.colAum, etfMoney(item.aum, item.currency), E.help.aum],
    [E.colYield, pct(item.yield, 1, false), E.help.yield],
    [D.top10, pct(item.top10_weight ?? null, 1, false), D.top10Help],
  ];
  const sectors = Object.entries(detail?.sectors ?? {}).sort((a, b) => b[1] - a[1]);
  const holdings = detail?.holdings ?? [];
  const topW = Math.max(0, ...holdings.map((h) => h.w));
  const linkable = !NO_STOCK_PAGE.has(item.group) && !item.ticker.endsWith(".TO");

  return (
    <div className="etf-detail">
      <div className="etf-detail__head">
        <p className="etf-detail__name">
          <b className="tick">{item.ticker}</b> {item.name ?? ""}
          {item.category && <span className="muted small"> · {item.category}</span>}
        </p>
        <dl className="etf-facts">
          {facts.map(([k, val, help]) => (
            <div key={k} title={help}>
              <dt>{k}</dt>
              <dd className="num">{val}</dd>
            </div>
          ))}
        </dl>
        {twin && <TwinLine item={item} twin={twin} byTicker={byTicker} onOpen={onOpen} />}
      </div>

      {v == null && <p className="small muted">{D.loading}</p>}
      {v === "error" && <p className="small muted">{D.error}</p>}
      {v && v !== "error" && !detail && <p className="small muted">{D.none}</p>}
      {v && v !== "error" && v.about && (
        <div className="about">
          <AboutText about={v.about} />
        </div>
      )}

      {detail && (
        <div className="etf-detail__grid">
          <section aria-label={D.holdings}>
            <h3 className="etf-detail__h">{D.holdings}</h3>
            {holdings.length ? (
              <ol className="etf-holdings">
                {holdings.map((h) => {
                  const etf = byTicker.get(h.s);
                  const label = etf ? (
                    <button type="button" className="etf-link tick" onClick={() => onOpen(h.s)} title={D.openEtf(h.s)}>{h.s}</button>
                  ) : linkable && US_SYMBOL.test(h.s) ? (
                    <Link className="tick" href={stockHref(h.s)} prefetch={false}>{h.s}</Link>
                  ) : (
                    <span className="tick">{h.s}</span>
                  );
                  return (
                    <li key={h.s}>
                      <Bar label={<>{label} <span className="muted etf-bar__name">{h.n ?? ""}</span></>} w={h.w} max={topW}
                        title={h.n ?? undefined} />
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="small muted">{D.noHoldings}</p>
            )}
          </section>
          <section aria-label={D.sectors}>
            {detail.assets && (
              <>
                <h3 className="etf-detail__h">{D.assets}</h3>
                <div className="etf-mix" role="img"
                  aria-label={ASSET_KEYS.map((k) => `${D.assetKeys[k]} ${pct(detail.assets![k], 0, false)}`).join(", ")}>
                  {ASSET_KEYS.filter((k) => detail.assets![k] > 0.001).map((k) => (
                    <span key={k} className={`etf-mix__seg etf-mix__seg--${k}`} style={{ flexGrow: detail.assets![k] }}
                      title={`${D.assetKeys[k]} ${pct(detail.assets![k], 1, false)}`} />
                  ))}
                </div>
                <p className="tiny muted etf-mix__legend">
                  {ASSET_KEYS.filter((k) => detail.assets![k] > 0.001).map((k) => (
                    <span key={k}><i className={`etf-mix__dot etf-mix__seg--${k}`} aria-hidden="true" />{D.assetKeys[k]} {pct(detail.assets![k], 1, false)}</span>
                  ))}
                </p>
              </>
            )}
            {sectors.length > 0 && (
              <>
                <h3 className="etf-detail__h">{D.sectors}</h3>
                {sectors.map(([s, w]) => <Bar key={s} label={sector(lang, s)} w={w} max={sectors[0][1]} />)}
              </>
            )}
            {detail.ratings && (
              <>
                <h3 className="etf-detail__h">{D.ratings}</h3>
                {RATING_KEYS.filter((k) => (detail.ratings![k] ?? 0) > 0.0005).map((k) => (
                  <Bar key={k} label={D.ratingKeys[k]} w={detail.ratings![k]} max={1} />
                ))}
                {detail.ratings.us_government != null && (
                  <p className="tiny muted">{D.usGov(pct(detail.ratings.us_government, 1, false))}</p>
                )}
              </>
            )}
          </section>
        </div>
      )}
      {detail && <p className="tiny muted" style={{ margin: "8px 0 0" }}>{D.source}</p>}
    </div>
  );
}
