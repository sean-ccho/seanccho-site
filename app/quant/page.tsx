import Link from "next/link";
import { EquityChart } from "@/components/EquityChart";
import { ExitReasons } from "@/components/ExitReasons";
import { HoldingsPanel } from "@/components/HoldingsPanel";
import { NoData } from "@/components/NoData";
import { TradeStrip } from "@/components/TradeStrip";
import { chartIndex, getDashboard, latestCapture } from "@/lib/dashboard";
import { dateKo, gradeTone, pct, pp, tone, usd } from "@/lib/format";
import type { Account, Position } from "@/lib/types";

export const revalidate = 1800;

const NEAR = 0.03; // 매도선·익절선까지 3% 안이면 알림

type Alert = { ticker: string; text: string };

function alertsFor(positions: Position[]): Alert[] {
  const out: Alert[] = [];
  for (const p of positions) {
    if (p.price == null) continue;
    const { down, up, down_tag, up_tag } = p.exit;
    if (down != null && p.price <= down) {
      out.push({
        ticker: p.ticker,
        text: `현재가 ${usd(p.price)}가 이미 ▼ ${usd(down)} (${down_tag}) 아래 — 종가가 이대로면 다음 실행에서 매도`,
      });
    } else if (down != null && down / p.price - 1 > -NEAR) {
      out.push({
        ticker: p.ticker,
        text: `▼ ${usd(down)} (${down_tag})까지 ${pct(down / p.price - 1)} — 종가가 닿으면 매도`,
      });
    }
    if (up != null && p.price >= up) {
      out.push({
        ticker: p.ticker,
        text: `현재가 ${usd(p.price)}가 이미 ▲ ${usd(up)} (${up_tag}) 위 — 종가가 이대로면 익절 (상승세가 강하면 더 들고 갈 수도 있음)`,
      });
    } else if (up != null && up / p.price - 1 < NEAR) {
      out.push({
        ticker: p.ticker,
        text: `▲ ${usd(up)} (${up_tag})까지 ${pct(up / p.price - 1)} — 종가가 닿으면 익절 (상승세가 강하면 더 들고 갈 수도 있음)`,
      });
    }
  }
  return out;
}

function AccountRow({ acct }: { acct: Account }) {
  const d = acct.dollar;
  const t = acct.trades;
  return (
    <tr>
      <th scope="row" style={{ fontWeight: 600, color: "var(--ink)", fontSize: 14 }}>
        {acct.label}
      </th>
      <td>{d ? dateKo(d.start) : "—"}</td>
      <td className="r num">{d ? usd(d.equity, 0) : "$5,000"}</td>
      <td className={`r num ${tone(d?.return)}`}>{d ? pct(d.return) : "—"}</td>
      <td className="r num">{d ? `${usd(d.spy_equity, 0)} (${pct(d.spy_return)})` : "—"}</td>
      <td className={`r num ${d && d.return != null && d.spy_return != null ? tone(d.return - d.spy_return) : ""}`}>
        {d ? pp(d.return, d.spy_return) : "—"}
      </td>
      <td>
        {acct.positions.length ? (
          <span className="tick small">{acct.positions.map((p) => p.ticker).join(" · ")}</span>
        ) : (
          <span className="muted">없음</span>
        )}
      </td>
      <td className="r num">
        {t.count}건{t.win_rate != null ? ` · ${pct(t.win_rate, 0, false)}` : ""}
      </td>
    </tr>
  );
}

