import { TickerLink } from "./TickerLink";
import { fmtDate, money, pct, tone } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import type { Gate, ValueModel, VmRow, VmSummary, VmTrack } from "@/lib/valueModel";

/**
 * 내계좌 › 예측 모델 — 맨 아래 '우리 커버리지' (2026-11-11). 저자(Baoro)가 자기 로직에 맞는 종목을 커버리지로 올리듯,
 * 같은 기준(품질 관문 5개 + 가격 관문)을 매일 밤 S&P 500 + 저자 종목에 돌린 결과 · 저자 커버리지와의 비교 · 앞으로 기록.
 * 데이터: lib/valueModel.ts (universe-data 의 value_model.json, 없으면 스냅샷).
 */

const GATES = [
  ["roe", "ROE"], ["roic", "ROIC"], ["z", "Z"], ["m", "M"], ["fcf", "FCF"], ["price", "가격"],
] as const;

function Mark({ g }: { g: Gate | undefined }) {
  if (g === true) return <span className="vm-gate vm-gate--ok" title="통과">✓</span>;
  if (g === false) return <span className="vm-gate vm-gate--no" title="탈락">✗</span>;
  return <span className="vm-gate vm-gate--na" title="판단 불가 — 통과로 친다">–</span>;
}

/** 0.06 → '+6.0%p' (알파처럼 %p 로 읽는 값). */
function ppv(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v * 100).toFixed(1);
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${a}%p`;
}

const plain = (v: number | null | undefined) => pct(v, 1, false);

function Gates({ r }: { r: VmRow | undefined }) {
  return (
    <>
      {GATES.map(([k]) => (
        <td key={k} className="vm-gate-cell">{r ? <Mark g={r.gates[k]} /> : <span className="muted">·</span>}</td>
      ))}
    </>
  );
}

function GateHead() {
  return <>{GATES.map(([k, label]) => <th key={k} className="vm-gate-cell">{label}</th>)}</>;
}

function SummaryStat({ label, s }: { label: string; s: VmSummary | undefined }) {
  return (
    <div className="stat">
      <div className="tiny muted">{label}</div>
      {s && s.n > 0 ? (
        <>
          <div className={`num ${tone(s.excess)}`} style={{ fontWeight: 700, fontSize: 18 }}>{ppv(s.excess)}</div>
          <div className="tiny muted">{s.n}종목 · 평균 {pct(s.ret)} · 지수를 이김 {s.beat}/{s.n}</div>
        </>
      ) : (
        <div className="tiny muted" style={{ marginTop: 4 }}>아직 기록 없음</div>
      )}
    </div>
  );
}

function TrackTable({ rows, lang }: { rows: VmTrack[]; lang: Lang }) {
  if (!rows.length) return <p className="muted small">아직 기록이 없다 — 밤 실행이 하루 돌면 여기부터 쌓인다.</p>;
  return (
    <div className="table-wrap">
      <table className="data-table data-table--tight data-table--pin">
        <thead>
          <tr>
            <th>종목</th><th>묶음</th><th>시작일</th><th className="r">시작가</th><th className="r">수익률</th>
            <th className="r">지수</th><th className="r">차이</th><th>지금 통과</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.group}-${r.ticker}`}>
              <td><TickerLink ticker={r.ticker} /></td>
              <td>{r.group === "ours" ? <span className="badge vm-badge-ours">우리</span> : <span className="badge vm-badge-author">저자</span>}</td>
              <td>{fmtDate(r.since, lang)}</td>
              <td className="r num">{money(r.entry, r.ticker)}</td>
              <td className={`r num ${tone(r.ret)}`}>{pct(r.ret)}</td>
              <td className="r num">{r.bench === "XIU.TO" ? "XIU " : "SPY "}{pct(r.bench_ret)}</td>
              <td className={`r num ${tone(r.excess)}`}>{ppv(r.excess)}</td>
              <td>{r.passing ? <Mark g={true} /> : <span className="muted">·</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ValueModelCoverage({ model, live, lang }: { model: ValueModel; live: boolean; lang: Lang }) {
  const p = model.params;
  const f = model.funnel;
  const byT = new Map(model.rows.map((r) => [r.ticker, r]));
  const passing = model.rows.filter((r) => r.pass);
  const watch = model.rows
    .filter((r) => r.quality && !r.pass && r.drop != null)
    .sort((a, b) => (b.drop ?? -9) - (a.drop ?? -9));
  const priceOnly = model.rows.filter((r) => !r.quality && r.gates.price);
  const cov = model.author.coverage.map((c) => ({ c, r: byT.get(c.ticker) }));
  const covQ = cov.filter((x) => x.r?.quality).length;
  const covP = cov.filter((x) => x.r?.gates.price).length;
  const covB = cov.filter((x) => x.r?.pass).length;
  const screen = model.author.screen.map((s) => ({ s, r: byT.get(s.ticker) }));
  const ours = model.tracking.rows.filter((r) => r.group === "ours");
  const auth = model.tracking.rows.filter((r) => r.group === "author");
  const WATCH_TOP = 15;

  return (
    <section id="vm-ours" className="vm-sec">
      <div className="card">
        <div className="section-head">
          <h2 style={{ fontSize: 22 }}>우리 커버리지 — 같은 기준으로 매일 다시 계산</h2>
          <span className={`badge ${live ? "vm-badge-live" : "vm-badge-snap"}`}>
            {live ? `${fmtDate(model.date, lang)} 종가 기준` : `임시 스냅샷 · ${fmtDate(model.date, lang)}`}
          </span>
        </div>
        <p className="section-sub">
          저자가 자기 로직에 맞는 종목을 커버리지로 올리듯, 같은 관문을 S&P 500 + 저자 종목에 밤마다 적용한다.
          품질 관문 5개(ROE ≥ {plain(p.roe_min)} · CV ≤ {p.cv_max} / ROIC ≥ {plain(p.roic_min)} · WACC 초과 / Altman Z ≥ {p.altman_min} /
          Beneish M ≤ {p.beneish_max} / FCF) + 가격 관문(기대수익률 − 요구수익률 ≥ {ppv(p.alpha_min)}).
          요구수익률 = 10년 국채 {plain(p.rf)} + 베타 × {plain(p.erp)}, 5년 뒤 성장 {plain(p.term_g)}.
          {!live && " 밤 실행 데이터가 아직 없어 2026-11-11 에 만든 스냅샷을 보여 준다."}
        </p>
        <div className="stats">
          {[
            ["계산한 종목", f.computed, `금융·리츠 제외 ${f.excluded}`],
            ["품질 5개 통과", f.quality, `ROE ${f.roe} · ROIC ${f.roic} · Z ${f.z} · M ${f.m} · FCF ${f.fcf}`],
            ["가격 관문 통과", f.price, "알파 5%p 이상"],
            ["둘 다 통과", f.pass, "= 우리 매수 후보"],
          ].map(([label, n, sub]) => (
            <div key={String(label)} className="stat">
              <div className="tiny muted">{label}</div>
              <div className="num" style={{ fontWeight: 700, fontSize: 20 }}>{n ?? "—"}</div>
              <div className="tiny muted">{sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card vm-sub">
        <h3>지금 통과 — 품질 5개 + 가격 ({passing.length})</h3>
        {passing.length ? (
          <div className="table-wrap">
            <table className="data-table data-table--tight data-table--pin">
              <thead>
                <tr>
                  <th>종목</th><th>업종</th><th className="r">가격</th><th className="r">매수 기준가</th><th className="r">알파</th>
                  <th className="r">ROE</th><th className="r">ROIC · WACC</th><th className="r">Z</th><th className="r">M</th>
                  <th className="r">FCF 수익률</th><th className="r">3년 고점 대비</th><th>저자</th>
                </tr>
              </thead>
              <tbody>
                {passing.map((r) => (
                  <tr key={r.ticker}>
                    <td><TickerLink ticker={r.ticker} /><div className="cell-sub">{r.name}</div></td>
                    <td className="small">{r.industry}</td>
                    <td className="r num">{money(r.price, r.ticker)}</td>
                    <td className="r num">{money(r.buy, r.ticker)}</td>
                    <td className="r num up">{ppv(r.alpha)}</td>
                    <td className="r num">{plain(r.roe)}</td>
                    <td className="r num">{plain(r.roic)} · {plain(r.wacc)}</td>
                    <td className="r num">{r.z?.toFixed(2) ?? "—"}</td>
                    <td className="r num">{r.m?.toFixed(2) ?? "—"}</td>
                    <td className="r num">{plain(r.fcf_y)}</td>
                    <td className={`r num ${tone(r.dd_3y)}`}>{pct(r.dd_3y, 0)}</td>
                    <td>{r.author ? <span className="badge vm-badge-author">저자도</span> : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted small">지금은 없다. 이 방식은 늘 여러 종목이 나오는 스크린이 아니다 — 아래 대기 목록이 매수 기준가까지 내려오길 기다리는 방식.</p>
        )}
      </div>

      <div className="card vm-sub">
        <h3>저자 커버리지와 비교 ({model.author.as_of} 저자 사이트 기준 12종목)</h3>
        <p className="section-sub">
          저자 커버리지 12종목 중 우리 품질 관문 통과 <b>{covQ}</b> · 가격 관문 통과 <b>{covP}</b> · 둘 다 <b>{covB}</b>.
          ✓ 통과 · ✗ 탈락 · – 판단 불가(자기자본 음수의 ROE 등) · 매수 기준가가 지금보다 높으면 가격 관문 통과.
        </p>
        <div className="table-wrap">
          <table className="data-table data-table--tight data-table--pin">
            <thead>
              <tr>
                <th>종목</th><th className="r">지금</th><th className="r">저자 목표가</th><th className="r">목표까지</th>
                <th className="r">우리 매수 기준가</th><GateHead /><th className="r">알파</th>
              </tr>
            </thead>
            <tbody>
              {cov.map(({ c, r }) => (
                <tr key={c.ticker}>
                  <td><TickerLink ticker={c.ticker} />{r?.name && <div className="cell-sub">{r.name}</div>}</td>
                  <td className="r num">{money(c.price, c.ticker)}</td>
                  <td className="r num">{money(c.target, c.ticker)}</td>
                  <td className={`r num ${tone(c.upside)}`}>{pct(c.upside, 0)}</td>
                  <td className="r num">{money(r?.buy, c.ticker)}</td>
                  <Gates r={r} />
                  <td className={`r num ${tone(r?.alpha)}`}>{ppv(r?.alpha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 style={{ marginTop: 18 }}>저자 A-Series 스크린 종목 (2025-09·10월 말 목록)</h3>
        <div className="table-wrap">
          <table className="data-table data-table--tight data-table--pin">
            <thead>
              <tr><th>종목</th><th>저자 게시</th><th className="r">지금</th><th className="r">우리 매수 기준가</th><GateHead /><th className="r">알파</th></tr>
            </thead>
            <tbody>
              {screen.map(({ s, r }) => (
                <tr key={`${s.ticker}-${s.date}`}>
                  <td><TickerLink ticker={s.ticker} /></td>
                  <td>{fmtDate(s.date, lang)}</td>
                  <td className="r num">{money(r?.price, s.ticker)}</td>
                  <td className="r num">{money(r?.buy, s.ticker)}</td>
                  <Gates r={r} />
                  <td className={`r num ${tone(r?.alpha)}`}>{ppv(r?.alpha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card vm-sub">
        <h3>대기 목록 — 품질 5개 통과, 가격만 남음 ({watch.length})</h3>
        <p className="section-sub">매수 기준가까지 내려오면 가격 관문도 통과한다. 필요한 하락이 작은 순.</p>
        <WatchTable rows={watch.slice(0, WATCH_TOP)} />
        {watch.length > WATCH_TOP && (
          <details className="vm-details">
            <summary>나머지 {watch.length - WATCH_TOP}종목</summary>
            <WatchTable rows={watch.slice(WATCH_TOP)} />
          </details>
        )}
      </div>

      <div className="card vm-sub">
        <h3>가격만 통과 — 품질에서 떨어짐 ({priceOnly.length})</h3>
        <p className="section-sub">싸 보이지만 빚이 많거나 수익성이 들쭉날쭉한 &lsquo;싼 이유가 있는&rsquo; 회사가 대부분. 품질 관문이 핵심인 이유.</p>
        <div className="vm-chips">
          {priceOnly.map((r) => (
            <span key={r.ticker} className="vm-chip">
              <TickerLink ticker={r.ticker} /> <span className="tiny muted">{r.fails.join("·")} 탈락 · {ppv(r.alpha)}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="card vm-sub">
        <h3>앞으로 기록 — 우리 픽 vs 저자 커버리지</h3>
        <p className="section-sub">
          우리 종목은 처음 &lsquo;둘 다 통과&rsquo;한 날 종가, 저자 커버리지는 기록을 시작한 날({model.tracking.start ? fmtDate(model.tracking.start, lang) : "—"}) 종가부터.
          배당 포함, 같은 기간 SPY(캐나다는 XIU)와 비교. 이걸로 &lsquo;우리가 찾는 종목이 진짜 살 만한지&rsquo;를 본다.
        </p>
        <div className="stats">
          <SummaryStat label="우리 픽 — 지수 대비 평균" s={model.tracking.summary.ours} />
          <SummaryStat label="저자 커버리지 — 지수 대비 평균" s={model.tracking.summary.author} />
        </div>
        <TrackTable rows={[...ours, ...auth]} lang={lang} />
      </div>

      <p className="muted small" style={{ marginTop: 12 }}>
        매수 추천이 아니다 — 후보를 찾는 절차를 그대로 돌린 결과. 재무는 yfinance 연간 4~5년치라 변동계수가 저자의 10년 기준보다
        엄격하게 걸린다(한 해만 나빠도 탈락). 경계선 종목은 베타 하나로 결론이 바뀔 수 있다.
      </p>
    </section>
  );
}

function WatchTable({ rows }: { rows: VmRow[] }) {
  return (
    <div className="table-wrap">
      <table className="data-table data-table--tight data-table--pin">
        <thead>
          <tr>
            <th>종목</th><th>업종</th><th className="r">지금</th><th className="r">매수 기준가</th><th className="r">필요한 하락</th>
            <th className="r">3년 고점 대비</th><th className="r">ROIC</th><th className="r">FCF 수익률</th><th className="r">알파</th><th>저자</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ticker}>
              <td><TickerLink ticker={r.ticker} /><div className="cell-sub">{r.name}</div></td>
              <td className="small">{r.industry}</td>
              <td className="r num">{money(r.price, r.ticker)}</td>
              <td className="r num">{money(r.buy, r.ticker)}</td>
              <td className="r num">{pct(r.drop, 0)}</td>
              <td className={`r num ${tone(r.dd_3y)}`}>{pct(r.dd_3y, 0)}</td>
              <td className="r num">{plain(r.roic)}</td>
              <td className="r num">{plain(r.fcf_y)}</td>
              <td className={`r num ${tone(r.alpha)}`}>{ppv(r.alpha)}</td>
              <td>{r.author ? <span className="badge vm-badge-author">저자도</span> : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
