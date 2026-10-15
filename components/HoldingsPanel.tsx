"use client";

import { useRef, useState } from "react";
import { ChartShot } from "./ChartShot";
import { SellBar, nextChangeText } from "./SellBar";
import { dateKo, dateTimeKo, pct, pp, tone, tvUrl, usd } from "@/lib/format";
import { TIMEFRAME_LABELS, type ChartImages, type Position, type Timeframe } from "@/lib/types";

const VIEW_TFS: Timeframe[] = ["1H", "4H", "Daily", "Weekly", "Monthly"];

type Props = {
  positions: Position[];
  images: Record<string, ChartImages>;
  capturedAt: string | null;
};

function ChartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19 L4 5" />
      <path d="M4 19 L20 19" />
      <path d="M8 15 L12 10 L15 13 L20 7" />
    </svg>
  );
}

/** 보유 종목 표(넓은 화면)·카드(좁은 화면) + 고른 종목의 차트. */
export function HoldingsPanel({ positions, images, capturedAt }: Props) {
  const [sel, setSel] = useState(positions[0]?.ticker ?? "");
  const [tf, setTf] = useState<Timeframe>("Daily");
  const viewerRef = useRef<HTMLElement>(null);

  const pick = (ticker: string) => {
    setSel(ticker);
    viewerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (positions.length === 0) {
    return (
      <section className="card" aria-labelledby="holdings-title">
        <div className="section-head">
          <h2 id="holdings-title">보유 종목</h2>
        </div>
        <p className="muted" style={{ margin: "12px 0 0" }}>
          지금은 보유 종목이 없어요 (현금 100%).
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="card" id="holdings" aria-labelledby="holdings-title">
        <div className="section-head">
          <h2 id="holdings-title">보유 종목</h2>
          <p>▲ 닿으면 익절 · ▼ 닿으면 매도 — 봇이 실제로 쓰는 매도선 (종가 기준)</p>
        </div>

        <div className="table-wrap holdings-table">
          <table className="data-table" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th scope="col">종목</th>
                <th scope="col">매수</th>
                <th scope="col">현재가</th>
                <th scope="col" className="r">
                  수익률
                </th>
                <th scope="col" style={{ paddingLeft: 24 }}>
                  매도선 사이 현재 위치
                </th>
                <th scope="col">다음 변화</th>
                <th scope="col" className="r">
                  차트
                </th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.ticker} data-selected={p.ticker === sel}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="tick" style={{ fontSize: 16 }}>
                        {p.ticker}
                      </span>
                      {p.strategy && <span className="chip">{p.strategy}</span>}
                    </div>
                    <div className="cell-sub">{[p.company, p.sector].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td>
                    <div className="num">{usd(p.entry_price)}</div>
                    <div className="cell-sub">
                      {dateKo(p.entry_date)} · {p.days_held}일째
                    </div>
                  </td>
                  <td>
                    <div className="num" style={{ fontWeight: 600 }}>
                      {usd(p.price)}
                    </div>
                    <div className="cell-sub">고점 {usd(p.highest_price)}</div>
                  </td>
                  <td className="r">
                    <div className={`num ${tone(p.return)}`} style={{ fontWeight: 600, fontSize: 16 }}>
                      {pct(p.return)}
                    </div>
                    <div className="cell-sub">SPY 대비 {pp(p.return, p.spy_return)}</div>
                  </td>
                  <td style={{ paddingLeft: 24 }}>
                    <SellBar pos={p} />
                  </td>
                  <td className="small" style={{ color: "var(--ink-2)" }}>
                    {nextChangeText(p)}
                    {p.defer_count > 0 && <div className="badge badge--warn">보유 연장 {p.defer_count}번</div>}
                  </td>
                  <td className="r">
                    <button type="button" className="btn" aria-pressed={p.ticker === sel}
                      aria-label={`${p.ticker} 차트 보기`} onClick={() => pick(p.ticker)}
                      style={p.ticker === sel ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}>
                      <ChartIcon />
                      보기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="holding-cards">
          {positions.map((p) => (
            <article key={p.ticker} className="holding-card" data-selected={p.ticker === sel}>
              <div className="holding-card__head">
                <span className="tick" style={{ fontSize: 17 }}>
                  {p.ticker}
                </span>
                {p.strategy && <span className="chip">{p.strategy}</span>}
                <span className={`holding-card__ret ${tone(p.return)}`}>{pct(p.return)}</span>
              </div>
              <div className="cell-sub" style={{ marginTop: 2 }}>
                매수 {usd(p.entry_price)} · {p.days_held}일째 · 현재 {usd(p.price)} · SPY 대비{" "}
                {pp(p.return, p.spy_return)}
              </div>
              <SellBar pos={p} />
              <div className="cell-sub" style={{ marginTop: 6 }}>
                {nextChangeText(p)}
              </div>
              <button type="button" className="btn" style={{ width: "100%", marginTop: 10 }}
                onClick={() => pick(p.ticker)} aria-label={`${p.ticker} 차트 보기`}>
                <ChartIcon />
                차트 보기
              </button>
            </article>
          ))}
        </div>

        <div className="legend-row">
          <span className="legend-key">
            <span className="legend-key__dot" aria-hidden="true" />
            현재가
          </span>
          <span className="legend-key">
            <span className="legend-key__tick" aria-hidden="true" />
            매수가
          </span>
          <span>▲는 &apos;여기까지 오른다&apos;는 예측이 아니라 &apos;닿으면 판다&apos;는 선입니다.</span>
        </div>
      </section>

      <section className="card viewer" ref={viewerRef} aria-labelledby="viewer-title" style={{ scrollMarginTop: 16 }}>
        <div className="viewer-head">
          <div>
            <h2 id="viewer-title" style={{ fontSize: 19 }}>
              보유 종목 차트 · <span className="tick">{sel}</span>
            </h2>
            <p className="section-sub" style={{ fontSize: 13 }}>
              매일 새벽 GitHub Actions 가 TradingView 레이아웃으로 찍은 캡처
            </p>
          </div>
          <div className="viewer-controls">
            <div className="seg seg--mono" role="group" aria-label="종목">
              {positions.map((p) => (
                <button key={p.ticker} type="button" aria-pressed={p.ticker === sel} onClick={() => setSel(p.ticker)}>
                  {p.ticker}
                </button>
              ))}
            </div>
            <div className="seg" role="group" aria-label="봉 단위">
              {VIEW_TFS.map((k) => (
                <button key={k} type="button" aria-pressed={k === tf} onClick={() => setTf(k)}>
                  {TIMEFRAME_LABELS[k]}
                </button>
              ))}
            </div>
            <a className="link-strong" href={tvUrl(sel)} target="_blank" rel="noopener noreferrer">
              TradingView ↗
            </a>
          </div>
        </div>
        <figure>
          <ChartShot src={images[sel]?.[tf]} alt={`${sel} ${TIMEFRAME_LABELS[tf]} 차트 (TradingView 캡처)`} />
          <figcaption>{capturedAt ? `${dateTimeKo(capturedAt)} 촬영 (토론토 시각)` : "촬영 시각 정보 없음"}</figcaption>
        </figure>
      </section>
    </>
  );
}