export default async function TodayPage() {
  const data = await getDashboard();
  if (!data) return <NoData />;

  const main = data.accounts[0];
  const others = data.accounts.slice(1);
  const d = main.dollar;
  const t = main.trades;
  const alerts = alertsFor(main.positions);
  const images = chartIndex(data);
  const gap = d && d.return != null && d.spy_return != null ? d.return - d.spy_return : null;

  return (
    <main className="container page">
      <div className="page-title">
        <h1>오늘의 포트폴리오</h1>
        <p>
          {main.label} 페이퍼 트레이딩 · 최대 {data.max_positions}종목 중 {main.positions.length}종목 보유
        </p>
      </div>

      {alerts.length > 0 && (
        <section className="card callout" aria-labelledby="alert-title">
          <div className="callout__icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3 L22 20 L2 20 Z" />
              <path d="M12 10 L12 14" />
              <path d="M12 17 L12 17.01" />
            </svg>
          </div>
          <div className="callout__body">
            <h2 id="alert-title">매도선·익절선 근처 종목 {new Set(alerts.map((a) => a.ticker)).size}개</h2>
            <ul>
              {alerts.map((a) => (
                <li key={a.ticker + a.text}>
                  <span className="tick">{a.ticker}</span> {a.text}
                </li>
              ))}
            </ul>
          </div>
          <a className="btn" href="#holdings">
            보유 종목 보기
          </a>
        </section>
      )}

      <section className="tiles" aria-label="요약">
        <div className="card tile">
          <div className="tile__label">$5,000 계좌 평가액</div>
          <div className="tile__value">{d ? usd(d.equity, 0) : "—"}</div>
          <div className="tile__sub">
            {d ? (
              <>
                <span className={tone(d.return)}>{pct(d.return)}</span> · {dateKo(d.start)} 시작
              </>
            ) : (
              "계산 정보 없음"
            )}
          </div>
        </div>
        <div className="card tile">
          <div className="tile__label">같은 날 SPY를 샀다면</div>
          <div className="tile__value">{d ? usd(d.spy_equity, 0) : "—"}</div>
          <div className="tile__sub">
            {d ? (
              <>
                {pct(d.spy_return)} · SPY 대비 <span className={tone(gap)}>{pp(d.return, d.spy_return)}</span>
              </>
            ) : (
              "—"
            )}
          </div>
        </div>
        <div className="card tile">
          <div className="tile__label">보유 종목</div>
          <div className="tile__value">
            {main.positions.length}
            <span className="muted" style={{ fontSize: 18, fontWeight: 500 }}>
              {" "}
              / {data.max_positions}
            </span>
          </div>
          <div className="tile__sub">현금 {d ? usd(d.cash, 0) : "—"}</div>
        </div>
        <div className="card tile">
          <div className="tile__label">청산 승률</div>
          <div className="tile__value">{t.win_rate != null ? pct(t.win_rate, 1, false) : "—"}</div>
          <div className="tile__sub">
            {t.count}건 중 {t.wins}승 · 건당 평균 <span className={tone(t.avg_return)}>{pct(t.avg_return, 2)}</span>
          </div>
        </div>
      </section>

      {d && (
        <section className="card" aria-labelledby="equity-title">
          <h2 id="equity-title" style={{ fontSize: 19 }}>
            $5,000 계좌 vs 같은 날 SPY
          </h2>
          <p className="section-sub">
            {gap != null && gap < 0
              ? `지금 SPY보다 ${usd((d.spy_equity ?? 0) - (d.equity ?? 0), 0)} 적어요 (${pp(d.return, d.spy_return)})`
              : `지금 SPY보다 ${usd((d.equity ?? 0) - (d.spy_equity ?? 0), 0)} 많아요 (${pp(d.return, d.spy_return)})`}
            {" · "}최대 낙폭 {pct(d.mdd)} (SPY {pct(d.spy_mdd)})
          </p>
          <EquityChart curve={d.curve} initial={d.initial} />
          <p className="tiny muted" style={{ margin: "8px 0 0" }}>
            PT-1이 실제로 사고판 종목·날짜·가격 그대로, 빈 자리마다 남은 현금을 똑같이 나눠 정수 주식만 산 것으로 계산 (편도 비용 0.1%).
          </p>
        </section>
      )}

      <HoldingsPanel positions={main.positions} images={images} capturedAt={latestCapture(data)} />

      <div className="row">
        <section className="card" aria-labelledby="reasons-title">
          <h2 id="reasons-title" style={{ fontSize: 19 }}>
            청산 이유별 평균 수익률
          </h2>
          <p className="section-sub">어떤 이유로 팔았을 때 벌고 잃었는지</p>
          <ExitReasons trades={t} />
        </section>
        <section className="card" aria-labelledby="trades-title">
          <h2 id="trades-title" style={{ fontSize: 19 }}>
            거래별 수익률
          </h2>
          <p className="section-sub">
            막대 하나가 청산 1건 · 승률 {t.win_rate != null ? pct(t.win_rate, 1, false) : "—"}
          </p>
          <TradeStrip history={t.history} />
        </section>
      </div>

      {others.length > 0 && (
        <section className="card" aria-labelledby="accounts-title">
          <div className="section-head">
            <h2 id="accounts-title">같은 규칙의 다른 계좌</h2>
            <p>모두 $5,000에서 시작해 같은 날 SPY를 샀을 때와 비교</p>
          </div>
          <div className="table-wrap">
            <table className="data-table" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th scope="col">계좌</th>
                  <th scope="col">시작</th>
                  <th scope="col" className="r">평가액</th>
                  <th scope="col" className="r">수익률</th>
                  <th scope="col" className="r">같은 날 SPY</th>
                  <th scope="col" className="r">SPY 대비</th>
                  <th scope="col">보유</th>
                  <th scope="col" className="r">청산 · 승률</th>
                </tr>
              </thead>
              <tbody>
                {data.accounts.map((a) => (
                  <AccountRow key={a.key} acct={a} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card" aria-labelledby="cands-title">
        <div className="section-head">
          <h2 id="cands-title">오늘의 매수 후보 상위 5</h2>
          <Link className="link-strong" href="/quant/candidates">
            후보 {data.candidates.length}개와 차트 보기 →
          </Link>
        </div>
        <div className="table-wrap">
          <table className="data-table" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th scope="col">순위</th>
                <th scope="col">종목</th>
                <th scope="col" className="r">가격</th>
                <th scope="col" className="r">매수 적합도</th>
                <th scope="col">헬스체크</th>
                <th scope="col">다음 실적</th>
              </tr>
            </thead>
            <tbody>
              {data.candidates.slice(0, 5).map((c, i) => (
                <tr key={c.ticker}>
                  <td className="num muted">{i + 1}</td>
                  <td>
                    <span className="tick">{c.ticker}</span>{" "}
                    <span className="small muted">{c.company}</span>{" "}
                    {c.held && <span className="badge badge--held">보유 중</span>}
                  </td>
                  <td className="r num">{usd(c.price)}</td>
                  <td className="r num" style={{ fontWeight: 600 }}>
                    ★ {c.score?.toFixed(1) ?? "—"}
                  </td>
                  <td>
                    {c.health ? (
                      <span className={`badge badge--${gradeTone(c.health.grade)}`}>
                        {c.health.score} · {c.health.grade}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="small">
                    {c.earnings_date ? dateKo(c.earnings_date) : "미정"}{" "}
                    {c.days_to_earnings != null && c.days_to_earnings <= 14 && (
                      <span className="badge badge--warn">실적 임박</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="site-footer">
        매일 GitHub Actions 실행이 끝나면 결과 파일(JSON)과 차트 캡처를 읽어 보여 주는 읽기 전용 화면입니다 ·
        데이터 생성 {data.generated_at.slice(0, 16).replace("T", " ")} (토론토)
      </footer>
    </main>
  );
}
