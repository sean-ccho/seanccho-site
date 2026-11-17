import Link from "next/link";
import type { ReactNode } from "react";
import { DataStatusChip } from "./DataStatusChip";
import { Icon, type IconName } from "./Icon";
import { TickerLink } from "./TickerLink";
import { fmtDate, money, pct, tone } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import type { DsFile } from "@/lib/dataStatus";
import { fairRange, type FairRange, type Gate, type ValueModel, type VmGroup, type VmResearch, type VmRow, type VmSummary, type VmTab,
  type VmTrack } from "@/lib/valueModel";

/**
 * 매수 후보 › 예측 모델 화면 (2026-11-16 내계좌에서 옮김).
 *   ① 분석가 보드 — 위에 주니어 통과 픽 | 시니어 통과 픽 (1위는 큰 카드), 그 밑 주니어 상위 10 | 시니어 상위 10 |
 *      수석 PM 10칸 | 리서치 지금 목록, 성적표. 목록마다 티커 옆에 현재가 / 매수 기준가.
 *      분석가들은 리서치 종목을 모르는 채 우리 대상(미국 + TSX, 시가총액 US$10억 이상)에서만 고른다 — 리서치 종목이
 *      대상 밖이면 비교용으로만 계산(own = false). 다른 목록에도 있는 종목엔 '주 · 시 · P · 리' 표시.
 *   ② 문서 기록 — 분석가 규칙 · 회고(그때로 돌아가면) · 스크린 과거 목록 · 리서치 정리 1~8 (한 번 정리한 고정 자료).
 * 리서치 출처의 이름 · 주소 · 원문 링크는 화면 어디에도 쓰지 않는다 (사용자 2026-11-16).
 * 모델 결과는 Project_1 web_export/value_model.py 가 밤마다 만드는 value_model.json (없으면 스냅샷).
 */

const GATES = [
  ["roe", "ROE"], ["roic", "ROIC"], ["z", "Z"], ["m", "M"], ["fcf", "FCF"], ["price", "가격"],
] as const;

export const JUNIOR = "주니어 분석가";
export const SENIOR = "시니어 분석가";
export const PM = "수석 PM";

const AUTHOR_TAG = { coverage: "리서치 커버리지 일치", research: "리서치 노트 종목", screen: "리서치 스크린 목록" } as const;

const GROUP_LABEL: Record<VmGroup, string> = {
  ours: "주니어 통과", v1_top: "주니어 상위 10", v2: "시니어 통과", v2_top: "시니어 상위 10", v3: "PM 포트폴리오",
  author: "리서치 종목",
};
const SCORE_GROUPS: VmGroup[] = ["ours", "v1_top", "v2", "v2_top", "v3", "author"];

