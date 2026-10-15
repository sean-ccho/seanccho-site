"use client";

import { useMemo, useRef, useState } from "react";
import { ChartShot } from "./ChartShot";
import { dateKo, gradeTone, pct, tone, tvUrl, usd } from "@/lib/format";
import { TIMEFRAME_LABELS, TIMEFRAMES, type Candidate, type ChartImages, type Timeframe } from "@/lib/types";

type Props = { candidates: Candidate[]; images: Record<string, ChartImages> };

type Filter<T extends string> = { value: T; label: string };

const MARKETS: Filter<"all" | "sp500" | "nasdaq">[] = [
  { value: "all", label: "전체" },
  { value: "sp500", label: "S&P 500" },
  { value: "nasdaq", label: "나스닥·NYSE" },
];
const HEALTH: Filter<"all" | "a">[] = [
  { value: "all", label: "전체" },
  { value: "a", label: "A 이상만" },
];

function soon(c: Candidate): boolean {
  return c.days_to_earnings != null && c.days_to_earnings >= 0 && c.days_to_earnings <= 14;
}

/** 후보 목록(왼쪽) + 고른 종목 상세·차트(오른쪽). 좁은 화면에서는 위아래로 쌓인다. */
export function CandidatesView({ candidates, images }: Props) {
  const [market, setMarket] = useState<(typeof MARKETS)[number]["value"]>("all");
  const [health, setHealth] = useState<(typeof HEALTH)[number]["value"]>("all");
  const [strategy, setStrategy] = useState("all");
  const [sel, setSel] = useState(candidates[0]?.ticker ?? "");
  const [tf, setTf] = useState<Timeframe>("Daily");
  const detailRef = useRef<HTMLElement>(null);

  const strategies = useMemo(
    () => Array.from(new Set(candidates.map((c) => c.strategy).filter((s): s is string => Boolean(s)))),
    [candidates],
  );
  const rows = candidates.filter(
    (c) =>
      (market === "all" || c.market === market) &&
      (health === "all" || gradeTone(c.health?.grade) === "good") &&
      (strategy === "all" || c.strategy === strategy),
  );
  const cur = rows.find((c) => c.ticker === sel) ?? rows[0] ?? null;

  const pick = (ticker: string) => {
    setSel(ticker);
    if (window.matchMedia("(max-width: 940px)").matches) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <>
      <section className="card filters" aria-label="필터">
        <div className="pills" role="group" aria-label="시장">
          <span className="pills__label">시장</span>
          {MARKETS.map((f) => (
            <button key={f.value} type="button" className="pill" aria-pressed={market === f.value}
              onClick={() => setMarket(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="pills" role="group" aria-label="헬스체크">
          <span className="pills__label">헬스체크</span>
          {HEALTH.map((f) => (
            <button key={f.value} type="button" className="pill" aria-pressed={health === f.value}
              onClick={() => setHealth(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="pills" role="group" aria-label="전략">
          <span className="pills__label">전략</span>
          {["all", ...strategies].map((s) => (
            <button key={s} type="button" className="pill" aria-pressed={strategy === s} onClick={() => setStrategy(s)}>
              {s === "all" ? "전체" : s}
            </button>
          ))}
        </div>
        <div className="filters__count" role="status">
          <span className="num" style={{ fontWeight: 600 }}>
            {rows.length}
          </span>
          개 표시 · 전체 {candidates.length}개
        </div>
      </section>

      <div className="cand-layout">
        <section className="card cand-list" aria-label="후보 목록">
          {rows.length === 0 && <p className="empty">조건에 맞는 후보가 없어요. 필터를 바꿔 보세요.</p>}
          {rows.map((c) => (
            <button key={c.ticker} type="button" className="cand-item" aria-pressed={cur?.ticker === c.ticker}
              onClick={() => pick(c.ticker)}>
              <span className="num small muted">{candidates.indexOf(c) + 1}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span className="tick" style={{ fontSize: 15 }}>
                    {c.ticker}
                  </span>
                  <span className="cand-item__name">{c.company}</span>
                </span>
                <span className="cand-item__badges">
                  {c.strategy && <span className="chip">{c.strategy}</span>}
                  {c.health && (
                    <span className={`badge badge--${gradeTone(c.health.grade)}`}>
                      {c.health.score} · {c.health.grade}
                    </span>
                  )}
                  {soon(c) && <span className="badge badge--warn">실적 임박</span>}
                  {c.held && <span className="badge badge--held">보유 중</span>}
                </span>
              </span>
              <span className="num" style={{ fontWeight: 600 }}>
                ★ {c.score?.toFixed(1) ?? "—"}
              </span>
            </button>
          ))}
        </section>

        {cur && (
          <section className="card cand-detail" ref={detailRef} aria-labelledby="detail-title" style={{ scrollMarginTop: 16 }}>
            <div className="chart-section__head">
              <h2 id="detail-title" className="tick" style={{ fontSize: 26 }}>
                {cur.ticker}
              </h2>
              <span style={{ color: "var(--ink-2)" }}>{cur.company}</span>
              {cur.held && <span className="badge badge--held">보유 중</span>}
              <span className="chart-section__price">
                <span className="num" style={{ fontSize: 22, fontWeight: 600 }}>
                  {usd(cur.price)}
                </span>
              </span>
            </div>
            <div className="small muted" style={{ marginTop: 2 }}>
              {[cur.sector, cur.market_cap && `시총 ${cur.market_cap}`, cur.strategy, cur.action]
                .filter(Boolean)
                .join(" · ")}
            </div>

            <dl className="stats">
              <div className="stat">
                <dt>매수 적합도</dt>
                <dd className="num">★ {cur.score?.toFixed(1) ?? "—"}</dd>
              </div>
              <div className="stat">
                <dt>헬스체크</dt>
                <dd>
                  {cur.health ? (
                    <span className={`badge badge--${gradeTone(cur.health.grade)}`} style={{ fontSize: 14 }}>
                      {cur.health.score} · {cur.health.grade}
                    </span>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="stat">
                <dt>RSI</dt>
                <dd className="num" style={{ color: (cur.rsi ?? 0) >= 70 ? "var(--warn)" : undefined }}>
                  {cur.rsi?.toFixed(0) ?? "—"}
                  {(cur.rsi ?? 0) >= 70 ? " 과열" : ""}
                </dd>
              </div>
              <div className="stat">
                <dt>20일 수익률</dt>
                <dd className={`num ${tone(cur.ret_20d)}`}>{pct(cur.ret_20d)}</dd>
              </div>
              <div className="stat">
                <dt>다음 실적</dt>
                <dd style={{ color: soon(cur) ? "var(--warn)" : undefined }}>
                  {cur.earnings_date
                    ? `${dateKo(cur.earnings_date)}${cur.days_to_earnings != null ? ` (${cur.days_to_earnings}일 후)` : ""}`
                    : "미정"}
                </dd>
              </div>
            </dl>
            {cur.health?.detail && <p className="small muted" style={{ margin: "8px 0 0" }}>재무: {cur.health.detail}</p>}

            <div className="small" style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: "2px 18px" }}>
              <span>
                <span className="muted">일봉 패턴</span> {cur.patterns.daily.join(" · ") || "—"}
              </span>
              <span>
                <span className="muted">주봉 패턴</span> {cur.patterns.weekly.join(" · ") || "—"}
              </span>
            </div>

            <div className="viewer-head" style={{ marginTop: 16 }}>
              <div className="seg" role="group" aria-label="봉 단위">
                {TIMEFRAMES.map((k) => (
                  <button key={k} type="button" aria-pressed={k === tf} onClick={() => setTf(k)}>
                    {TIMEFRAME_LABELS[k]}
                  </button>
                ))}
              </div>
              <a className="link-strong" href={tvUrl(cur.ticker)} target="_blank" rel="noopener noreferrer">
                TradingView에서 열기 ↗
              </a>
            </div>
            <figure style={{ margin: "10px 0 0" }}>
              <ChartShot src={images[cur.ticker]?.[tf]} alt={`${cur.ticker} ${TIMEFRAME_LABELS[tf]} 차트 (TradingView 캡처)`} />
            </figure>
          </section>
        )}
      </div>
    </>
  );
}
