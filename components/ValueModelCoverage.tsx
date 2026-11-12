import Link from "next/link";
import type { ReactNode } from "react";
import { TickerLink } from "./TickerLink";
import { fmtDate, money, pct, tone } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import type { Gate, ValueModel, VmGroup, VmRow, VmSummary, VmTrack, VmView } from "@/lib/valueModel";

/**
 * 내계좌 › 예측 모델 — 맨 아래 '우리 커버리지' (2026-11-11). 저자(Baoro)가 자기 로직에 맞는 종목을 커버리지로 올리듯,
 * 같은 기준을 매일 밤 S&P 500 + 저자 종목에 돌린 결과 · 저자 커버리지와의 비교 · 앞으로 기록.
 * v1 = 품질 관문 5개 + 가격 관문 (지금 규칙). v2 = v1 + 하방 관문 · 괴리 순 · 반증 조건 (시니어식 보강).
 * 두 규칙은 같은 날부터 함께 기록해 어느 쪽이 나은지 본다 — 주소 ?v=v1 · v2 · cmp.
 * 데이터: lib/valueModel.ts (universe-data 의 value_model.json, 없으면 스냅샷).
 */

const GATES = [
  ["roe", "ROE"], ["roic", "ROIC"], ["z", "Z"], ["m", "M"], ["fcf", "FCF"], ["price", "가격"],
] as const;

const GROUP_LABEL: Record<VmGroup, string> = {
  ours: "v1 통과", v2: "v2 통과", v1_top: "v1 상위 10", v2_top: "v2 상위 10", author: "저자",
};

function Mark({ g, title }: { g: Gate | undefined; title?: string }) {
  if (g === true) return <span className="vm-gate vm-gate--ok" title={title ?? "통과"}>✓</span>;
  if (g === false) return <span className="vm-gate vm-gate--no" title={title ?? "탈락"}>✗</span>;
  return <span className="vm-gate vm-gate--na" title="판단 불가 — 통과로 친다">–</span>;
}