/** 0.06 → '+6.0%p' (알파 · 괴리처럼 %p 로 읽는 값). */
export function ppv(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v * 100).toFixed(1);
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${a}%p`;
}

const plain = (v: number | null | undefined) => pct(v, 1, false);
const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
const isOwn = (r: VmRow | undefined) => !!r && r.own !== false;
const coOf = (r: VmRow) => r.co ?? r.ticker;

// ── 작은 조각

/** ✓ · ✕ 를 같은 굵기 선으로 (글자 ✓ 는 가늘고 ✕ 는 굵게 나와서). */
function Stroke({ d }: { d: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
  );
}

export function GateMark({ g, title }: { g: Gate | undefined; title?: string }) {
  if (g === true) {
    return <span className="vm-ck vm-ck--ok" title={title ?? "통과"} role="img" aria-label="통과"><Stroke d="M5 12.5l4.5 4.5L19 7.5" /></span>;
  }
  if (g === false) {
    return <span className="vm-ck vm-ck--no" title={title ?? "탈락"} role="img" aria-label="탈락"><Stroke d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></span>;
  }
  return <span className="vm-ck vm-ck--na" title="판단 불가 — 통과로 친다 (자기자본 음수의 ROE 등)" role="img" aria-label="판단 불가">–</span>;
}

/** ROIC 의 부채 · 현금을 자료가 없어 0 으로 계산했는지 (2026-11-16, 사용자: "정보를 못 가져온 거면 확실하게 표시"). */
function fillNote(r: VmRow | undefined): { short: string; long: string } | null {
  const f = r?.fill0;
  if (!f || !(f.debt || f.cash)) return null;
  const what = [f.debt ? "부채" : "", f.cash ? "현금" : ""].filter(Boolean).join("·");
  const yrs = [f.debt ? `부채 ${f.years}년 중 ${f.debt}년` : "", f.cash ? `현금 ${f.years}년 중 ${f.cash}년` : ""].filter(Boolean).join(" · ");
  return {
    short: `${what} 자료 없음`,
    long: `ROIC 계산: ${yrs}은 Yahoo 재무제표에 자료가 없어 0으로 계산했다. 빚이 없는 회사는 보통 그 줄 자체가 없지만, `
      + "실제로 부채가 있었다면 ROIC 가 실제보다 높게 나온다 (ROIC = 세후 영업이익 ÷ (부채 + 자본 − 현금)).",
  };
}

/** 목록 · 표에 붙이는 작은 경고 — '부채 자료 없음 → 0'. */
function GapMark({ r, compact }: { r: VmRow | undefined; compact?: boolean }) {
  const n = fillNote(r);
  if (!n) return null;
  return <span className="vm-gap" title={n.long}>{compact ? n.short : `${n.short} → 0`}</span>;
}

function Who({ ticker, name, badge }: { ticker: string; name?: string | null; badge?: ReactNode }) {
  return (
    <td className="vm-who">
      <TickerLink ticker={ticker} />
      {name && <span className="vm-who__name" title={name}>{name}</span>}
      {badge}
    </td>
  );
}

function Tag({ children, tone: t = "plain", title }: { children: ReactNode; tone?: "plain" | "good" | "info" | "warn" | "bad"; title?: string }) {
  return <span className={`vm-tag vm-tag--${t}`} title={title}>{children}</span>;
}

function Panel({ title, sub, aside, children, className, id }: {
  title: ReactNode; sub?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; id?: string;
}) {
  return (
    <section className={`vm-panel${className ? ` ${className}` : ""}`} id={id}>
      <div className="vm-panel__head">
        <div>
          <h3>{title}</h3>
          {sub && <p>{sub}</p>}
        </div>
        {aside && <div className="vm-panel__aside">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

function Table({ head, children, foot }: { head: ReactNode; children: ReactNode; foot?: ReactNode }) {
  return (
    <>
      <div className="table-wrap vm-tw">
        <table className="vm-t">
          <thead><tr>{head}</tr></thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {foot && <div className="vm-t__foot">{foot}</div>}
    </>
  );
}

/** 접어 둔 자세히 보기. */
function Fold({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <details className="vm-fold">
      <summary>{title}</summary>
      <div className="vm-fold__body">{children}</div>
    </details>
  );
}

/** 표 한 줄의 최종 상태 — 통과 · 어느 관문에서 떨어졌는지. */
function status(r: VmRow | undefined): { label: string; t: "pass" | "junior" | "plain" | "warn" | "bad"; title?: string } {
  if (!r) return { label: "자료 없음", t: "plain" };
  const kill = r.kill?.length ? `시니어 반증 조건: ${r.kill.join(" · ")}` : undefined;
  if (r.pass_v2) return { label: "시니어 통과", t: "pass" };
  if (r.pass) return { label: "주니어만 통과", t: "junior", title: "하방 관문(FCF −30% · 성장 0 이하에서도 알파 ≥ 0)에서 탈락" };
  const f = r.fails;
  if (!f.length) return { label: "품질 O · 가격 비쌈", t: "plain", title: kill };
  if (r.gates.price) return { label: `가격 O · ${f.join("·")} 미달`, t: "warn", title: kill };
  if (r.fcf_y == null || r.fcf_y <= 0 || r.buy == null) return { label: "FCF 적자", t: "bad", title: kill };
  if (f.length >= 3) return { label: "품질 · 가격 전면 탈락", t: "bad", title: `${f.join(" · ")} · 가격 탈락` };
  return { label: `${f.join("·")} · 가격 미달`, t: "bad", title: kill };
}

function StatusBadge({ r }: { r: VmRow | undefined }) {
  const s = status(r);
  return <span className={`vm-st vm-st--${s.t}`} title={s.title}>{s.label}</span>;
}

function BuyCell({ r, ticker }: { r: VmRow | undefined; ticker: string }) {
  const cheap = r?.buy != null && r.price != null && r.buy >= r.price;
  return <td className={`r num vm-buy${r?.buy == null ? "" : cheap ? " vm-buy--ok" : " vm-buy--no"}`}>{money(r?.buy, ticker)}</td>;
}

// ── 위 숫자 4칸

function Kpi({ label, icon, children, foot, tag, className }: {
  label: ReactNode; icon: IconName; children: ReactNode; foot?: ReactNode; tag?: ReactNode; className?: string;
}) {
  return (
    <div className={`vm-kpi${className ? ` ${className}` : ""}`}>
      <div className="vm-kpi__head"><span>{label}</span><Icon name={icon} size={18} /></div>
      <div className="vm-kpi__body">{children}</div>
      {(foot || tag) && <div className="vm-kpi__foot"><span>{foot}</span>{tag && <span className="vm-kpi__tag">{tag}</span>}</div>}
    </div>
  );
}

export function VmKpis({ model }: { model: ValueModel }) {
  const f = model.funnel;
  const p = model.params;
  const u = p.universe;
  const picks = model.rows.filter((r) => isOwn(r) && r.pass_v2);
  const one = picks.length === 1 ? picks[0] : null;
  const rate = f.computed ? (f.quality / f.computed) * 100 : 0;
  const us = u?.by_market ? (u.by_market.sp500 ?? 0) + (u.by_market.nasdaq ?? 0) : null;
  const pm = model.v3;
  const pmPicks = (pm?.top ?? []).map((t) => model.rows.find((r) => r.ticker === t)).filter((r): r is VmRow => !!r);
  return (
    <div className="vm-kpis">
      {u?.size ? (
        <Kpi label="분석 대상 유니버스" icon="database" tag="시총 $10억+ · 금융·리츠 제외"
          foot={us != null ? `미국 ${us.toLocaleString()} · TSX ${(u.by_market?.tsx ?? 0).toLocaleString()} · 계산 ${f.computed.toLocaleString()}` : `계산 ${f.computed}`}>
          <b className="vm-kpi__n">{u.size.toLocaleString()}</b><span>개</span>
        </Kpi>
      ) : (
        <Kpi label="분석 대상 유니버스" icon="database" foot={`금융 · 리츠 제외 ${f.excluded}개`} tag="S&P 500 + 리서치 종목">
          <b className="vm-kpi__n">{f.computed}</b><span>개</span>
        </Kpi>
      )}
      <Kpi label="품질 5대 관문 통과" icon="check-badge" className="vm-kpi--good"
        foot={<span className="num">ROE {f.roe} · ROIC {f.roic} · Z {f.z} · M {f.m} · FCF {f.fcf}</span>}>
        <b className="vm-kpi__n">{f.quality}</b><span>개 (통과율 {rate.toFixed(1)}%)</span>
      </Kpi>
      <Kpi label="가격 관문 통과" icon="scale" foot={`요구수익률 = 10년 국채 ${plain(p.rf)} + β × ${plain(p.erp)}`} tag="DCF 2단계">
        <b className="vm-kpi__n">{f.price}</b><span>개 (알파 ≥ {ppv(p.alpha_min)})</span>
      </Kpi>
      {pm ? (
        <Kpi label={`${PM} 최종 포트폴리오`} icon="pin" className="vm-kpi--pick"
          foot={`10칸 중 종목 ${pmPicks.length}칸 · SPY ${pm.params.slots - pmPicks.length}칸${pm.ready ? "" : " · 자료 준비 중이라 임시"}`}>
          <b className="vm-kpi__n">{pmPicks.length}</b><span>{pmPicks.length ? "종목" : "종목 — 전부 SPY"}</span>
          {pmPicks.length > 0 && (
            <span className="vm-kpi__list vm-kpi__list--row">
              {pmPicks.map((r) => <TickerLink key={r.ticker} ticker={r.ticker} />)}
            </span>
          )}
        </Kpi>
      ) : (
        <Kpi label={`${SENIOR} 최종 픽`} icon="pin" className="vm-kpi--pick"
          foot={one ? <>하방 알파 {ppv(one.alpha_bear)}{one.author ? " · 리서치도 ○" : ""}{one.sensitive ? " · " : ""}{one.sensitive && <b className="vm-warn-t">베타 민감</b>}</>
            : picks.length ? `${JUNIOR} 통과 ${f.pass}개 중 하방 관문 · 반증까지` : `${JUNIOR} 통과 ${f.pass}개 · 시니어 0`}>
          {one ? (
            <div className="vm-kpi__pick">
              <span className="vm-kpi__tk"><TickerLink ticker={one.ticker} /></span>
              <span className="vm-kpi__nm">{one.name}</span>
              <span className="vm-kpi__chip">알파<b>{ppv(one.alpha)}</b></span>
            </div>
          ) : picks.length ? (
            <>
              <b className="vm-kpi__n">{picks.length}</b><span>개</span>
              <span className="vm-kpi__list vm-kpi__list--row">
                {picks.slice(0, 6).map((r) => <TickerLink key={r.ticker} ticker={r.ticker} />)}
                {picks.length > 6 && <span className="muted">외 {picks.length - 6}</span>}
              </span>
            </>
          ) : (
            <><b className="vm-kpi__n">0</b><span>개 — 지금은 없음</span></>
          )}
        </Kpi>
      )}
    </div>
  );
}

// ── 안쪽 탭 (2개)

const TABS: { key: VmTab; label: string; sub: string; icon: IconName }[] = [
  { key: "board", label: "분석가 보드", sub: "주니어 · 시니어 · PM · 리서치", icon: "compare" },
  { key: "doc", label: "문서 기록", sub: "규칙 · 회고 · 리서치 정리", icon: "doc" },
];

export function VmTabBar({ tab, model, live, failed, lang, status }: {
  tab: VmTab; model: ValueModel; live: boolean; failed?: string; lang: Lang;
  /** 자료 상태 (2026-11-13) — 계산된 종목 ÷ 대상 · 기록 준비 중 (lib/dataStatus valueModelStatus) */
  status?: DsFile;
}) {
  return (
    <div className="vm-tabbar">
      <nav className="vm-tabs" aria-label="예측 모델 보기">
        {TABS.map((x) => (
          <Link key={x.key} href={x.key === "board" ? "/quant/model" : `/quant/model?tab=${x.key}`}
            aria-current={x.key === tab ? "page" : undefined} scroll={false}>
            <Icon name={x.icon} size={16} />
            <span>{x.label}</span>
            <span className="vm-tabs__sub">{x.sub}</span>
          </Link>
        ))}
      </nav>
      <p className={`vm-tabbar__meta${live ? "" : " vm-tabbar__meta--snap"}`}>
        <span className="vm-dot" aria-hidden="true" />
        {live
          ? `${fmtDate(model.date, lang)} 종가 · 밤마다 다시 계산`
          : failed
            ? `${fmtDate(failed, lang)} 밤 계산 실패 — ${fmtDate(model.date, lang)} 스냅샷으로 표시`
            : `임시 스냅샷 · ${fmtDate(model.date, lang)} 로컬 실행`}
      </p>
      {status && <DataStatusChip files={[status]} />}
    </div>
  );
}

// ── 분석가 보드 자료

/** 리서치 종목 한 줄 — 출처 두 곳: 커버리지 목록(목표가 · 의견)과 리서치 노트. */
type AuthorItem = {
  ticker: string;
  price: number | null;
  target: number | null;
  upside: number | null;
  rating: string | null;
  covered: boolean; // 커버리지 목록에 있음
  posts: VmResearch[]; // 그 종목 리서치 노트 (적정가 업데이트 포함)
  row?: VmRow; // 리서치 티커로 계산한 줄
  mine?: VmRow; // 같은 회사가 우리 대상에 있으면 그 줄 (리서치는 'NAS: RCI', 우리는 TSX 쪽처럼 상장이 다를 수 있다)
};

function authorItems(model: ValueModel, byT: Map<string, VmRow>): AuthorItem[] {
  const research = model.author.research ?? [];
  const postsOf = (t: string) => research.filter((a) => a.ticker === t);
  const items: AuthorItem[] = model.author.coverage.map((c) => ({
    ticker: c.ticker, price: c.price, target: c.target, upside: c.upside, rating: c.rating ?? null, covered: true,
    posts: postsOf(c.ticker),
  }));
  for (const a of research) {
    if (items.some((x) => x.ticker === a.ticker)) continue;
    const posts = postsOf(a.ticker);
    const last = [...posts].reverse().find((x) => x.target != null) ?? posts[posts.length - 1];
    items.push({
      ticker: a.ticker, price: byT.get(a.ticker)?.price ?? last.price, target: last.target, upside: last.upside,
      rating: null, covered: false, posts,
    });
  }
  return items.map((x) => {
    const row = byT.get(x.ticker);
    const mine = isOwn(row) ? row : row?.co ? model.rows.find((r) => isOwn(r) && r.co === row.co) : undefined;
    return { ...x, row, mine };
  });
}

function boardData(model: ValueModel) {
  const byT = new Map(model.rows.map((r) => [r.ticker, r]));
  const pick = (ts: string[] | undefined) => (ts ?? []).map((t) => byT.get(t)).filter((r): r is VmRow => !!r);
  const jPass = model.rows.filter((r) => isOwn(r) && r.pass).sort((a, b) => (b.alpha ?? 0) - (a.alpha ?? 0));
  const sPass = model.rows.filter((r) => isOwn(r) && r.pass_v2).sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0));
  const jTop = pick(model.v2?.top.v1);
  const sTop = pick(model.v2?.top.v2);
  const pTop = pick(model.v3?.top);
  const pmCands = model.rows
    .filter((r) => isOwn(r) && r.quality && !r.kill?.length)
    .sort((a, c) => Number(!!c.pm?.pass) - Number(!!a.pm?.pass) || (c.pm?.alpha_bear_real ?? -9) - (a.pm?.alpha_bear_real ?? -9));
  const authors = authorItems(model, byT);
  const bearCut = model.v2?.params.bear_fcf_cut ?? 0.3;
  const fairOf = (r?: VmRow | null): FairRange | null => (r ? fairRange(r, model.params, bearCut) : null);
  const jCo = new Set([...jPass, ...jTop].map(coOf));
  const sCo = new Set([...sPass, ...sTop].map(coOf));
  const pCo = new Set(pTop.map(coOf));
  const aCo = new Set(authors.flatMap((x) => [x.row && coOf(x.row), x.mine && coOf(x.mine), x.ticker].filter(Boolean) as string[]));
  const watchJ = model.rows.filter((r) => isOwn(r) && r.quality && !r.pass && r.drop != null).sort((a, b) => (b.drop ?? -9) - (a.drop ?? -9));
  const watchS = model.rows
    .filter((r) => isOwn(r) && r.quality && !r.pass_v2 && r.gap != null)
    .sort((a, b) => Number(!!a.kill?.length) - Number(!!b.kill?.length) || (b.gap ?? -9) - (a.gap ?? -9));
  const traps = model.rows.filter((r) => isOwn(r) && !r.quality && r.gates.price).sort((a, b) => (b.alpha ?? 0) - (a.alpha ?? 0));
  return { byT, jPass, sPass, jTop, sTop, pTop, pmCands, authors, jCo, sCo, pCo, aCo, watchJ, watchS, traps, fairOf };
}

type Board = ReturnType<typeof boardData>;

/** 다른 목록에도 있는 종목 표시 — 주 · 시 · P(수석 PM) · 리(리서치) (같은 회사의 다른 상장도). */
function Marks({ r, b, self }: { r: VmRow; b: Board; self: "j" | "s" | "p" }) {
  const co = coOf(r);
  return (
    <span className="vm-mk">
      {self !== "j" && b.jCo.has(co) && <span className="vm-mk__b vm-mk__b--j" title={`${JUNIOR} 목록에도 있음`}>주</span>}
      {self !== "s" && b.sCo.has(co) && <span className="vm-mk__b vm-mk__b--s" title={`${SENIOR} 목록에도 있음`}>시</span>}
      {self !== "p" && b.pCo.has(co) && <span className="vm-mk__b vm-mk__b--p" title={`${PM} 포트폴리오에도 있음`}>P</span>}
      {(b.aCo.has(co) || r.author === "coverage" || r.author === "research") &&
        <span className="vm-mk__b vm-mk__b--a" title="리서치 종목이기도 함">리</span>}
    </span>
  );
}

/** 티커 옆 현재가 / 매수 기준가 (2026-11-16 사용자). 매수 기준가 = 이 가격 이하면 가격 관문(알파 ≥ 5%p) 통과 — 안전마진을 둔
 *  '사도 되는 최고 가격'이지 목표가는 아니다. 지금 그 아래면 파랑, 위면 빨강. */
function PxBuy({ r }: { r: VmRow }) {
  if (r.price == null) return null;
  const cheap = r.buy != null && r.buy >= r.price;
  return (
    <span className="vm-px num"
      title="현재가 / 매수 기준가 — 매수 기준가 이하면 기대수익률이 요구수익률보다 5%p 이상 높다 (안전마진을 둔 사도 되는 최고 가격)">
      {money(r.price, r.ticker)}<span className="vm-px__sep">/</span>
      <b className={r.buy == null ? "muted" : cheap ? "vm-px__ok" : "vm-px__no"}>{r.buy == null ? "—" : money(r.buy, r.ticker)}</b>
    </span>
  );
}

const FAIR_TIP = "적정가 범위 (하방 ~ 기본) — 기대수익률이 요구수익률과 같아지는 주가. 기본 = 지금 가정(3년 평균 FCF · 5년 매출 성장 · "
  + "그 뒤 2.5%), 하방 = FCF −30% · 성장 0 이하. 가정 하나에 크게 달라져 목표가로 쓰지 않는다 — 과거 시험에서 적정가보다 싼 종목을 사도 "
  + "SPY 를 이기지 못했다.";

/** 적정가 범위 글자 — $10 이상은 정수, 그 아래는 소수 둘째 자리. */
function fairText(f: FairRange, ticker: string): string {
  const fm = (v: number) => money(v, ticker, Math.abs(v) >= 10 ? 0 : 2);
  return `${fm(f.low)}~${fm(f.base)}`;
}

function FairChip({ f, ticker }: { f: FairRange | null | undefined; ticker: string }) {
  if (!f) return null;
  return <span className="vm-fair num" title={FAIR_TIP}>적정 {fairText(f, ticker)}</span>;
}

function Li({ rank, r, metric, metricTone, sub, marks, hot, fair }: {
  rank?: number; r: VmRow; metric: ReactNode; metricTone?: string; sub?: ReactNode; marks?: ReactNode; hot?: boolean;
  fair?: FairRange | null;
}) {
  return (
    <li className={`vm-li${hot ? " vm-li--hot" : ""}`}>
      {rank != null && <span className="vm-li__rk num">{rank}</span>}
      <span className="vm-li__who">
        <span className="vm-li__tk"><TickerLink ticker={r.ticker} />{marks}<GapMark r={r} /><PxBuy r={r} /></span>
        <span className="vm-li__nm" title={r.name ?? undefined}><FairChip f={fair} ticker={r.ticker} />{sub ?? r.name ?? ""}</span>
      </span>
      <span className={`vm-li__m num${metricTone ? ` ${metricTone}` : ""}`}>{metric}</span>
    </li>
  );
}

function ColHead({ icon, who, rule, tone: t }: { icon: IconName; who: string; rule: string; tone: "j" | "s" | "p" | "a" }) {
  return (
    <div className={`vm-col__head vm-col__head--${t}`}>
      <span className="vm-col__icon"><Icon name={icon} size={18} /></span>
      <div>
        <h3>{who}</h3>
        <p>{rule}</p>
      </div>
    </div>
  );
}

function Sub({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return <div className="vm-col__sub"><span>{children}</span>{aside && <span className="vm-col__subx">{aside}</span>}</div>;
}

// ── 통과 픽 (2026-11-12 밤, 사용자: "시니어 통과 픽 부분 예전처럼 — 주니어 통과 픽, 시니어 통과 픽") — 세 칸 판 위 두 칸.
//    분석가마다 1위 픽은 큰 카드(태그 · 설명 · 숫자 4개), 나머지 통과는 짧은 줄. 주니어 = 알파 순, 시니어 = 성장 괴리 순.

function PickHero({ r, mode, lang, fair }: { r: VmRow; mode: "junior" | "senior"; lang: Lang; fair?: FairRange | null }) {
  const senior = mode === "senior";
  const gap = fillNote(r);
  return (
    <div className="vm-hero">
      <h4 className="vm-hero__title">
        <TickerLink ticker={r.ticker} /> <span className="vm-hero__nm">{r.name}</span>
      </h4>
      <div className="vm-hero__tags">
        {r.industry && <Tag tone="info">{r.industry}</Tag>}
        <Tag tone="good">품질 5개 통과</Tag>
        {r.author && <Tag>{AUTHOR_TAG[r.author]}</Tag>}
        {senior && r.sensitive && <Tag tone="warn" title={`베타 0.6 이면 알파 ${ppv(r.alpha_b06)}`}>베타 민감</Tag>}
        {!senior && r.pass_v2 && <Tag tone="good">시니어도 통과</Tag>}
        {!senior && !r.pass_v2 && <Tag tone="warn">{r.kill?.length ? `시니어 반증: ${r.kill.join(" · ")}` : "시니어 하방 관문 탈락"}</Tag>}
        {gap && <Tag tone="warn" title={gap.long}>ROIC: {gap.short} → 0으로 계산</Tag>}
      </div>
      <p className="vm-hero__why">
        {senior
          ? <>하방 관문: FCF 가 30% 줄고 첫 5년 성장이 0 이하여도 알파 {ppv(r.alpha_bear)} ≥ 0. 실제 매출 성장 {pct(r.g1)} 인데 지금 주가는 {pct(r.implied_g)} 성장만 가정한다.
            {r.sensitive && <> 베타 하한을 0.6 으로 올리면 알파 {ppv(r.alpha_b06)} 로 가격 관문 탈락 — 베타 하나에 걸린 경계선 종목.</>}</>
          : <>품질 5개(ROE {r.gates.roe === null ? "판단 불가 — 자기자본 음수라 통과로 침" : plain(r.roe)} · ROIC {plain(r.roic)} &gt; WACC {plain(r.wacc)} · Z {r.z?.toFixed(2)} · M {r.m?.toFixed(2)} · FCF {r.fcf_years}년 플러스) + 가격 관문(알파 {ppv(r.alpha)} ≥ 5%p).</>}
        {" "}재무 {r.fetched ? `${fmtDate(r.fetched, lang)} 받음` : ""} · 베타 {r.beta?.toFixed(2)}.
      </p>
      <dl className="vm-hero__stats">
        <div><dt>현재가 / 매수 기준가</dt><dd className="num">{money(r.price, r.ticker)} / {money(r.buy, r.ticker)}
          {fair && <span className="vm-hero__fair" title={FAIR_TIP}>적정가 {fairText(fair, r.ticker)} (하방 ~ 기본)</span>}</dd></div>
        <div><dt>기대 알파 / 하방 알파</dt><dd className="num up">{ppv(r.alpha)} / {ppv(r.alpha_bear)}</dd></div>
        {senior ? <>
          <div><dt>성장률 (시장 가정 vs 실제)</dt><dd className="num">{pct(r.implied_g)} vs {pct(r.g1)}</dd></div>
          <div><dt>성장 괴리 / 3년 고점 대비</dt><dd className="num"><span className={tone(r.gap)}>{ppv(r.gap)}</span> <span className={tone(r.dd_3y)}>({pct(r.dd_3y, 0)})</span></dd></div>
        </> : <>
          <div><dt>FCF 수익률 / 요구수익률</dt><dd className="num">{plain(r.fcf_y)} / {plain(r.ke)}</dd></div>
          <div><dt>매수 기준가 여유 / 3년 고점 대비</dt><dd className="num">{pct(r.drop, 0)} <span className={tone(r.dd_3y)}>({pct(r.dd_3y, 0)})</span></dd></div>
        </>}
      </dl>
    </div>
  );
}

function PickPanel({ mode, rows, b, model, lang }: {
  mode: "junior" | "senior"; rows: VmRow[]; b: Board; model: ValueModel; lang: Lang;
}) {
  const senior = mode === "senior";
  const [top, ...rest] = rows;
  return (
    <section className={`vm-pick vm-pick--${senior ? "s" : "j"}`}>
      <div className="vm-pick__head">
        <span className="vm-pick__icon"><Icon name={senior ? "shield" : "check-badge"} size={20} /></span>
        <div>
          <h3>{senior ? "시니어 통과 픽" : "주니어 통과 픽"} <span className="vm-pick__n num">{rows.length}</span></h3>
          <p>{senior ? "주니어 통과 + 하방 관문 · 반증 없음 — 성장 괴리 큰 순" : "품질 5개 + 가격 관문 — 기대 알파 큰 순"}</p>
        </div>
      </div>
      {top ? <PickHero r={top} mode={mode} lang={lang} fair={b.fairOf(top)} /> : (
        <p className="vm-pick__none">
          {senior
            ? `지금은 없음 — 주니어 통과 ${model.funnel.pass}개 중 하방 관문(FCF −30% · 성장 0 이하)까지 넘은 종목이 없다.`
            : `지금은 없음 — 이 방식은 늘 여러 종목이 나오는 스크린이 아니다. 품질 통과 ${model.funnel.quality}개가 매수 기준가까지 내려오길 기다린다.`}
        </p>
      )}
      {rest.length > 0 && (
        <ol className="vm-list vm-pick__rest" start={2}>
          {rest.map((r, i) => (
            <Li key={r.ticker} rank={i + 2} r={r} fair={b.fairOf(r)}
              metric={senior ? <>괴리 {ppv(r.gap)}</> : <>알파 {ppv(r.alpha)}</>} metricTone={senior ? tone(r.gap) : "up"}
              sub={<>{r.name}{senior && <> · 하방 {ppv(r.alpha_bear)}</>}{senior && r.sensitive && <b className="vm-warn-t"> · 베타 민감</b>}</>}
              marks={<Marks r={r} b={b} self={senior ? "s" : "j"} />} />
          ))}
        </ol>
      )}
    </section>
  );
}

function JuniorCol({ b }: { b: Board }) {
  return (
    <section className="vm-col">
      <ColHead icon="user" who={JUNIOR} tone="j" rule="리서치 체크리스트 그대로 — 품질 5개 + 가격(알파 ≥ 5%p)" />
      <Sub aside="매수 기준가까지">상위 10 · 필요한 하락 작은 순</Sub>
      <ol className="vm-list">
        {b.jTop.map((r, i) => (
          <Li key={r.ticker} rank={i + 1} r={r} hot={r.pass} fair={b.fairOf(r)}
            metric={r.pass ? "통과" : pct(r.drop, 0)} metricTone={r.pass ? "up" : undefined}
            marks={<Marks r={r} b={b} self="j" />} />
        ))}
      </ol>
    </section>
  );
}

function SeniorCol({ b, model }: { b: Board; model: ValueModel }) {
  const v2 = model.v2;
  const theme = v2 ? Object.entries(v2.theme).filter(([, n]) => n >= v2.params.theme_warn) : [];
  return (
    <section className="vm-col">
      <ColHead icon="user-star" who={SENIOR} tone="s" rule="주니어 + 하방 관문 · 성장 괴리 순 · 반증 조건" />
      <Sub aside="성장 괴리">상위 10 · 괴리 큰 순 (반증 걸린 종목 제외)</Sub>
      {v2 ? (
        <ol className="vm-list">
          {b.sTop.map((r, i) => (
            <Li key={r.ticker} rank={i + 1} r={r} hot={r.pass_v2} metric={ppv(r.gap)} metricTone={tone(r.gap)} fair={b.fairOf(r)}
              marks={<Marks r={r} b={b} self="s" />} />
          ))}
        </ol>
      ) : <p className="vm-col__none">시니어 자료가 아직 없다</p>}
      {v2 && (
        <p className={`vm-col__note${theme.length ? " vm-col__note--warn" : ""}`}>
          업종 집중 (상위 {v2.params.theme_top} 안 같은 업종 {v2.params.theme_warn}개+):{" "}
          {theme.length ? theme.map(([ind, n]) => `${ind} ${n}`).join(" · ") : "없음 — 다각화 양호"}
        </p>
      )}
    </section>
  );
}

function Verdict({ r, label }: { r: VmRow | undefined; label: string }) {
  if (!r) return <span className="vm-vd vm-vd--na" title="자료 없음">{label} ·</span>;
  const ok = label === "주" ? r.pass : !!r.pass_v2;
  return <span className={`vm-vd${ok ? " vm-vd--ok" : ""}`} title={`${label === "주" ? JUNIOR : SENIOR} ${ok ? "통과" : "탈락"}`}>{label} {ok ? "✓" : "✕"}</span>;
}

function AuthorCol({ b, model, lang }: { b: Board; model: ValueModel; lang: Lang }) {
  const page = model.author.src === "page";
  return (
    <section className="vm-col vm-col--a">
      <ColHead icon="users" who="리서치" tone="a"
        rule={`커버리지 + 리서치 노트 — ${page ? "매주 확인한 목록" : "정리해 둔 목록"} (${fmtDate(model.author.as_of, lang)})`} />
      <Sub aside="목표까지 · 우리 판정">지금 목록 {b.authors.length}</Sub>
      <ol className="vm-list vm-list--a">
        {b.authors.map((x) => {
          const v = x.mine ?? x.row;
          const last = x.posts[x.posts.length - 1];
          const name = x.row?.name ?? x.mine?.name ?? "";
          const inPm = !!v && b.pCo.has(coOf(v));
          return (
            <li key={x.ticker} className={`vm-li vm-li--a${v?.pass ? " vm-li--hot" : ""}`}>
              <span className="vm-li__who">
                <span className="vm-li__tk">
                  <TickerLink ticker={x.ticker} />
                  {x.covered && <span className="vm-src__b vm-src__b--in" title={`커버리지${x.rating ? ` · ${x.rating}` : ""}`}>커버리지</span>}
                  {last && (
                    <span className="vm-src__b vm-src__b--post vm-src__b--in"
                      title={x.posts.map((p) => `${p.date} ${p.kind} · ${p.view}`).join("\n")}>
                      노트 {md(last.date)}{x.posts.length > 1 ? ` 외 ${x.posts.length - 1}` : ""}
                    </span>
                  )}
                </span>
                <span className="vm-li__nm" title={name}>
                  {name}
                  {last?.excess != null && <> · 노트 뒤 지수 대비 <b className={`num ${tone(last.excess)}`}>{ppv(last.excess)}</b></>}
                  {x.row && !isOwn(x.row) && (x.mine
                    ? <span className="vm-li__alias"> · 우리 대상에선 {x.mine.ticker}</span>
                    : <span className="vm-li__alias" title="시가총액 US$10억 미만 등 — 비교용으로만 계산"> · 우리 대상 밖</span>)}
                </span>
              </span>
              <span className="vm-li__m vm-li__m--a">
                <span className={`num ${tone(x.upside)}`}>{pct(x.upside, 0)}</span>
                <span className="vm-vds">
                  <Verdict r={v} label="주" /><Verdict r={v} label="시" />
                  {model.v3 && <span className={`vm-vd${inPm ? " vm-vd--ok" : ""}`} title={`${PM} 포트폴리오 ${inPm ? "편입" : "밖"}`}>P {inPm ? "✓" : "✕"}</span>}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Summary({ s }: { s: VmSummary | undefined }) {
  if (!s || !s.n) return <span className="muted">아직 없음</span>;
  return <><b className={`num ${tone(s.excess)}`}>{ppv(s.excess)}</b><span>{s.n}건 · 평균 {pct(s.ret)} · 이김 {s.beat}/{s.n}</span></>;
}

function TrackTable({ rows, lang }: { rows: VmTrack[]; lang: Lang }) {
  const exits = rows.some((r) => r.exit);
  return (
    <Table head={<>
      <th>종목</th><th>묶음</th><th>시작일</th><th className="r">시작가</th><th className="r">수익률</th>
      <th className="r">지수</th><th className="r">차이</th><th className="c">지금 통과</th>{exits && <th>끝</th>}
    </>}>
      {rows.map((r, i) => (
        <tr key={`${r.group}-${r.ticker}-${r.since}-${i}`}>
          <Who ticker={r.ticker} />
          <td><span className={`vm-g vm-g--${r.group}`}>{GROUP_LABEL[r.group]}</span></td>
          <td>{fmtDate(r.since, lang)}</td>
          <td className="r num">{money(r.entry, r.ticker)}</td>
          <td className={`r num ${tone(r.ret)}`}>{pct(r.ret)}</td>
          <td className="r num">{r.bench === "XIU.TO" ? "XIU " : "SPY "}{pct(r.bench_ret)}</td>
          <td className={`r num ${tone(r.excess)}`}>{ppv(r.excess)}</td>
          <td className="c">{r.passing ? <GateMark g={true} /> : <span className="muted">·</span>}</td>
          {exits && <td className="small">{r.exit ? `${fmtDate(r.exit, lang)} · ${r.reason ?? ""}` : ""}</td>}
        </tr>
      ))}
    </Table>
  );
}

function ScorePanel({ model, lang }: { model: ValueModel; lang: Lang }) {
  const tr = model.tracking;
  const w = tr.warmup;
  return (
    <Panel title="성적표 — 여섯 묶음을 같은 날부터"
      sub={w
        ? <>기록 준비 중 — 대상 {w.want.toLocaleString()}종목 중 재무를 받은 {w.have.toLocaleString()}종목 ({((w.have / Math.max(w.want, 1)) * 100).toFixed(0)}%).
          95%가 되는 밤부터 묶음들이 같은 날 시작한다 — 넓힌 대상 첫 밤에 일부만으로 상위 10 을 고르지 않게. PM 포트폴리오는 SBC · 희석주식수 자료가 95% 모인 밤부터.</>
        : <>{tr.start ? `${fmtDate(tr.start, lang)}부터` : "기록 시작 전"} · 통과 묶음은 처음 통과한 날, 상위 10 은 매달 첫 실행에 고른 날,
          리서치 종목은 목록에 처음 보인 날 종가부터. 배당 포함, 같은 기간 SPY(캐나다는 XIU) 대비. 규칙은 시작일에 고정 — 성적을 보고 고치지 않는다.</>}>
      <div className="vm-sum vm-sum--5 vm-sum--6">
        {SCORE_GROUPS.map((g) => (
          <div key={g} className="vm-sum__item">
            <span className={`vm-g vm-g--${g}`}>{GROUP_LABEL[g]}</span>
            <Summary s={tr.summary[g]} />
          </div>
        ))}
      </div>
      {tr.rows.length > 0 && <Fold title={`기록 전체 ${tr.rows.length}줄`}><TrackTable rows={tr.rows} lang={lang} /></Fold>}
    </Panel>
  );
}

// ── 대기 목록 · 가치 함정 (접어 둔 자세히)

function WatchTable({ rows, senior, fairOf }: { rows: VmRow[]; senior: boolean; fairOf: (r: VmRow) => FairRange | null }) {
  return (
    <Table head={<>
      <th>종목</th><th>업종</th><th className="r">현재가</th><th className="r">매수 기준가</th>
      <th className="r" title={FAIR_TIP}>적정가 (하방~기본)</th><th className="r">필요한 하락</th>
      {senior ? <>
        <th className="r">시장 가정 성장</th><th className="r">실제 성장</th><th className="r">성장 괴리</th><th>반증 조건</th>
      </> : <>
        <th className="r">3년 고점 대비</th><th className="r">ROIC</th><th className="r">FCF 수익률</th><th className="r">기대 알파</th>
      </>}
      <th>리서치</th>
    </>}>
      {rows.map((r) => (
        <tr key={r.ticker}>
          <Who ticker={r.ticker} name={r.name} />
          <td className="small vm-ind">{r.industry}</td>
          <td className="r num">{money(r.price, r.ticker)}</td>
          <BuyCell r={r} ticker={r.ticker} />
          <td className="r num vm-fair-td">{(() => { const f = fairOf(r); return f ? fairText(f, r.ticker) : "—"; })()}</td>
          <td className="r num">{pct(r.drop, 0)}</td>
          {senior ? <>
            <td className="r num">{pct(r.implied_g)}</td>
            <td className="r num">{pct(r.g1)}</td>
            <td className={`r num ${tone(r.gap)}`}>{ppv(r.gap)}</td>
            <td className="small">{r.kill?.length ? <span className="down">{r.kill.join(" · ")}</span> : <span className="muted">없음</span>}</td>
          </> : <>
            <td className={`r num ${tone(r.dd_3y)}`}>{pct(r.dd_3y, 0)}</td>
            <td className="r num">{plain(r.roic)}<GapMark r={r} compact /></td>
            <td className="r num">{plain(r.fcf_y)}</td>
            <td className={`r num ${tone(r.alpha)}`}>{ppv(r.alpha)}</td>
          </>}
          <td>{r.author === "coverage" || r.author === "research" ? <Tag>리서치도</Tag> : ""}</td>
        </tr>
      ))}
    </Table>
  );
}

function AuthorTable({ b, model }: { b: Board; model: ValueModel }) {
  return (
    <Table
      head={<>
        <th>종목</th><th className="r">현재가</th><th className="r">리서치 목표가</th><th className="r">우리 매수 기준가</th>
        <th className="r" title={FAIR_TIP}>우리 적정가 (하방~기본)</th>
        {GATES.map(([k, label]) => <th key={k} className="c">{label}</th>)}<th className="c">하방</th>
        <th className="r">기대 알파</th><th className="r">성장 괴리</th><th className="c">최종 상태</th>
      </>}
      foot={<span>기준: 10년 국채 {plain(model.params.rf)} + β × {plain(model.params.erp)} · 5년 뒤 성장 {plain(model.params.term_g)}.
        ✓ 통과 · ✕ 탈락 · – 판단 불가. 매수 기준가가 지금보다 높으면(파랑) 가격 관문 통과. 리서치와 우리 상장이 다르면 우리 대상 쪽 결과.</span>}>
      {b.authors.map((x) => {
        const r = x.mine ?? x.row;
        return (
          <tr key={x.ticker}>
            <Who ticker={x.ticker} name={r?.name} />
            <td className="r num">{money(x.price, x.ticker)}</td>
            <td className="r num">{money(x.target, x.ticker)}</td>
            <BuyCell r={x.row} ticker={x.ticker} />
            <td className="r num vm-fair-td">{(() => { const f = b.fairOf(x.row); return f ? fairText(f, x.ticker) : "—"; })()}</td>
            {GATES.map(([k]) => <td key={k} className="c">{r ? <GateMark g={r.gates[k]} /> : "·"}{k === "roic" && <GapMark r={r} compact />}</td>)}
            <td className="c">{r && r.g_bear !== undefined ? <GateMark g={r.g_bear} title="하방 관문 (FCF −30% · 성장 0 이하에서도 알파 ≥ 0)" /> : "·"}</td>
            <td className={`r num ${tone(r?.alpha)}`}>{ppv(r?.alpha)}</td>
            <td className={`r num ${tone(r?.gap)}`}>{ppv(r?.gap)}</td>
            <td className="c"><StatusBadge r={r} /></td>
          </tr>
        );
      })}
    </Table>
  );
}

// ── v3 수석 PM (2026-11-16) — 시니어 후보 중 사각지대 4개(SBC · 부채(EV) · 자본배분 · 업종 쏠림)를 막은 종목으로 10칸, 빈칸 SPY

function PmChecks({ r, ind }: { r: VmRow; ind?: { n: number; cap: number } }) {
  const p = r.pm;
  if (!p) return <span className="vm-pm__chk muted">자료 준비 중</span>;
  const items: [string, boolean, string][] = [
    ["①", p.sbc, `① SBC 를 비용으로 뺀 알파 ${ppv(p.alpha_real)} · 하방 ${ppv(p.alpha_bear_real)}${p.gaps.includes("sbc") ? " (SBC 자료 없음 → 0)" : ""}`],
    ["②", p.ev, `② 회사 전체(EV) 기준 알파 ${ppv(p.alpha_ev)} (vs WACC)`],
    ["③", p.cap, `③ 주주환원 ${pct(r.sh_y)} · 최근 2년 희석 연 ${pct(p.dil)}${p.gaps.includes("shares") ? " (희석 판단 불가)" : ""}`],
  ];
  if (ind) items.push(["④", ind.n <= ind.cap, `④ 업종 쏠림 — 이 포트폴리오에서 ${r.industry ?? "같은 업종"} ${ind.n}/${ind.cap}종목`]);
  return (
    <span className="vm-pm__chk">
      {items.map(([k, ok, t]) => <span key={k} className={`vm-pm__c vm-pm__c--${ok ? "ok" : "no"}`} title={t}>{k}</span>)}
    </span>
  );
}

function PmTable({ rows, picks }: { rows: VmRow[]; picks: Set<string> }) {
  return (
    <Table head={<>
      <th>종목</th><th>업종</th><th className="r">① SBC 차감 알파 · 하방</th><th className="r">② EV 알파</th>
      <th className="r">③ 주주환원 · 희석</th><th className="c">결과</th>
    </>}
      foot={<span>① ≥ 5%p · 하방 ≥ 0 / ② ≥ 5%p / ③ 주주환원 ≥ 0 · 희석 연 1% 이하. 빨간 칸이 걸린 관문. ④ 업종 상한은 통과 종목을 칸에 넣을 때 본다.</span>}>
      {rows.map((r) => {
        const p = r.pm;
        const fail = p ? [!p.sbc && "①", !p.ev && "②", !p.cap && "③"].filter(Boolean).join("·") : "";
        const res = !p ? "자료 준비 중" : picks.has(r.ticker) ? "편입" : p.pass ? "④ 업종 상한 · 10칸 밖" : `${fail} 탈락`;
        const t = !p ? "plain" : picks.has(r.ticker) ? "pass" : p.pass ? "warn" : "bad";
        return (
          <tr key={r.ticker}>
            <Who ticker={r.ticker} name={r.name} />
            <td className="small vm-ind">{r.industry}</td>
            <td className={`r num${p && !p.sbc ? " down" : ""}`}>{p ? `${ppv(p.alpha_real)} · ${ppv(p.alpha_bear_real)}` : "—"}</td>
            <td className={`r num${p && !p.ev ? " down" : ""}`}>{p ? ppv(p.alpha_ev) : "—"}</td>
            <td className={`r num${p && !p.cap ? " down" : ""}`}>{p ? `${pct(r.sh_y)} · ${pct(p.dil)}` : "—"}</td>
            <td className="c"><span className={`vm-st vm-st--${t}`}>{res}</span></td>
          </tr>
        );
      })}
    </Table>
  );
}

function PmCol({ b, model, lang }: { b: Board; model: ValueModel; lang: Lang }) {
  const v3 = model.v3;
  const n = v3?.params.slots ?? 10;
  const indN = new Map<string, number>();
  for (const r of b.pTop) indN.set(r.industry ?? "—", (indN.get(r.industry ?? "—") ?? 0) + 1);
  const spyN = n - b.pTop.length;
  const cov = v3?.want ? `${(v3.have ?? 0).toLocaleString()}/${v3.want.toLocaleString()}` : "";
  return (
    <section className="vm-col vm-col--p">
      <ColHead icon="wallet" who={PM} tone="p" rule="시니어 후보 + SBC · 부채(EV) · 희석 · 업종 쏠림 → 10칸, 빈칸은 SPY" />
      <Sub aside={v3 && (v3.ready
        ? <span className="vm-pm__st">기록 중{v3.start ? ` · ${fmtDate(v3.start, lang)}부터` : ""}</span>
        : <span className="vm-pm__st vm-pm__st--wait" title="SBC · 희석주식수를 새로 받는 중 — 대상의 95% 가 모이는 밤부터 기록 (그 전엔 임시 계산)">
          자료 준비 중 {cov}</span>)}>
        10칸 · SBC 차감 하방 알파 큰 순
      </Sub>
      {v3 ? (
        <ol className="vm-list">
          {b.pTop.map((r, i) => (
            <Li key={r.ticker} rank={i + 1} r={r} hot metric={<>하방 {ppv(r.pm?.alpha_bear_real)}</>} metricTone="up" fair={b.fairOf(r)}
              sub={<><PmChecks r={r} ind={{ n: indN.get(r.industry ?? "—") ?? 1, cap: v3.params.ind_cap }} />{r.name}</>}
              marks={<Marks r={r} b={b} self="p" />} />
          ))}
          {spyN > 0 && (
            <li className="vm-li vm-li--spy">
              <span className="vm-li__rk num">{b.pTop.length + 1}{spyN > 1 ? `–${n}` : ""}</span>
              <span className="vm-li__who">
                <span className="vm-li__tk"><b>SPY</b></span>
                <span className="vm-li__nm">빈칸 {spyN}칸 — 고를 게 없는 자리는 지수</span>
              </span>
              <span className="vm-li__m num">{Math.round((spyN / n) * 100)}%</span>
            </li>
          )}
        </ol>
      ) : <p className="vm-col__none">수석 PM 자료가 아직 없다</p>}
      {v3 && (
        <p className="vm-col__note">
          ①②③④ = SBC 차감 · 회사 전체(EV) · 주주환원 · 희석 · 업종 상한 (마우스를 올리면 숫자). 과거 재검증(2014~2026, 1년에 한 번)은
          S&P 500 기준 SPY 와 비슷(샤프 0.92 vs 0.95)했고 고른 종목만은 약했다 — 앞으로 기록으로 판정.
        </p>
      )}
    </section>
  );
}

// ── 탭 ① 분석가 보드

type ViewProps = { model: ValueModel; lang: Lang };

export function BoardView({ model, lang }: ViewProps) {
  const b = boardData(model);
  const TOP = 15;
  return (
    <>
      <div className="vm-picks">
        <PickPanel mode="junior" rows={b.jPass} b={b} model={model} lang={lang} />
        <PickPanel mode="senior" rows={b.sPass} b={b} model={model} lang={lang} />
      </div>
      <div className="vm-board">
        <JuniorCol b={b} />
        <SeniorCol b={b} model={model} />
        <PmCol b={b} model={model} lang={lang} />
        <AuthorCol b={b} model={model} lang={lang} />
      </div>
      <p className="vm-board__key">
        <span className="vm-mk__b vm-mk__b--j">주</span> <span className="vm-mk__b vm-mk__b--s">시</span>{" "}
        <span className="vm-mk__b vm-mk__b--p">P</span> <span className="vm-mk__b vm-mk__b--a">리</span>
        {" "}= 다른 목록에도 있는 종목 (같은 회사의 다른 상장 포함). 티커 옆 숫자는 현재가 / 매수 기준가 — 매수 기준가 이하면 가격 관문 통과(파랑). '적정' 은 기대수익률이 요구수익률과 같아지는 주가의 범위(하방 FCF −30% · 성장 0 ~ 기본 가정) — 가정에 따라 크게 달라 목표가로 쓰지 않는다.
        분석가들은 리서치 종목을 모르는 채 우리 대상에서만 고른다.
      </p>
      <ScorePanel model={model} lang={lang} />
      {model.v3 && (
        <Fold title={`${PM} 심사 — ${SENIOR} 후보 ${b.pmCands.length}개가 어느 관문에서 걸렸나`}>
          <PmTable rows={b.pmCands} picks={new Set(model.v3.top)} />
        </Fold>
      )}
      <Fold title={`리서치 종목 ${b.authors.length}개 — 우리 관문 자세히 (✓ · ✕)`}><AuthorTable b={b} model={model} /></Fold>
      <Fold title={`${JUNIOR} 대기 목록 전체 — 품질 5개 통과, 가격만 남음 (${b.watchJ.length})`}>
        <WatchTable rows={b.watchJ.slice(0, TOP)} senior={false} fairOf={b.fairOf} />
        {b.watchJ.length > TOP && <Fold title={`나머지 ${b.watchJ.length - TOP}종목`}><WatchTable rows={b.watchJ.slice(TOP)} senior={false} fairOf={b.fairOf} /></Fold>}
      </Fold>
      {model.v2 && (
        <Fold title={`${SENIOR} 대기 목록 전체 — 성장 괴리 큰 순, 반증 걸린 종목은 뒤로 (${b.watchS.length})`}>
          <WatchTable rows={b.watchS.slice(0, TOP)} senior fairOf={b.fairOf} />
          {b.watchS.length > TOP && <Fold title={`나머지 ${b.watchS.length - TOP}종목`}><WatchTable rows={b.watchS.slice(TOP)} senior fairOf={b.fairOf} /></Fold>}
        </Fold>
      )}
      <Fold title={`가격만 싼 종목 ${b.traps.length}개 — 품질에서 떨어진 '싼 이유가 있는' 회사 (가치 함정 후보)`}>
        <div className="vm-chips">
          {b.traps.map((r) => (
            <span key={r.ticker} className="vm-chip vm-chip--trap" title={`알파 ${ppv(r.alpha)}`}>
              <TickerLink ticker={r.ticker} /> <span>{r.fails.join("·")} 탈락</span>
            </span>
          ))}
        </div>
      </Fold>
    </>
  );
}

// ── 탭 ② 문서 기록 — 규칙 · 스크린 과거 목록 (회고 · 리서치 정리는 page 에서 끼운다)

function RuleStrip({ who, items, note }: { who: string; items: string[]; note: ReactNode }) {
  return (
    <div className="vm-rule">
      <b>{who}</b>
      <ol>{items.map((x) => <li key={x}>{x}</li>)}</ol>
      <p>{note}</p>
    </div>
  );
}

export const DOC_SECTIONS = [
  { id: "vm-rules", label: "분석가 규칙 (v1 · v2 · v3)" },
  { id: "vm-retro", label: "회고 — 그때로 돌아가면" },
  { id: "vm-aseries", label: "스크린 과거 목록" },
] as const;

export function DocRules({ model }: { model: ValueModel }) {
  const p = model.params;
  const u = p.universe;
  return (
    <section className="vm-rules" id="vm-rules">
      <RuleStrip who={`${JUNIOR} · v1`}
        items={[
          u?.size
            ? `대상 — 미국 상장 + TSX, 시가총액 US$10억 이상, 은행 · 보험 · 운용 · 리츠 제외 (지금 ${u.size.toLocaleString()}종목). 같은 회사는 한 줄(TSX 쪽 우선)`
            : "대상 — S&P 500 + 리서치 종목 (예전 기준)",
          `품질 5개 — ROE 평균 ≥ ${plain(p.roe_min)} · CV ≤ ${p.cv_max} / ROIC ≥ ${plain(p.roic_min)} · WACC 초과 / Altman Z ≥ ${p.altman_min} / Beneish M ≤ ${p.beneish_max} / FCF 매년 플러스`,
          `가격 — 2단계 DCF 기대수익률 − 요구수익률 ≥ ${ppv(p.alpha_min)} (5년 뒤 성장 ${plain(p.term_g)})`,
          "상위 10 — 매수 기준가까지 필요한 하락이 작은 순 (매달 첫 실행에 다시 고름)",
          "적정가 범위 (표시만) — 기대수익률 = 요구수익률이 되는 주가. 하방(FCF −30% · 첫 5년 성장 0 이하) ~ 기본 가정. 매수 기준가는 같은 식을 요구수익률 + 5%p 로 한 값이라 늘 더 낮다. 가정 하나에 크게 흔들려 목표가로 쓰지 않는다",
        ]}
        note="리서치 체크리스트를 그대로 옮긴 규칙. 리서치 종목은 모르는 채 위 대상에서만 고른다 — 통과하면 그날 종가부터 계속 기록." />
      <RuleStrip who={`${SENIOR} · v2`}
        items={[
          `${JUNIOR} 통과 + 하방 관문(FCF 30% 감소 · 첫 5년 성장 0 이하에서도 알파 ≥ 0) + 반증 조건 없음`,
          "상위 10 — 성장 괴리(실제 매출 성장 − 지금 주가가 가정하는 영구 성장) 큰 순, 반증 조건 걸린 종목 제외",
          "반증 조건 — 품질 탈락 · 매출 감소 · 시장 가정 성장 > 실제 · 적정가 도달 중 하나면 통과 픽에서 빠지고 기록 끝 (풀려서 다시 통과하면 새로 기록)",
        ]}
        note="베타 민감(베타 하한 0.6 이면 탈락) · 업종 집중(상위 20 안 같은 업종 3개 이상)은 표시만." />
      {model.v3 && (
        <RuleStrip who={`${PM} · v3`}
          items={[
            `${SENIOR} 후보(품질 통과 · 반증 조건 없음)에서 시작 — ① SBC(주식보상)를 비용으로 뺀 FCF 로도 가격 관문(알파 ≥ ${ppv(model.v3.params.alpha_min)}) · 하방 관문(FCF ${Math.round(model.v3.params.bear_fcf_cut * 100)}% 감소 · 성장 0 이하에서도 알파 ≥ 0)`,
            `② 레버리지 착시 — 부채까지 포함한 회사 전체로: (FCF − SBC + 세후 이자) ÷ EV 의 기대수익률 − WACC ≥ ${ppv(model.v3.params.alpha_min)}`,
            `③ 자본배분 · 희석 — 주주환원율(3년 평균 배당 + 자사주 − 발행) ≥ 0 · 최근 2년 희석주식수 연 ${plain(model.v3.params.dil_max)} 이하`,
            `④ 업종 쏠림 · 포트폴리오 — SBC 차감 하방 알파 큰 순 ${model.v3.params.slots}칸, 같은 업종 ${model.v3.params.ind_cap}개까지, 칸당 ${Math.round(100 / model.v3.params.slots)}%, 빈칸은 SPY. 매달 첫 실행에 다시 맞추고 반증 조건이면 그날 SPY 로`,
          ]}
          note="문서(월스트리트 분석 · v3 제안)의 사각지대 4개를 담되, EV 식은 부채를 두 번 세지 않게 고쳤다(문서 식은 레버리지 FCF 를 EV 로 나눠 Ke 와 비교). 과거 재검증은 운과 구분 안 됨 — 규칙을 고정하고 앞으로 기록으로 판정." />
      )}
      <RuleStrip who="리서치"
        items={[
          "커버리지 목록 — 목표가 · 의견. 매주 한 번 확인해 저절로 따라간다 (추가 · 삭제 · 목표가)",
          "리서치 노트 — 노트를 읽어 종목 · 결론 · 목표가를 한 줄씩 더한다 (새 노트 알림 → '새 노트 정리해줘')",
          "고르는 방식 — 체크리스트 + 재량 DCF + 역발상(큰 하락 뒤). 정리는 아래 리서치 정리 4 · 5절",
        ]}
        note="모든 목록을 같은 날부터 기록해 누가 나은지 본다 — 리서치 종목은 목록에 처음 보인 날, 빠지면 그날 기록 끝." />
    </section>
  );
}

export function ScreenTable({ model, lang }: ViewProps) {
  const byT = new Map(model.rows.map((r) => [r.ticker, r]));
  const rows = model.author.screen.map((s) => ({ s, r: byT.get(s.ticker) }));
  return (
    <Panel id="vm-aseries" title="리서치 스크린 과거 목록 — 지금 우리 관문으로"
      sub="리서치 시황 노트(2025-09 말 · 10월 말)에 실린 체크리스트 통과 · 저평가 목록. 지금 추천하는 목록은 아니다 — 게시일 기준 결과는 위 회고에.">
      <Table head={<>
        <th>종목</th><th>게시</th><th className="r">현재가</th><th className="r">우리 매수 기준가</th>
        {GATES.map(([k, label]) => <th key={k} className="c">{label}</th>)}<th className="c">하방</th>
        <th className="r">기대 알파</th><th className="c">최종 상태</th>
      </>}>
        {rows.map(({ s, r }) => (
          <tr key={`${s.ticker}-${s.date}`}>
            <Who ticker={s.ticker} name={r?.name} />
            <td>{fmtDate(s.date, lang)}</td>
            <td className="r num">{money(r?.price, s.ticker)}</td>
            <BuyCell r={r} ticker={s.ticker} />
            {GATES.map(([k]) => <td key={k} className="c">{r ? <GateMark g={r.gates[k]} /> : "·"}{k === "roic" && <GapMark r={r} compact />}</td>)}
            <td className="c">{r && r.g_bear !== undefined ? <GateMark g={r.g_bear} /> : "·"}</td>
            <td className={`r num ${tone(r?.alpha)}`}>{ppv(r?.alpha)}</td>
            <td className="c"><StatusBadge r={r} /></td>
          </tr>
        ))}
      </Table>
    </Panel>
  );
}
