"use client";

import { useDeferredValue, useState } from "react";
import { dateKo, gradeTone, pct, tone, tvUrl, usd } from "@/lib/format";
import { TIMEFRAME_LABELS, TIMEFRAMES, type ChartItem, type ChartMarket, type Timeframe } from "@/lib/types";

type Sort = "default" | "score" | "ticker";

const SORTS: { value: Sort; label: string }[] = [
  { value: "default", label: "시트 순서" },
  { value: "score", label: "점수순" },
  { value: "ticker", label: "티커순" },
];

function anchorId(ticker: string): string {
  return `c-${ticker.replace(/[^A-Za-z0-9]/g, "-")}`;
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12 L10 17 L19 7" />
    </svg>
  );
}

function Meta({ item }: { item: ChartItem }) {
  const i = item.info;
  if (!i) {
    return (
      <p className="small muted" style={{ margin: "6px 0 0" }}>
        스크리너 요약 없음 — 시트에 늘 넣는 고정 종목이거나 오늘 랭킹에 없는 종목이에요
      </p>
    );
  }
  const soon = i.days_to_earnings != null && i.days_to_earnings >= 0 && i.days_to_earnings <= 14;
  return (
    <>
      <div className="chart-meta">
        {i.verdict && <span className="chip">{i.verdict}</span>}
        <span className="chip">
          {i.strategy ?? "전략 없음"} <span className="num" style={{ fontWeight: 600, color: "var(--ink)" }}>★ {i.score?.toFixed(1) ?? "—"}</span>
        </span>
        {i.health && (
          <span className={`badge badge--${gradeTone(i.health.grade)}`}>
            헬스 {i.health.score} · {i.health.grade}
          </span>
        )}
        <span className="chip">
          RSI <span className="num" style={{ fontWeight: 600, color: (i.rsi ?? 0) >= 70 ? "var(--warn)" : "var(--ink)" }}>{i.rsi?.toFixed(0) ?? "—"}</span>
        </span>
        <span className="chip">
          20일 <span className={`num ${tone(i.ret_20d)}`} style={{ fontWeight: 600 }}>{pct(i.ret_20d)}</span>
        </span>
        <span className="chip" style={soon ? { color: "var(--warn)", borderColor: "var(--warn)" } : undefined}>
          실적 {i.earnings_date ? dateKo(i.earnings_date) : "미정"}
          {i.days_to_earnings != null && i.earnings_date ? ` (${i.days_to_earnings}일 후)` : ""}
        </span>
        {i.market_cap && <span className="chip">시총 {i.market_cap}</span>}
      </div>
      <div className="small" style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: "2px 18px", color: "var(--ink-2)" }}>
        <span>
          <span className="muted">일봉 패턴</span> {i.patterns.daily.join(" · ") || "—"}
        </span>
        <span>
          <span className="muted">주봉 패턴</span> {i.patterns.weekly.join(" · ") || "—"}
        </span>
      </div>
    </>
  );
}