/** 0.06 → '+6.0%p' (알파 · 괴리처럼 %p 로 읽는 값). */
function ppv(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v * 100).toFixed(1);
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${a}%p`;
}

const plain = (v: number | null | undefined) => pct(v, 1, false);

function GroupBadge({ g }: { g: VmGroup }) {
  return <span className={`badge vm-g vm-g--${g}`}>{GROUP_LABEL[g]}</span>;
}

function Gates({ r, bear }: { r: VmRow | undefined; bear?: boolean }) {
  return (
    <>
      {GATES.map(([k]) => (
        <td key={k} className="vm-gate-cell">{r ? <Mark g={r.gates[k]} /> : <span className="muted">·</span>}</td>
      ))}
      {bear && (
        <td className="vm-gate-cell">
          {r && r.g_bear !== undefined ? <Mark g={r.g_bear} title="하방 관문 (FCF −30%에서도 알파 ≥ 0)" /> : <span className="muted">·</span>}
        </td>
      )}
    </>
  );
}

function GateHead({ bear }: { bear?: boolean }) {
  return (
    <>
      {GATES.map(([k, label]) => <th key={k} className="vm-gate-cell">{label}</th>)}
      {bear && <th className="vm-gate-cell">하방</th>}
    </>
  );
}

function Card({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="card vm-sub">
      <h3>{title}</h3>
      {sub && <p className="section-sub">{sub}</p>}
      {children}
    </div>
  );
}

function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="table-wrap">
      <table className="data-table data-table--tight data-table--pin">
        <thead><tr>{head}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Who({ r }: { r: VmRow }) {
  return <td><TickerLink ticker={r.ticker} /><div className="cell-sub">{r.name}</div></td>;
}

function AuthorMark({ r }: { r: VmRow }) {
  return <td>{r.author ? <span className="badge vm-g vm-g--author">저자도</span> : ""}</td>;
}

function KillCell({ r }: { r: VmRow }) {
  const k = r.kill ?? [];
  return <td className="small">{k.length ? <span className="down">{k.join(" · ")}</span> : <span className="muted">없음</span>}</td>;
}

function SummaryStat({ label, s }: { label: ReactNode; s: VmSummary | undefined }) {
  return (
    <div className="stat">
      <div className="tiny muted">{label}</div>
      {s && s.n > 0 ? (
        <>
          <div className={`num ${tone(s.excess)}`} style={{ fontWeight: 700, fontSize: 18 }}>{ppv(s.excess)}</div>
          <div className="tiny muted">
            {s.n}건 · 평균 {pct(s.ret)} · 지수를 이김 {s.beat}/{s.n}{s.open != null && s.open !== s.n ? ` · 보유 중 ${s.open}` : ""}
          </div>
        </>
      ) : (
        <div className="tiny muted" style={{ marginTop: 4 }}>아직 기록 없음</div>
      )}
    </div>
  );
}

function TrackTable({ rows, lang }: { rows: VmTrack[]; lang: Lang }) {
  if (!rows.length) return <p className="muted small">아직 기록이 없다 — 밤 실행이 하루 돌면 여기부터 쌓인다.</p>;
  const exits = rows.some((r) => r.exit);
  return (
    <Table head={<>
      <th>종목</th><th>묶음</th><th>시작일</th><th className="r">시작가</th><th className="r">수익률</th>
      <th className="r">지수</th><th className="r">차이</th><th>지금 통과</th>{exits && <th>끝</th>}
    </>}>
      {rows.map((r, i) => (
        <tr key={`${r.group}-${r.ticker}-${r.since}-${i}`}>
          <td><TickerLink ticker={r.ticker} /></td>
          <td><GroupBadge g={r.group} /></td>
          <td>{fmtDate(r.since, lang)}</td>
          <td className="r num">{money(r.entry, r.ticker)}</td>
          <td className={`r num ${tone(r.ret)}`}>{pct(r.ret)}</td>
          <td className="r num">{r.bench === "XIU.TO" ? "XIU " : "SPY "}{pct(r.bench_ret)}</td>
          <td className={`r num ${tone(r.excess)}`}>{ppv(r.excess)}</td>
          <td>{r.passing ? <Mark g={true} /> : <span className="muted">·</span>}</td>
          {exits && <td className="small">{r.exit ? `${fmtDate(r.exit, lang)} · ${r.reason ?? ""}` : ""}</td>}
        </tr>
      ))}
    </Table>
  );
}

function Switch({ view }: { view: VmView }) {
  const items: [VmView, string][] = [["v1", "v1 · 지금 규칙"], ["v2", "v2 · 시니어식 보강"], ["cmp", "v1 vs v2 비교"]];
  return (
    <nav className="vm-switch" aria-label="모델 버전">
      {items.map(([v, label]) => (
        <Link key={v} href={`/quant/model?v=${v}#vm-ours`} aria-current={v === view ? "page" : undefined} scroll={false}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

// ── v1 · v2 공통 카드

function PassCard({ rows, v2 }: { rows: VmRow[]; v2: boolean }) {
  const title = v2 ? `v2 통과 — v1 + 하방 관문 (${rows.length})` : `지금 통과 — 품질 5개 + 가격 (${rows.length})`;
  if (!rows.length) {
    return (
      <Card title={title}>
        <p className="muted small">지금은 없다. 이 방식은 늘 여러 종목이 나오는 스크린이 아니다 — 아래 대기 목록이 매수 기준가까지 내려오길 기다리는 방식.</p>
      </Card>
    );
  }
  return (
    <Card title={title} sub={v2 ? "하방 관문 = FCF 가 30% 줄고 첫 5년 성장이 0 이하여도 알파 ≥ 0. 베타 민감 = 베타를 0.6 으로 올리면 가격 관문에서 탈락 (표시만)." : undefined}>
      <Table head={<>
        <th>종목</th><th>업종</th><th className="r">가격</th><th className="r">매수 기준가</th><th className="r">알파</th>
        {v2 ? <>
          <th className="r">하방 알파</th><th className="r">시장 가정 성장</th><th className="r">실제 성장</th><th className="r">괴리</th><th>반증 조건</th>
        </> : <>
          <th className="r">ROE</th><th className="r">ROIC · WACC</th><th className="r">Z</th><th className="r">M</th><th className="r">FCF 수익률</th>
        </>}
        <th className="r">3년 고점 대비</th><th>표시</th>
      </>}>
        {rows.map((r) => (
          <tr key={r.ticker}>
            <Who r={r} />
            <td className="small">{r.industry}</td>
            <td className="r num">{money(r.price, r.ticker)}</td>
            <td className="r num">{money(r.buy, r.ticker)}</td>
            <td className="r num up">{ppv(r.alpha)}</td>
            {v2 ? <>
              <td className={`r num ${tone(r.alpha_bear)}`}>{ppv(r.alpha_bear)}</td>
              <td className="r num">{pct(r.implied_g)}</td>
              <td className="r num">{pct(r.g1)}</td>
              <td className={`r num ${tone(r.gap)}`}>{ppv(r.gap)}</td>
              <KillCell r={r} />
            </> : <>
              <td className="r num">{plain(r.roe)}</td>
              <td className="r num">{plain(r.roic)} · {plain(r.wacc)}</td>
              <td className="r num">{r.z?.toFixed(2) ?? "—"}</td>
              <td className="r num">{r.m?.toFixed(2) ?? "—"}</td>
              <td className="r num">{plain(r.fcf_y)}</td>
            </>}
            <td className={`r num ${tone(r.dd_3y)}`}>{pct(r.dd_3y, 0)}</td>
            <td>
              {r.author && <span className="badge vm-g vm-g--author">저자도</span>}{" "}
              {v2 && r.sensitive && <span className="badge vm-warn" title={`베타 0.6 이면 알파 ${ppv(r.alpha_b06)}`}>베타 민감</span>}
            </td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

function AuthorCard({ model, byT, lang, v2 }: { model: ValueModel; byT: Map<string, VmRow>; lang: Lang; v2: boolean }) {
  const cov = model.author.coverage.map((c) => ({ c, r: byT.get(c.ticker) }));
  const covQ = cov.filter((x) => x.r?.quality).length;
  const covP = cov.filter((x) => x.r?.gates.price).length;
  const covB = cov.filter((x) => (v2 ? x.r?.pass_v2 : x.r?.pass)).length;
  const screen = model.author.screen.map((s) => ({ s, r: byT.get(s.ticker) }));
  return (
    <Card
      title={`저자 커버리지와 비교 (${model.author.as_of} 저자 사이트 기준 12종목)`}
      sub={<>
        저자 커버리지 12종목 중 우리 품질 관문 통과 <b>{covQ}</b> · 가격 관문 통과 <b>{covP}</b> · {v2 ? "v2 통과" : "둘 다"} <b>{covB}</b>.
        ✓ 통과 · ✗ 탈락 · – 판단 불가(자기자본 음수의 ROE 등) · 매수 기준가가 지금보다 높으면 가격 관문 통과.
      </>}
    >
      <Table head={<>
        <th>종목</th><th className="r">지금</th><th className="r">저자 목표가</th><th className="r">목표까지</th>
        <th className="r">우리 매수 기준가</th><GateHead bear={v2} /><th className="r">알파</th>{v2 && <th className="r">괴리</th>}
      </>}>
        {cov.map(({ c, r }) => (
          <tr key={c.ticker}>
            <td><TickerLink ticker={c.ticker} />{r?.name && <div className="cell-sub">{r.name}</div>}</td>
            <td className="r num">{money(c.price, c.ticker)}</td>
            <td className="r num">{money(c.target, c.ticker)}</td>
            <td className={`r num ${tone(c.upside)}`}>{pct(c.upside, 0)}</td>
            <td className="r num">{money(r?.buy, c.ticker)}</td>
            <Gates r={r} bear={v2} />
            <td className={`r num ${tone(r?.alpha)}`}>{ppv(r?.alpha)}</td>
            {v2 && <td className={`r num ${tone(r?.gap)}`}>{ppv(r?.gap)}</td>}
          </tr>
        ))}
      </Table>
      <h3 style={{ marginTop: 18 }}>저자 A-Series 스크린 종목 (2025-09·10월 말 목록)</h3>
      <Table head={<>
        <th>종목</th><th>저자 게시</th><th className="r">지금</th><th className="r">우리 매수 기준가</th><GateHead bear={v2} /><th className="r">알파</th>
      </>}>
        {screen.map(({ s, r }) => (
          <tr key={`${s.ticker}-${s.date}`}>
            <td><TickerLink ticker={s.ticker} /></td>
            <td>{fmtDate(s.date, lang)}</td>
            <td className="r num">{money(r?.price, s.ticker)}</td>
            <td className="r num">{money(r?.buy, s.ticker)}</td>
            <Gates r={r} bear={v2} />
            <td className={`r num ${tone(r?.alpha)}`}>{ppv(r?.alpha)}</td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

function WatchTable({ rows, v2 }: { rows: VmRow[]; v2: boolean }) {
  return (
    <Table head={<>
      <th>종목</th><th>업종</th><th className="r">지금</th><th className="r">매수 기준가</th><th className="r">필요한 하락</th>
      {v2 ? <>
        <th className="r">시장 가정 성장</th><th className="r">실제 성장</th><th className="r">괴리</th><th>반증 조건</th>
      </> : <>
        <th className="r">3년 고점 대비</th><th className="r">ROIC</th><th className="r">FCF 수익률</th><th className="r">알파</th>
      </>}
      <th>저자</th>
    </>}>
      {rows.map((r) => (
        <tr key={r.ticker}>
          <Who r={r} />
          <td className="small">{r.industry}</td>
          <td className="r num">{money(r.price, r.ticker)}</td>
          <td className="r num">{money(r.buy, r.ticker)}</td>
          <td className="r num">{pct(r.drop, 0)}</td>
          {v2 ? <>
            <td className="r num">{pct(r.implied_g)}</td>
            <td className="r num">{pct(r.g1)}</td>
            <td className={`r num ${tone(r.gap)}`}>{ppv(r.gap)}</td>
            <KillCell r={r} />
          </> : <>
            <td className={`r num ${tone(r.dd_3y)}`}>{pct(r.dd_3y, 0)}</td>
            <td className="r num">{plain(r.roic)}</td>
            <td className="r num">{plain(r.fcf_y)}</td>
            <td className={`r num ${tone(r.alpha)}`}>{ppv(r.alpha)}</td>
          </>}
          <AuthorMark r={r} />
        </tr>
      ))}
    </Table>
  );
}

function WatchCard({ rows, v2 }: { rows: VmRow[]; v2: boolean }) {
  const TOP = 15;
  return (
    <Card
      title={v2 ? `대기 목록 — 괴리 큰 순 (${rows.length})` : `대기 목록 — 품질 5개 통과, 가격만 남음 (${rows.length})`}
      sub={v2
        ? "괴리 = 최근 4년 매출 성장(10%에서 자름) − 지금 주가가 가정하는 영구 성장. 클수록 '성장이 이어지면 싸다'. 살 목록이 아니라 파 볼 목록."
        : "매수 기준가까지 내려오면 가격 관문도 통과한다. 필요한 하락이 작은 순."}
    >
      <WatchTable rows={rows.slice(0, TOP)} v2={v2} />
      {rows.length > TOP && (
        <details className="vm-details">
          <summary>나머지 {rows.length - TOP}종목</summary>
          <WatchTable rows={rows.slice(TOP)} v2={v2} />
        </details>
      )}
    </Card>
  );
}

function PriceOnlyCard({ rows }: { rows: VmRow[] }) {
  return (
    <Card title={`가격만 통과 — 품질에서 떨어짐 (${rows.length})`}
      sub="싸 보이지만 빚이 많거나 수익성이 들쭉날쭉한 '싼 이유가 있는' 회사가 대부분. 품질 관문이 핵심인 이유.">
      <div className="vm-chips">
        {rows.map((r) => (
          <span key={r.ticker} className="vm-chip">
            <TickerLink ticker={r.ticker} /> <span className="tiny muted">{r.fails.join("·")} 탈락 · {ppv(r.alpha)}</span>
          </span>
        ))}
      </div>
    </Card>
  );
}

function ThemeCard({ model }: { model: ValueModel }) {
  const v2 = model.v2!;
  const items = Object.entries(v2.theme);
  return (
    <Card title={`업종 집중 — v2 상위 ${v2.params.theme_top} 안`}
      sub={`같은 업종이 ${v2.params.theme_warn}개 이상이면 주황색 — 한 테마에 몰리면 종목이 여러 개여도 사실상 베팅 하나다.`}>
      <div className="vm-chips">
        {items.map(([ind, n]) => (
          <span key={ind} className={`vm-chip${n >= v2.params.theme_warn ? " vm-chip--warn" : ""}`}>
            {ind} <b className="num">{n}</b>
          </span>
        ))}
      </div>
    </Card>
  );
}

function TrackCard({ model, groups, lang, title }: { model: ValueModel; groups: VmGroup[]; lang: Lang; title: string }) {
  const rows = model.tracking.rows.filter((r) => groups.includes(r.group));
  return (
    <Card title={title} sub={<>
      통과 묶음은 처음 통과한 날 종가, 상위 10 묶음은 매달 첫 실행에 다시 고른 날, 저자 커버리지는 기록을 시작한 날
      ({model.tracking.start ? fmtDate(model.tracking.start, lang) : "—"}) 종가부터. 배당 포함, 같은 기간 SPY(캐나다는 XIU)와 비교.
      규칙은 시작일에 고정 — 성적을 보고 고치지 않는다.
    </>}>
      <div className="stats">
        {groups.map((g) => <SummaryStat key={g} label={<>{GROUP_LABEL[g]} — 지수 대비 평균</>} s={model.tracking.summary[g]} />)}
      </div>
      <TrackTable rows={rows} lang={lang} />
    </Card>
  );
}

// ── 비교

function CompareCard({ model, byT, lang }: { model: ValueModel; byT: Map<string, VmRow>; lang: Lang }) {
  const v2 = model.v2!;
  const p1 = model.rows.filter((r) => r.pass).map((r) => r.ticker);
  const p2 = model.rows.filter((r) => r.pass_v2).map((r) => r.ticker);
  const t1 = v2.top.v1;
  const t2 = v2.top.v2;
  const both = t1.filter((t) => t2.includes(t));
  const n = Math.max(t1.length, t2.length);
  const tag = (t: string, other: string[]) =>
    other.includes(t) ? <span className="tiny muted"> 둘 다</span> : <span className="tiny vm-only"> 여기만</span>;
  return (
    <>
      <Card title="통과 종목 비교" sub="v2 는 v1 통과 중 하방 관문까지 넘은 종목 — v2 ⊂ v1.">
        <div className="vm-cols">
          <div><div className="tiny muted">v1 통과 ({p1.length})</div><div className="vm-chips">{p1.length ? p1.map((t) => <span key={t} className="vm-chip"><TickerLink ticker={t} />{tag(t, p2)}</span>) : <span className="muted small">없음</span>}</div></div>
          <div><div className="tiny muted">v2 통과 ({p2.length})</div><div className="vm-chips">{p2.length ? p2.map((t) => <span key={t} className="vm-chip"><TickerLink ticker={t} />{tag(t, p1)}{byT.get(t)?.sensitive ? <span className="badge vm-warn">베타 민감</span> : null}</span>) : <span className="muted small">없음</span>}</div></div>
        </div>
      </Card>
      <Card title={`우선순위 상위 ${v2.params.top_n} 비교 — 겹침 ${both.length}`}
        sub="v1 = 매수 기준가까지 필요한 하락이 작은 순 · v2 = 괴리(실제 성장 − 시장 가정 성장) 큰 순. 두 묶음 모두 매달 첫 실행에 다시 골라 기록한다.">
        <Table head={<><th>순위</th><th>v1 (필요한 하락)</th><th className="r">하락</th><th>v2 (괴리)</th><th className="r">괴리</th></>}>
          {Array.from({ length: n }, (_, i) => {
            const a = t1[i];
            const b = t2[i];
            return (
              <tr key={i}>
                <td className="num">{i + 1}</td>
                <td>{a ? <><TickerLink ticker={a} />{tag(a, t2)}</> : ""}</td>
                <td className="r num">{a ? pct(byT.get(a)?.drop, 0) : ""}</td>
                <td>{b ? <><TickerLink ticker={b} />{tag(b, t1)}</> : ""}</td>
                <td className={`r num ${tone(b ? byT.get(b)?.gap : null)}`}>{b ? ppv(byT.get(b)?.gap) : ""}</td>
              </tr>
            );
          })}
        </Table>
      </Card>
      <TrackCard model={model} groups={["ours", "v2", "v1_top", "v2_top", "author"]} lang={lang}
        title="앞으로 기록 — v1 vs v2 vs 저자" />
    </>
  );
}

export function ValueModelCoverage({ model, live, lang, view }: { model: ValueModel; live: boolean; lang: Lang; view: VmView }) {
  const p = model.params;
  const f = model.funnel;
  const byT = new Map(model.rows.map((r) => [r.ticker, r]));
  const hasV2 = !!model.v2;
  const watchV1 = model.rows
    .filter((r) => r.quality && !r.pass && r.drop != null)
    .sort((a, b) => (b.drop ?? -9) - (a.drop ?? -9));
  // v2 대기 목록 — 반증 조건이 없는 종목을 괴리 순으로 먼저, 걸린 종목은 그 뒤 (v2 상위 10 도 반증 없는 종목에서 고른다)
  const watchV2 = model.rows
    .filter((r) => r.quality && !r.pass_v2 && r.gap != null)
    .sort((a, b) => Number(!!a.kill?.length) - Number(!!b.kill?.length) || (b.gap ?? -9) - (a.gap ?? -9));
  const priceOnly = model.rows.filter((r) => !r.quality && r.gates.price);
  const noV2 = <div className="card vm-sub"><p className="muted small">v2 데이터가 아직 없다 — 다음 밤 실행부터 v1 과 함께 계산된다.</p></div>;

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
          {!live && " 밤 실행 데이터가 아직 없어 로컬에서 만든 스냅샷을 보여 준다."}
        </p>
        <div className="stats">
          {[
            ["계산한 종목", f.computed, `금융·리츠 제외 ${f.excluded}`],
            ["품질 5개 통과", f.quality, `ROE ${f.roe} · ROIC ${f.roic} · Z ${f.z} · M ${f.m} · FCF ${f.fcf}`],
            ["가격 관문 통과", f.price, "알파 5%p 이상"],
            ["v1 통과", f.pass, "품질 + 가격"],
            ...(hasV2 ? [["v2 통과", f.pass_v2, `v1 + 하방 관문 · 베타 민감 ${f.sensitive ?? 0}`]] : []),
          ].map(([label, n, sub]) => (
            <div key={String(label)} className="stat">
              <div className="tiny muted">{label}</div>
              <div className="num" style={{ fontWeight: 700, fontSize: 20 }}>{n ?? "—"}</div>
              <div className="tiny muted">{sub}</div>
            </div>
          ))}
        </div>
        <Switch view={view} />
      </div>

      {view === "v1" && <>
        <PassCard rows={model.rows.filter((r) => r.pass)} v2={false} />
        <AuthorCard model={model} byT={byT} lang={lang} v2={false} />
        <WatchCard rows={watchV1} v2={false} />
        <PriceOnlyCard rows={priceOnly} />
        <TrackCard model={model} groups={["ours", "author"]} lang={lang} title="앞으로 기록 — 우리 픽(v1) vs 저자 커버리지" />
      </>}

      {view === "v2" && (hasV2 ? <>
        <PassCard rows={model.rows.filter((r) => r.pass_v2)} v2 />
        <ThemeCard model={model} />
        <AuthorCard model={model} byT={byT} lang={lang} v2 />
        <WatchCard rows={watchV2} v2 />
        <PriceOnlyCard rows={priceOnly} />
        <TrackCard model={model} groups={["v2", "author"]} lang={lang} title="앞으로 기록 — 우리 픽(v2) vs 저자 커버리지" />
      </> : noV2)}

      {view === "cmp" && (hasV2 ? <CompareCard model={model} byT={byT} lang={lang} /> : noV2)}

      <p className="muted small" style={{ marginTop: 12 }}>
        매수 추천이 아니다 — 후보를 찾는 절차를 그대로 돌린 결과. 재무는 yfinance 연간 4~5년치라 변동계수가 저자의 10년 기준보다
        엄격하게 걸린다(한 해만 나빠도 탈락). 경계선 종목은 베타 하나로 결론이 바뀔 수 있다.
      </p>
    </section>
  );
}