/** 구글 시트 '차트분석' 탭처럼 종목별 차트를 아래로 쭉 — 시장·범위·정렬·봉·검색. */
export function ChartsView({ markets }: { markets: ChartMarket[] }) {
  const [marketKey, setMarketKey] = useState(markets[0]?.key ?? "");
  const [heldOnly, setHeldOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("default");
  const [tfs, setTfs] = useState<Timeframe[]>(["Daily", "Weekly"]);
  const [q, setQ] = useState("");
  const [big, setBig] = useState("");
  const query = useDeferredValue(q.trim().toUpperCase());

  const market = markets.find((m) => m.key === marketKey) ?? markets[0];
  if (!market) return <p className="card empty">오늘 캡처된 차트가 없어요.</p>;

  let items = market.items.filter(
    (it) =>
      (!heldOnly || it.held) &&
      (!query || it.ticker.toUpperCase().includes(query) || (it.info?.company ?? "").toUpperCase().includes(query)),
  );
  if (sort === "score") items = [...items].sort((a, b) => (b.info?.score ?? -1) - (a.info?.score ?? -1));
  if (sort === "ticker") items = [...items].sort((a, b) => a.ticker.localeCompare(b.ticker));
  const shownTfs = TIMEFRAMES.filter((k) => tfs.includes(k));

  const toggleTf = (k: Timeframe) => {
    const next = tfs.includes(k) ? tfs.filter((x) => x !== k) : [...tfs, k];
    if (next.length > 0) setTfs(next);
  };

  return (
    <>
      <section className="card controls" aria-label="보기 설정">
        <div className="controls__row">
          <div className="seg" role="group" aria-label="시장">
            {markets.map((m) => (
              <button key={m.key} type="button" aria-pressed={m.key === market.key} onClick={() => setMarketKey(m.key)}>
                {m.label} · {m.items.length}
              </button>
            ))}
          </div>
          <div className="pills" role="group" aria-label="종목 범위">
            <button type="button" className="pill" aria-pressed={!heldOnly} onClick={() => setHeldOnly(false)}>
              전체
            </button>
            <button type="button" className="pill" aria-pressed={heldOnly} onClick={() => setHeldOnly(true)}>
              보유 종목만
            </button>
          </div>
          <div className="pills" role="group" aria-label="정렬">
            <span className="pills__label">정렬</span>
            {SORTS.map((s) => (
              <button key={s.value} type="button" className="pill" aria-pressed={sort === s.value} onClick={() => setSort(s.value)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="controls__row">
          <div className="pills" role="group" aria-label="보여 줄 봉">
            <span className="pills__label">보여 줄 봉</span>
            {TIMEFRAMES.map((k) => (
              <button key={k} type="button" className="pill" aria-pressed={tfs.includes(k)} onClick={() => toggleTf(k)}>
                {tfs.includes(k) && <CheckIcon />}
                {TIMEFRAME_LABELS[k]}
              </button>
            ))}
          </div>
          <div className="search">
            <label htmlFor="chart-search" className="small muted">
              검색
            </label>
            <input id="chart-search" className="input" type="search" value={q} placeholder="티커나 회사 이름"
              onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </section>

      <details className="card" style={{ padding: "12px 20px" }}>
        <summary className="small" style={{ cursor: "pointer", minHeight: 32, display: "flex", alignItems: "center" }}>
          종목 바로가기 · <span className="num" style={{ fontWeight: 600, margin: "0 2px" }}>{items.length}</span>종목
        </summary>
        <nav className="jump" aria-label="종목 바로가기" style={{ marginTop: 10 }}>
          {items.map((it) => (
            <a key={it.ticker} href={`#${anchorId(it.ticker)}`} data-held={it.held}>
              {it.ticker}
            </a>
          ))}
        </nav>
      </details>

      {items.length === 0 && <p className="card empty">조건에 맞는 종목이 없어요. 시장이나 범위를 바꿔 보세요.</p>}

      {items.map((it) => (
        <section key={it.ticker} id={anchorId(it.ticker)} className="card chart-section" aria-labelledby={`${anchorId(it.ticker)}-t`}>
          <div className="chart-section__head">
            <h2 id={`${anchorId(it.ticker)}-t`}>{it.ticker}</h2>
            {it.info?.company && <span style={{ color: "var(--ink-2)", fontSize: 14 }}>{it.info.company}</span>}
            {it.held && <span className="badge badge--held">보유 중</span>}
            <span className="chart-section__price">
              {it.info?.price != null && (
                <span className="num" style={{ fontSize: 18, fontWeight: 600 }}>
                  {usd(it.info.price)}
                </span>
              )}
              <a className="small" style={{ fontWeight: 600, textDecoration: "none" }} href={tvUrl(it.ticker)}
                target="_blank" rel="noopener noreferrer">
                TradingView ↗
              </a>
            </span>
          </div>
          <Meta item={it} />
          <div className="chart-grid">
            {shownTfs.map((k) => {
              const key = `${it.ticker}|${k}`;
              const isBig = big === key;
              const src = it.images[k];
              return (
                <figure key={k} data-big={isBig}>
                  <figcaption>
                    <span>{TIMEFRAME_LABELS[k]}</span>
                    {src && <span className="tiny muted" style={{ fontWeight: 500 }}>{isBig ? "누르면 작게" : "누르면 크게"}</span>}
                  </figcaption>
                  {src ? (
                    <button type="button" className="shot" data-big={isBig} onClick={() => setBig(isBig ? "" : key)}
                      aria-label={`${it.ticker} ${TIMEFRAME_LABELS[k]} ${isBig ? "작게" : "크게"} 보기`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- GitHub raw 이미지를 그대로 쓴다 */}
                      <img src={src} alt={`${it.ticker} ${TIMEFRAME_LABELS[k]} 차트 (TradingView 캡처)`} loading="lazy" decoding="async" />
                    </button>
                  ) : (
                    <div className="shot-missing">캡처 없음</div>
                  )}
                </figure>
              );
            })}
          </div>
        </section>
      ))}

      <a className="btn to-top" href="#top">
        맨 위로 ↑
      </a>
    </>
  );
}
