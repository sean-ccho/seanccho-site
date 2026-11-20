import Link from "next/link";
import type { ReactNode } from "react";
import { DataStatusChip } from "./DataStatusChip";
import { Icon, type IconName } from "./Icon";
import { TickerLink } from "./TickerLink";
import { fmtDate, money, pct, tone } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import type { DsFile } from "@/lib/dataStatus";
import { BETA_FLOOR, betaAtFloor, betaLabel, betaMinOne, fairRange, fairRangeAtBeta1, type FairRange, type Gate, type ValueModel, type VmGroup, type VmResearch,
  type VmListKey, type VmRow, type VmSummary, type VmTab, type VmTrack } from "@/lib/valueModel";

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

export const JUNIOR = "주니어 분석가";
export const SENIOR = "시니어 분석가";
export const PM = "수석 PM";

const WHO = {
  ko: { junior: JUNIOR, senior: SENIOR, pm: PM, research: "리서치" },
  en: { junior: "Junior Analyst", senior: "Senior Analyst", pm: "Lead PM", research: "Research" },
} as const;

const GATES_BY_LANG = {
  ko: [["roe", "ROE"], ["roic", "ROIC"], ["z", "Z"], ["m", "M"], ["fcf", "FCF"], ["price", "가격"]] as const,
  en: [["roe", "ROE"], ["roic", "ROIC"], ["z", "Z"], ["m", "M"], ["fcf", "FCF"], ["price", "Price"]] as const,
};

const AUTHOR_TAG = {
  ko: { coverage: "리서치 커버리지 일치", research: "리서치 노트 종목", screen: "리서치 스크린 목록" } as const,
  en: { coverage: "Matches research coverage", research: "Research note stock", screen: "Research screen list" } as const,
};

const GROUP_LABEL: Record<Lang, Record<VmGroup, string>> = {
  ko: {
    ours: "주니어 통과", v1_top: "주니어 상위 10", v2: "시니어 통과", v2_top: "시니어 상위 10", v3: "PM 포트폴리오",
    author: "리서치 종목",
  },
  en: {
    ours: "Junior pass", v1_top: "Junior top 10", v2: "Senior pass", v2_top: "Senior top 10", v3: "PM portfolio",
    author: "Research picks",
  },
};
const SCORE_GROUPS: VmGroup[] = ["ours", "v1_top", "v2", "v2_top", "v3", "author"];

const KILL_EN: Record<string, string> = {
  "품질 탈락": "Failed quality",
  "매출 감소 (최근 분기 · 연간)": "Revenue declining (latest qtr & annual)",
  "시장 가정 성장 > 실제": "Market-implied growth > actual",
  "적정가 도달": "Reached fair value",
};

function killItem(s: string, lang: Lang): string {
  return lang === "en" ? (KILL_EN[s] ?? s) : s;
}

function killJoin(ks: string[] | undefined, lang: Lang): string {
  return (ks ?? []).map((k) => killItem(k, lang)).join(" · ");
}

function reasonText(s: string | null | undefined, lang: Lang): string {
  if (!s) return "";
  if (lang === "ko") return s;
  if (s === "순위 밖 (월 교체)") return "Out of top 10 (monthly rebalance)";
  if (s === "PM 포트폴리오에서 빠짐 (월 교체)") return "Removed from PM portfolio (monthly rebalance)";
  if (s === "저자 목록에서 빠짐") return "Removed from research list";
  if (s.startsWith("반증: ")) {
    const rest = s.slice("반증: ".length).split(" · ").map((k) => killItem(k, "en")).join(" · ");
    return `Disconfirmed: ${rest}`;
  }
  return s.split(" · ").map((k) => killItem(k, "en")).join(" · ");
}

const FAIR_TIP: Record<Lang, string> = {
  ko: "적정가 범위 (하방 ~ 기본) — 기대수익률이 요구수익률과 같아지는 주가. 기본 = 지금 가정(3년 평균 FCF · 5년 매출 성장 · "
    + "그 뒤 2.5%), 하방 = FCF −30% · 성장 0 이하. 가정 하나에 크게 달라져 목표가로 쓰지 않는다 — 과거 시험에서 적정가보다 싼 종목을 사도 "
    + "SPY 를 이기지 못했다.",
  en: "Fair value range (bear ~ base) — the share price where expected return equals required return. Base = current assumptions (3-yr avg FCF · 5-yr revenue growth · "
    + "2.5% thereafter); bear = FCF −30% · growth ≤ 0. Sensitive to a single assumption, so not used as a target price — in backtests, buying below fair value did not beat SPY.",
};

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

export function GateMark({ g, title, lang = "ko" }: { g: Gate | undefined; title?: string; lang?: Lang }) {
  const passLabel = lang === "en" ? "Pass" : "통과";
  const failLabel = lang === "en" ? "Fail" : "탈락";
  const naTitle = lang === "en" ? "N/A — counted as pass (e.g. ROE with negative equity)" : "판단 불가 — 통과로 친다 (자기자본 음수의 ROE 등)";
  const naLabel = lang === "en" ? "N/A" : "판단 불가";
  if (g === true) {
    return <span className="vm-ck vm-ck--ok" title={title ?? passLabel} role="img" aria-label={passLabel}><Stroke d="M5 12.5l4.5 4.5L19 7.5" /></span>;
  }
  if (g === false) {
    return <span className="vm-ck vm-ck--no" title={title ?? failLabel} role="img" aria-label={failLabel}><Stroke d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></span>;
  }
  return <span className="vm-ck vm-ck--na" title={naTitle} role="img" aria-label={naLabel}>–</span>;
}

/** ROIC 의 부채 · 현금을 자료가 없어 0 으로 계산했는지 (2026-11-16, 사용자: "정보를 못 가져온 거면 확실하게 표시"). */
function fillNote(r: VmRow | undefined, lang: Lang = "ko"): { short: string; long: string } | null {
  const f = r?.fill0;
  if (!f || !(f.debt || f.cash)) return null;
  if (lang === "en") {
    const what = [f.debt ? "debt" : "", f.cash ? "cash" : ""].filter(Boolean).join("/");
    const yrs = [f.debt ? `debt ${f.debt} of ${f.years} yrs` : "", f.cash ? `cash ${f.cash} of ${f.years} yrs` : ""].filter(Boolean).join(" · ");
    return {
      short: `No ${what} data`,
      long: `ROIC calculation: ${yrs} had no data in Yahoo financials and were treated as 0. Debt-free companies often omit the line altogether, `
        + "but if the company actually had debt, ROIC appears higher than reality (ROIC = NOPAT ÷ (debt + equity − cash)).",
    };
  }
  const what = [f.debt ? "부채" : "", f.cash ? "현금" : ""].filter(Boolean).join("·");
  const yrs = [f.debt ? `부채 ${f.years}년 중 ${f.debt}년` : "", f.cash ? `현금 ${f.years}년 중 ${f.cash}년` : ""].filter(Boolean).join(" · ");
  return {
    short: `${what} 자료 없음`,
    long: `ROIC 계산: ${yrs}은 Yahoo 재무제표에 자료가 없어 0으로 계산했다. 빚이 없는 회사는 보통 그 줄 자체가 없지만, `
      + "실제로 부채가 있었다면 ROIC 가 실제보다 높게 나온다 (ROIC = 세후 영업이익 ÷ (부채 + 자본 − 현금)).",
  };
}

/** 목록 · 표에 붙이는 작은 경고 — '부채 자료 없음 → 0'. */
function GapMark({ r, compact, lang = "ko" }: { r: VmRow | undefined; compact?: boolean; lang?: Lang }) {
  const n = fillNote(r, lang);
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

function Table({ head, children, foot, group, wide }: {
  head: ReactNode; children: ReactNode; foot?: ReactNode;
  /** 칸 묶음 머리 줄 (head 위) — 주니어 · 시니어 · 수석 PM 공통 표 (2026-11-19) */
  group?: ReactNode;
  /** 넓은 표 — 데스크톱에서도 첫 칸(종목) 고정 */
  wide?: boolean;
}) {
  return (
    <>
      <div className="table-wrap vm-tw">
        <table className={wide ? "vm-t vm-t--wide" : "vm-t"}>
          <thead>{group && <tr className="vm-t__grp">{group}</tr>}<tr>{head}</tr></thead>
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
function status(r: VmRow | undefined, lang: Lang = "ko"): { label: string; t: "pass" | "junior" | "plain" | "warn" | "bad"; title?: string } {
  if (lang === "en") {
    if (!r) return { label: "No data", t: "plain" };
    const kill = r.kill?.length ? `Senior disconfirming: ${killJoin(r.kill, "en")}` : undefined;
    if (r.pass_v2) return { label: "Senior pass", t: "pass" };
    if (r.pass) return { label: "Junior only", t: "junior", title: "Failed downside gate (alpha ≥ 0 even with FCF −30% & growth ≤ 0)" };
    const f = r.fails;
    if (!f.length) return { label: "Quality OK · pricey", t: "plain", title: kill };
    if (r.gates.price) return { label: `Price OK · failed ${f.join("·")}`, t: "warn", title: kill };
    if (r.fcf_y == null || r.fcf_y <= 0 || r.buy == null) return { label: "FCF negative", t: "bad", title: kill };
    if (f.length >= 3) return { label: "Quality & price fail", t: "bad", title: `${f.join(" · ")} · Price fail` };
    return { label: `${f.join("·")} & price fail`, t: "bad", title: kill };
  }
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

function StatusBadge({ r, lang = "ko" }: { r: VmRow | undefined; lang?: Lang }) {
  const s = status(r, lang);
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

/** '2026-11-17' → '11월 17일' / 'Nov 17'. */
function fmtDateShort(iso: string, lang: Lang = "ko"): string {
  return lang === "en" ? fmtDate(iso, "en") : `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;
}

export function VmKpis({ model, lang = "ko" }: { model: ValueModel; lang?: Lang }) {
  const f = model.funnel;
  const p = model.params;
  const u = p.universe;
  const picks = model.rows.filter((r) => isOwn(r) && r.pass_v2);
  const one = picks.length === 1 ? picks[0] : null;
  const rate = f.computed ? (f.quality / f.computed) * 100 : 0;
  const us = u?.by_market ? (u.by_market.sp500 ?? 0) + (u.by_market.nasdaq ?? 0) : null;
  const pm = model.v3;
  const pmPicks = (pm?.top ?? []).map((t) => model.rows.find((r) => r.ticker === t)).filter((r): r is VmRow => !!r);
  const w = WHO[lang];
  const en = lang === "en";
  return (
    <div className="vm-kpis">
      {u?.size ? (
        <Kpi label={en ? "Target universe" : "분석 대상 유니버스"} icon="database"
          tag={en ? "Cap $1B+ · ex-financials & REITs" : "시총 $10억+ · 금융·리츠 제외"}
          foot={us != null
            ? (en
              ? `US ${us.toLocaleString()} · TSX ${(u.by_market?.tsx ?? 0).toLocaleString()} · computed ${f.computed.toLocaleString()}`
              : `미국 ${us.toLocaleString()} · TSX ${(u.by_market?.tsx ?? 0).toLocaleString()} · 계산 ${f.computed.toLocaleString()}`)
            : (en ? `Computed ${f.computed}` : `계산 ${f.computed}`)}>
          <b className="vm-kpi__n">{u.size.toLocaleString()}</b><span>{en ? "stocks" : "개"}</span>
        </Kpi>
      ) : (
        <Kpi label={en ? "Target universe" : "분석 대상 유니버스"} icon="database"
          foot={en ? `Excluded ${f.excluded} financials & REITs` : `금융 · 리츠 제외 ${f.excluded}개`}
          tag={en ? "S&P 500 + research picks" : "S&P 500 + 리서치 종목"}>
          <b className="vm-kpi__n">{f.computed}</b><span>{en ? "stocks" : "개"}</span>
        </Kpi>
      )}
      <Kpi label={en ? "Passed 5 quality gates" : "품질 5대 관문 통과"} icon="check-badge" className="vm-kpi--good"
        foot={<span className="num">ROE {f.roe} · ROIC {f.roic} · Z {f.z} · M {f.m} · FCF {f.fcf}</span>}>
        <b className="vm-kpi__n">{f.quality}</b><span>{en ? `(${rate.toFixed(1)}% pass rate)` : `개 (통과율 ${rate.toFixed(1)}%)`}</span>
      </Kpi>
      <Kpi label={en ? "Passed price gate" : "가격 관문 통과"} icon="scale"
        foot={en
          ? `Required return = 10Y Treasury ${plain(p.rf)} + β × ${plain(p.erp)}${model.live ? ` · count as of ${fmtDateShort(model.date, lang)} close` : ""}`
          : `요구수익률 = 10년 국채 ${plain(p.rf)} + β × ${plain(p.erp)}${model.live ? ` · 이 수는 ${fmtDateShort(model.date, lang)} 종가 기준` : ""}`}
        tag={en ? "2-stage DCF" : "DCF 2단계"}>
        <b className="vm-kpi__n">{f.price}</b><span>{en ? `(alpha ≥ ${ppv(p.alpha_min)})` : `개 (알파 ≥ ${ppv(p.alpha_min)})`}</span>
      </Kpi>
      {pm ? (
        <Kpi label={en ? `${w.pm} final portfolio` : `${PM} 최종 포트폴리오`} icon="pin" className="vm-kpi--pick"
          foot={en
            ? `${pmPicks.length} of 10 slots in stocks · ${pm.params.slots - pmPicks.length} in SPY${pm.ready ? "" : " · provisional (data warming up)"}${model.live ? ` · as of ${fmtDateShort(model.date, lang)} close` : ""}`
            : `10칸 중 종목 ${pmPicks.length}칸 · SPY ${pm.params.slots - pmPicks.length}칸${pm.ready ? "" : " · 자료 준비 중이라 임시"}${model.live ? ` · ${fmtDateShort(model.date, lang)} 종가 기준` : ""}`}>
          <b className="vm-kpi__n">{pmPicks.length}</b>
          <span>{en ? (pmPicks.length ? "stocks" : "stocks — all SPY") : (pmPicks.length ? "종목" : "종목 — 전부 SPY")}</span>
          {pmPicks.length > 0 && (
            <span className="vm-kpi__list vm-kpi__list--row">
              {pmPicks.map((r) => <TickerLink key={r.ticker} ticker={r.ticker} />)}
            </span>
          )}
        </Kpi>
      ) : (
        <Kpi label={en ? `${w.senior} final pick` : `${SENIOR} 최종 픽`} icon="pin" className="vm-kpi--pick"
          foot={one
            ? <>{en ? "Bear alpha " : "하방 알파 "}{ppv(one.alpha_bear)}{one.author ? (en ? " · Also in research" : " · 리서치도 ○") : ""}{one.sensitive ? " · " : ""}{one.sensitive && <b className="vm-warn-t">{en ? "Beta-sensitive" : "베타 민감"}</b>}</>
            : picks.length
              ? (en ? `From ${f.pass} ${w.junior} passes after downside & disconfirming` : `${JUNIOR} 통과 ${f.pass}개 중 하방 관문 · 반증까지`)
              : (en ? `${w.junior} pass ${f.pass} · Senior 0` : `${JUNIOR} 통과 ${f.pass}개 · 시니어 0`)}>
          {one ? (
            <div className="vm-kpi__pick">
              <span className="vm-kpi__tk"><TickerLink ticker={one.ticker} /></span>
              <span className="vm-kpi__nm">{one.name}</span>
              <span className="vm-kpi__chip">{en ? "Alpha" : "알파"}<b>{ppv(one.alpha)}</b></span>
            </div>
          ) : picks.length ? (
            <>
              <b className="vm-kpi__n">{picks.length}</b><span>{en ? "stocks" : "개"}</span>
              <span className="vm-kpi__list vm-kpi__list--row">
                {picks.slice(0, 6).map((r) => <TickerLink key={r.ticker} ticker={r.ticker} />)}
                {picks.length > 6 && <span className="muted">{en ? `+${picks.length - 6} more` : `외 ${picks.length - 6}`}</span>}
              </span>
            </>
          ) : (
            <><b className="vm-kpi__n">0</b><span>{en ? "stocks — none right now" : "개 — 지금은 없음"}</span></>
          )}
        </Kpi>
      )}
    </div>
  );
}

// ── 안쪽 탭 (2개)

const TABS: Record<Lang, { key: VmTab; label: string; sub: string; icon: IconName }[]> = {
  ko: [
    { key: "board", label: "분석가 보드", sub: "주니어 · 시니어 · PM · 리서치", icon: "compare" },
    { key: "doc", label: "문서 기록", sub: "규칙 · 회고 · 리서치 정리", icon: "doc" },
  ],
  en: [
    { key: "board", label: "Analyst Board", sub: "Junior · Senior · PM · Research", icon: "compare" },
    { key: "doc", label: "Documentation", sub: "Rules · Retro · Research Notes", icon: "doc" },
  ],
};

export function VmTabBar({ tab, model, live, failed, lang, status }: {
  tab: VmTab; model: ValueModel; live: boolean; failed?: string; lang: Lang;
  /** 자료 상태 (2026-11-13) — 계산된 종목 ÷ 대상 · 기록 준비 중 (lib/dataStatus valueModelStatus) */
  status?: DsFile;
}) {
  const en = lang === "en";
  return (
    <div className="vm-tabbar">
      <nav className="vm-tabs" aria-label={en ? "Value model views" : "예측 모델 보기"}>
        {TABS[lang].map((x) => (
          <Link key={x.key} href={x.key === "board" ? "/quant/model" : `/quant/model?tab=${x.key}`}
            aria-current={x.key === tab ? "page" : undefined} scroll={false}>
            <Icon name={x.icon} size={16} />
            <span>{x.label}</span>
            <span className="vm-tabs__sub">{x.sub}</span>
          </Link>
        ))}
      </nav>
      <p className={`vm-tabbar__meta${live ? "" : " vm-tabbar__meta--snap"}${model.live ? " vm-tabbar__meta--live" : ""}`}>
        <span className="vm-dot" aria-hidden="true" />
        {live && model.live
          ? (en
            ? `${model.live.state === "live" ? `Intraday ${model.live.at} ET` : `${model.live.at} closing price`} provisional — price, alpha, gap, price gate, passes & top 10 use current prices; `
              + `quality gates, buy-below price, Lead PM & scorecard use ${fmtDate(model.date, lang)} close (passes become final tonight)`
            : `${model.live.state === "live" ? `장중 ${model.live.at} ET` : `${model.live.at} 마감 가격`} 잠정 — 가격 · 알파 · 괴리 · 가격 관문 · 통과 · 상위 10 은 지금 가격, `
              + `품질 관문 · 매수 기준가 · 수석 PM · 성적표는 ${fmtDate(model.date, lang)} 종가 (통과는 종가로 밤에 확정)`)
          : live
          ? (en ? `${fmtDate(model.date, lang)} close · recomputed nightly` : `${fmtDate(model.date, lang)} 종가 · 밤마다 다시 계산`)
          : failed
            ? (en
              ? `${fmtDate(failed, lang)} nightly run failed — showing ${fmtDate(model.date, lang)} snapshot`
              : `${fmtDate(failed, lang)} 밤 계산 실패 — ${fmtDate(model.date, lang)} 스냅샷으로 표시`)
            : (en ? `Provisional snapshot · ${fmtDate(model.date, lang)} local run` : `임시 스냅샷 · ${fmtDate(model.date, lang)} 로컬 실행`)}
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

function boardData(model: ValueModel, lang: Lang = "ko") {
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
  // 베타 하한 (2026-11-17) — 계산한 베타가 하한에서 잘린 종목: 요구수익률이 가장 낮게 잡혀 매수 기준가 · 적정가가 높게 나온다.
  // fair1Of = 베타 1(시장 평균 위험)로 다시 계산한 적정가 (비교용), betaWarn = 마우스를 올리면 보이는 설명 (해당 없으면 null).
  // 베타 최소 1 (2026-11-19) 밤 파일이면 하한이 곧 시장 평균이라 경고 · 베타 1 비교를 안 보인다 (minOne).
  const floor = model.params.beta_min ?? BETA_FLOOR;
  const minOne = betaMinOne(floor);
  const fair1Of = (r?: VmRow | null): FairRange | null =>
    (r && !minOne && betaAtFloor(r, floor) ? fairRangeAtBeta1(r, model.params, bearCut) : null);
  const betaWarn = (r?: VmRow | null): string | null => {
    if (!r || minOne || !betaAtFloor(r, floor)) return null;
    const f1 = fair1Of(r);
    if (lang === "en") {
      return `Beta floor — computed beta was below ${floor} and clipped to ${floor} (moves independently of the S&P). That sets required return `
        + `to the minimum (${plain(r.ke)}), making the buy-below and fair value higher — a low beta does not mean stable earnings.`
        + (f1 ? ` At beta 1 (market-average risk), fair value is ${fairText(f1, r.ticker)}.` : "");
    }
    return `베타 하한 — 계산한 베타가 ${floor} 보다 낮아 ${floor} 로 잘랐다 (S&P 와 따로 움직이는 종목). 그래서 요구수익률이 `
      + `${plain(r.ke)} 로 가장 낮게 잡혀 매수 기준가 · 적정가가 높게 나온다 — 베타가 낮다고 이익이 안정적인 건 아니다.`
      + (f1 ? ` 베타 1(시장 평균 위험)이면 적정 ${fairText(f1, r.ticker)}.` : "");
  };
  const jCo = new Set([...jPass, ...jTop].map(coOf));
  const sCo = new Set([...sPass, ...sTop].map(coOf));
  const pCo = new Set(pTop.map(coOf));
  const aCo = new Set(authors.flatMap((x) => [x.row && coOf(x.row), x.mine && coOf(x.mine), x.ticker].filter(Boolean) as string[]));
  const watchJ = model.rows.filter((r) => isOwn(r) && r.quality && !r.pass && r.drop != null).sort((a, b) => (b.drop ?? -9) - (a.drop ?? -9));
  const watchS = model.rows
    .filter((r) => isOwn(r) && r.quality && !r.pass_v2 && r.gap != null)
    .sort((a, b) => Number(!!a.kill?.length) - Number(!!b.kill?.length) || (b.gap ?? -9) - (a.gap ?? -9));
  const traps = model.rows.filter((r) => isOwn(r) && !r.quality && r.gates.price).sort((a, b) => (b.alpha ?? 0) - (a.alpha ?? 0));
  return { byT, jPass, sPass, jTop, sTop, pTop, pmCands, authors, jCo, sCo, pCo, aCo, watchJ, watchS, traps, fairOf, fair1Of, betaWarn, floor, minOne };
}

type Board = ReturnType<typeof boardData>;

/** 다른 목록에도 있는 종목 표시 — 주 · 시 · P(수석 PM) · 리(리서치) (같은 회사의 다른 상장도). */
function Marks({ r, b, self, lang = "ko" }: { r: VmRow; b: Board; self: "j" | "s" | "p"; lang?: Lang }) {
  const co = coOf(r);
  const en = lang === "en";
  const w = WHO[lang];
  return (
    <span className="vm-mk">
      {self !== "j" && b.jCo.has(co) && <span className="vm-mk__b vm-mk__b--j" title={en ? `Also in ${w.junior} list` : `${JUNIOR} 목록에도 있음`}>{en ? "J" : "주"}</span>}
      {self !== "s" && b.sCo.has(co) && <span className="vm-mk__b vm-mk__b--s" title={en ? `Also in ${w.senior} list` : `${SENIOR} 목록에도 있음`}>{en ? "S" : "시"}</span>}
      {self !== "p" && b.pCo.has(co) && <span className="vm-mk__b vm-mk__b--p" title={en ? `Also in ${w.pm} portfolio` : `${PM} 포트폴리오에도 있음`}>P</span>}
      {(b.aCo.has(co) || r.author === "coverage" || r.author === "research") &&
        <span className="vm-mk__b vm-mk__b--a" title={en ? "Also a research pick" : "리서치 종목이기도 함"}>{en ? "R" : "리"}</span>}
    </span>
  );
}

/** 티커 옆 현재가 / 매수 기준가 (2026-11-16 사용자). 매수 기준가 = 이 가격 이하면 가격 관문(알파 ≥ 5%p) 통과 — 안전마진을 둔
 *  '사도 되는 최고 가격'이지 목표가는 아니다. 지금 그 아래면 파랑, 위면 빨강. */
function PxBuy({ r, lang = "ko" }: { r: VmRow; lang?: Lang }) {
  if (r.price == null) return null;
  const cheap = r.buy != null && r.buy >= r.price;
  const tip = lang === "en"
    ? "Current price / buy-below price — at or below the buy-below price, expected return exceeds required return by at least 5%p (maximum buy price with a margin of safety)"
    : "현재가 / 매수 기준가 — 매수 기준가 이하면 기대수익률이 요구수익률보다 5%p 이상 높다 (안전마진을 둔 사도 되는 최고 가격)";
  return (
    <span className="vm-px num" title={tip}>
      {money(r.price, r.ticker)}<span className="vm-px__sep">/</span>
      <b className={r.buy == null ? "muted" : cheap ? "vm-px__ok" : "vm-px__no"}>{r.buy == null ? "—" : money(r.buy, r.ticker)}</b>
    </span>
  );
}

/** 적정가 범위 글자 — $10 이상은 정수, 그 아래는 소수 둘째 자리. */
function fairText(f: FairRange, ticker: string): string {
  const fm = (v: number) => money(v, ticker, Math.abs(v) >= 10 ? 0 : 2);
  return `${fm(f.low)}~${fm(f.base)}`;
}

function FairChip({ f, ticker, warn, lang = "ko" }: { f: FairRange | null | undefined; ticker: string; warn?: string | null; lang?: Lang }) {
  if (!f) return null;
  const tip = FAIR_TIP[lang];
  return <span className={`vm-fair num${warn ? " vm-fair--warn" : ""}`} title={warn ? `${tip}\n\n${warn}` : tip}>{lang === "en" ? "Fair" : "적정"} {fairText(f, ticker)}</span>;
}

/** 베타 하한 표시 (2026-11-17) — 매수 기준가 · 적정가가 높게 나올 수 있는 종목. 설명은 마우스를 올리면. */
function BetaFloorMark({ warn, lang = "ko" }: { warn?: string | null; lang?: Lang }) {
  return warn ? <span className="vm-betafloor" title={warn}>{lang === "en" ? "Beta floor" : "베타 하한"}</span> : null;
}

function Li({ rank, r, metric, metricTone, sub, marks, hot, fair, warn, lang = "ko" }: {
  rank?: number; r: VmRow; metric: ReactNode; metricTone?: string; sub?: ReactNode; marks?: ReactNode; hot?: boolean;
  fair?: FairRange | null; warn?: string | null; lang?: Lang;
}) {
  return (
    <li className={`vm-li${hot ? " vm-li--hot" : ""}`}>
      {rank != null && <span className="vm-li__rk num">{rank}</span>}
      <span className="vm-li__who">
        <span className="vm-li__tk"><TickerLink ticker={r.ticker} />{marks}<GapMark r={r} lang={lang} /><PxBuy r={r} lang={lang} /><BetaFloorMark warn={warn} lang={lang} /></span>
        <span className="vm-li__nm" title={r.name ?? undefined}><FairChip f={fair} ticker={r.ticker} warn={warn} lang={lang} />{sub ?? r.name ?? ""}</span>
      </span>
      <span className={`vm-li__m num${metricTone ? ` ${metricTone}` : ""}`}>{metric}</span>
    </li>
  );
}

function ColHead({ icon, who, rule, tone: t, stamp }: {
  icon: IconName; who: string; rule: string; tone: "j" | "s" | "p" | "a"; stamp?: ReactNode;
}) {
  return (
    <div className={`vm-col__head vm-col__head--${t}`}>
      <span className="vm-col__icon"><Icon name={icon} size={18} /></span>
      <div>
        <h3>{who}</h3>
        <p>{rule}</p>
        {stamp}
      </div>
    </div>
  );
}

function Sub({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return <div className="vm-col__sub"><span>{children}</span>{aside && <span className="vm-col__subx">{aside}</span>}</div>;
}

// ── 통과 픽 (2026-11-12 밤, 사용자: "시니어 통과 픽 부분 예전처럼 — 주니어 통과 픽, 시니어 통과 픽") — 세 칸 판 위 두 칸.
//    분석가마다 1위 픽은 큰 카드(태그 · 설명 · 숫자 4개), 나머지 통과는 짧은 줄. 주니어 = 알파 순, 시니어 = 성장 괴리 순.

function PickHero({ r, mode, lang, fair, fair1, warn, floor }: {
  r: VmRow; mode: "junior" | "senior"; lang: Lang; fair?: FairRange | null; fair1?: FairRange | null; warn?: string | null;
  floor: number;
}) {
  const senior = mode === "senior";
  const gap = fillNote(r, lang);
  const en = lang === "en";
  return (
    <div className="vm-hero">
      <h4 className="vm-hero__title">
        <TickerLink ticker={r.ticker} /> <span className="vm-hero__nm">{r.name}</span>
      </h4>
      <div className="vm-hero__tags">
        {r.industry && <Tag tone="info">{r.industry}</Tag>}
        <Tag tone="good">{en ? "Passed 5 quality gates" : "품질 5개 통과"}</Tag>
        {r.author && <Tag>{AUTHOR_TAG[lang][r.author]}</Tag>}
        {senior && r.sensitive && <Tag tone="warn" title={en ? `Alpha ${ppv(r.alpha_b06)} at beta 0.6` : `베타 0.6 이면 알파 ${ppv(r.alpha_b06)}`}>{en ? "Beta-sensitive" : "베타 민감"}</Tag>}
        {warn && <Tag tone="warn" title={warn}>{en ? "Beta floor" : "베타 하한"}</Tag>}
        {!senior && r.pass_v2 && <Tag tone="good">{en ? "Also passes Senior" : "시니어도 통과"}</Tag>}
        {!senior && !r.pass_v2 && <Tag tone="warn">{r.kill?.length ? (en ? `Senior disconfirming: ${killJoin(r.kill, "en")}` : `시니어 반증: ${r.kill.join(" · ")}`) : (en ? "Failed Senior downside gate" : "시니어 하방 관문 탈락")}</Tag>}
        {gap && <Tag tone="warn" title={gap.long}>{en ? `ROIC: ${gap.short} → counted as 0` : `ROIC: ${gap.short} → 0으로 계산`}</Tag>}
      </div>
      <p className="vm-hero__why">
        {senior
          ? (en
            ? <>Downside gate: even if FCF drops 30% and first 5-yr growth is ≤ 0, alpha is {ppv(r.alpha_bear)} ≥ 0. Actual revenue growth is {pct(r.g1)}, while the current share price implies only {pct(r.implied_g)} growth.
              {r.sensitive && <> Raising the beta floor to 0.6 drops alpha to {ppv(r.alpha_b06)}, failing the price gate — a borderline stock hinging on beta.</>}</>
            : <>하방 관문: FCF 가 30% 줄고 첫 5년 성장이 0 이하여도 알파 {ppv(r.alpha_bear)} ≥ 0. 실제 매출 성장 {pct(r.g1)} 인데 지금 주가는 {pct(r.implied_g)} 성장만 가정한다.
              {r.sensitive && <> 베타 하한을 0.6 으로 올리면 알파 {ppv(r.alpha_b06)} 로 가격 관문 탈락 — 베타 하나에 걸린 경계선 종목.</>}</>)
          : (en
            ? <>5 quality gates (ROE {r.gates.roe === null ? "N/A — negative equity counted as pass" : plain(r.roe)} · ROIC {plain(r.roic)} &gt; WACC {plain(r.wacc)} · Z {r.z?.toFixed(2)} · M {r.m?.toFixed(2)} · FCF positive {r.fcf_years} yrs) + price gate (alpha {ppv(r.alpha)} ≥ 5%p).</>
            : <>품질 5개(ROE {r.gates.roe === null ? "판단 불가 — 자기자본 음수라 통과로 침" : plain(r.roe)} · ROIC {plain(r.roic)} &gt; WACC {plain(r.wacc)} · Z {r.z?.toFixed(2)} · M {r.m?.toFixed(2)} · FCF {r.fcf_years}년 플러스) + 가격 관문(알파 {ppv(r.alpha)} ≥ 5%p).</>)}
        {" "}{en
          ? `Financials ${r.fetched ? `fetched ${fmtDate(r.fetched, lang)}` : ""} · ${betaLabel(r, floor, lang)}.`
          : `재무 ${r.fetched ? `${fmtDate(r.fetched, lang)} 받음` : ""} · ${betaLabel(r, floor, lang)}.`}
      </p>
      <dl className="vm-hero__stats">
        <div><dt>{en ? "Price / buy-below price" : "현재가 / 매수 기준가"}</dt><dd className="num">{money(r.price, r.ticker)} / {money(r.buy, r.ticker)}
          {fair && <span className="vm-hero__fair" title={FAIR_TIP[lang]}>{en ? `Fair value ${fairText(fair, r.ticker)} (bear ~ base)` : `적정가 ${fairText(fair, r.ticker)} (하방 ~ 기본)`}</span>}
          {warn && <span className="vm-hero__fair vm-warn-t" title={warn}>{en ? `Elevated by beta floor${fair1 ? ` — ${fairText(fair1, r.ticker)} at beta 1` : ""}` : `베타 하한이라 높게 나옴${fair1 ? ` — 베타 1이면 ${fairText(fair1, r.ticker)}` : ""}`}</span>}</dd></div>
        <div><dt>{en ? "Expected / bear alpha" : "기대 알파 / 하방 알파"}</dt><dd className="num up">{ppv(r.alpha)} / {ppv(r.alpha_bear)}</dd></div>
        {senior ? <>
          <div><dt>{en ? "Growth (implied vs actual)" : "성장률 (시장 가정 vs 실제)"}</dt><dd className="num">{pct(r.implied_g)} vs {pct(r.g1)}</dd></div>
          <div><dt>{en ? "Growth gap / vs 3Y high" : "성장 괴리 / 3년 고점 대비"}</dt><dd className="num"><span className={tone(r.gap)}>{ppv(r.gap)}</span> <span className={tone(r.dd_3y)}>({pct(r.dd_3y, 0)})</span></dd></div>
        </> : <>
          <div><dt>{en ? "FCF yield / required return" : "FCF 수익률 / 요구수익률"}</dt><dd className="num">{plain(r.fcf_y)} / {plain(r.ke)}</dd></div>
          <div><dt>{en ? "Buy-price buffer / vs 3Y high" : "매수 기준가 여유 / 3년 고점 대비"}</dt><dd className="num">{pct(r.drop, 0)} <span className={tone(r.dd_3y)}>({pct(r.dd_3y, 0)})</span></dd></div>
        </>}
      </dl>
    </div>
  );
}

/**
 * 칸 위 작은 줄 (2026-11-19 사용자 — "언제 refresh 됐고 언제 리스트가 업데이트됐는지"): 숫자를 언제 다시 계산했는지 · 명단이
 * 언제 바뀌었는지. liveOk = 장중 가격으로 덮이는 칸 (통과 픽 · 상위 10 — 수석 PM 은 밤 계산만). now = 지금 화면의 명단.
 * 장중에 밤 명단과 달라졌으면 '장중 바뀜'(밤에 종가로 확정), 아니면 밤 파일의 lists 에 적힌 마지막으로 바뀐 종가 날짜.
 * 들어온 · 빠진 종목은 마우스를 올리면. lists 가 없는 예전 파일이면 갱신 시각만.
 */
function Stamp({ model, k, now, liveOk, lang }: { model: ValueModel; k: VmListKey; now: string[]; liveOk: boolean; lang: Lang }) {
  const en = lang === "en";
  const live = liveOk ? model.live : null;
  const gen = model.generated;
  const hm = gen?.slice(11, 16) ?? "";
  const upd = live
    ? (live.state === "live" ? (en ? `Updated ${live.at} ET intraday` : `갱신 장중 ${live.at}`) : (en ? `Updated ${live.at} closing price` : `갱신 ${live.at} 마감 가격`))
    : gen ? (en ? `Updated ${fmtDate(gen, "en")} ${hm} (nightly)` : `갱신 ${fmtDateShort(gen)} ${hm} 밤 계산`) : null;
  const L = model.lists?.[k];
  const noun = k === "v3" ? (en ? "portfolio" : "포트폴리오") : (en ? "list" : "명단");
  const moves = (add: string[], drop: string[]) =>
    [add.length ? `${en ? "In" : "들어옴"} ${add.join(", ")}` : "", drop.length ? `${en ? "Out" : "빠짐"} ${drop.join(", ")}` : ""]
      .filter(Boolean).join(" · ");
  let chg: string | null = null;
  let tip: string | undefined;
  let hot = false;
  if (L) {
    const add = live ? now.filter((t) => !L.t.includes(t)) : [];
    const drop = live ? L.t.filter((t) => !now.includes(t)) : [];
    if (add.length || drop.length) {
      hot = true;
      chg = en ? `${noun} changed intraday` : `장중 ${noun} 바뀜`;
      tip = en ? `vs last night — ${moves(add, drop)} (confirmed at tonight's close)` : `어젯밤 명단 대비 — ${moves(add, drop)} (밤에 종가로 확정)`;
    } else if (L.d) {
      chg = en ? `${noun} changed at ${fmtDate(L.d, "en")} close` : `${fmtDateShort(L.d)} 종가로 ${noun} 바뀜`;
      tip = moves(L.add, L.drop) || undefined;
    } else {
      chg = en ? `${noun} unchanged${L.since ? ` (checked since ${fmtDate(L.since, "en")})` : ""}`
        : `${noun} 그대로${L.since ? ` (${fmtDateShort(L.since)}부터 확인)` : ""}`;
    }
  }
  if (!upd && !chg) return null;
  return (
    <p className="vm-stamp">
      {upd}
      {upd && chg && " · "}
      {chg && <span className={`${hot ? "vm-stamp__hot" : ""}${tip ? " vm-stamp__tip" : ""}`.trim() || undefined} title={tip}>{chg}</span>}
    </p>
  );
}

function PickPanel({ mode, rows, b, model, lang }: {
  mode: "junior" | "senior"; rows: VmRow[]; b: Board; model: ValueModel; lang: Lang;
}) {
  const senior = mode === "senior";
  const [top, ...rest] = rows;
  const en = lang === "en";
  return (
    <section className={`vm-pick vm-pick--${senior ? "s" : "j"}`}>
      <div className="vm-pick__head">
        <span className="vm-pick__icon"><Icon name={senior ? "shield" : "check-badge"} size={20} /></span>
        <div>
          <h3>{senior ? (en ? "Senior Pass Picks" : "시니어 통과 픽") : (en ? "Junior Pass Picks" : "주니어 통과 픽")} <span className="vm-pick__n num">{rows.length}</span></h3>
          <p>{senior
            ? (en ? "Junior pass + downside gate · no disconfirming — sorted by largest growth gap" : "주니어 통과 + 하방 관문 · 반증 없음 — 성장 괴리 큰 순")
            : (en ? "5 quality gates + price gate — sorted by highest expected alpha" : "품질 5개 + 가격 관문 — 기대 알파 큰 순")}</p>
          <Stamp model={model} k={senior ? "v2" : "v1"} now={rows.map((r) => r.ticker)} liveOk lang={lang} />
        </div>
      </div>
      {top ? <PickHero r={top} mode={mode} lang={lang} fair={b.fairOf(top)} fair1={b.fair1Of(top)} warn={b.betaWarn(top)} floor={b.floor} /> : (
        <p className="vm-pick__none">
          {senior
            ? (en
              ? `None right now — out of ${model.funnel.pass} Junior passes, no stock cleared the downside gate (FCF −30% · growth ≤ 0).`
              : `지금은 없음 — 주니어 통과 ${model.funnel.pass}개 중 하방 관문(FCF −30% · 성장 0 이하)까지 넘은 종목이 없다.`)
            : (en
              ? `None right now — this isn't a screen that always outputs dozens of names. We wait for the ${model.funnel.quality} quality-passing stocks to come down to their buy-below prices.`
              : `지금은 없음 — 이 방식은 늘 여러 종목이 나오는 스크린이 아니다. 품질 통과 ${model.funnel.quality}개가 매수 기준가까지 내려오길 기다린다.`)}
        </p>
      )}
      {rest.length > 0 && (
        <ol className="vm-list vm-pick__rest" start={2}>
          {rest.map((r, i) => (
            <Li key={r.ticker} rank={i + 2} r={r} fair={b.fairOf(r)} warn={b.betaWarn(r)} lang={lang}
              metric={senior ? <>{en ? "Gap" : "괴리"} {ppv(r.gap)}</> : <>{en ? "Alpha" : "알파"} {ppv(r.alpha)}</>} metricTone={senior ? tone(r.gap) : "up"}
              sub={<>{r.name}{senior && <>{en ? " · Bear " : " · 하방 "}{ppv(r.alpha_bear)}</>}{senior && r.sensitive && <b className="vm-warn-t">{en ? " · Beta-sensitive" : " · 베타 민감"}</b>}</>}
              marks={<Marks r={r} b={b} self={senior ? "s" : "j"} lang={lang} />} />
          ))}
        </ol>
      )}
    </section>
  );
}

function JuniorCol({ b, model, lang = "ko" }: { b: Board; model: ValueModel; lang?: Lang }) {
  const en = lang === "en";
  return (
    <section className="vm-col">
      <ColHead icon="user" who={WHO[lang].junior} tone="j"
        rule={en ? "Research checklist as is — 5 quality gates + price (alpha ≥ 5%p)" : "리서치 체크리스트 그대로 — 품질 5개 + 가격(알파 ≥ 5%p)"}
        stamp={<Stamp model={model} k="v1_top" now={b.jTop.map((r) => r.ticker)} liveOk lang={lang} />} />
      <Sub aside={en ? "To buy-below price" : "매수 기준가까지"}>{en ? "Top 10 · smallest drop needed" : "상위 10 · 필요한 하락 작은 순"}</Sub>
      <ol className="vm-list">
        {b.jTop.map((r, i) => (
          <Li key={r.ticker} rank={i + 1} r={r} hot={r.pass} fair={b.fairOf(r)} warn={b.betaWarn(r)} lang={lang}
            metric={r.pass ? (en ? "Pass" : "통과") : pct(r.drop, 0)} metricTone={r.pass ? "up" : undefined}
            marks={<Marks r={r} b={b} self="j" lang={lang} />} />
        ))}
      </ol>
    </section>
  );
}

function SeniorCol({ b, model, lang = "ko" }: { b: Board; model: ValueModel; lang?: Lang }) {
  const v2 = model.v2;
  const theme = v2 ? Object.entries(v2.theme).filter(([, n]) => n >= v2.params.theme_warn) : [];
  const en = lang === "en";
  return (
    <section className="vm-col">
      <ColHead icon="user-star" who={WHO[lang].senior} tone="s"
        rule={en ? "Junior + downside gate · sorted by growth gap · disconfirming check" : "주니어 + 하방 관문 · 성장 괴리 순 · 반증 조건"}
        stamp={<Stamp model={model} k="v2_top" now={b.sTop.map((r) => r.ticker)} liveOk lang={lang} />} />
      <Sub aside={en ? "Growth gap" : "성장 괴리"}>{en ? "Top 10 · largest gap (ex-disconfirmed)" : "상위 10 · 괴리 큰 순 (반증 걸린 종목 제외)"}</Sub>
      {v2 ? (
        <ol className="vm-list">
          {b.sTop.map((r, i) => (
            <Li key={r.ticker} rank={i + 1} r={r} hot={r.pass_v2} metric={ppv(r.gap)} metricTone={tone(r.gap)} fair={b.fairOf(r)}
              warn={b.betaWarn(r)} lang={lang}
              marks={<Marks r={r} b={b} self="s" lang={lang} />} />
          ))}
        </ol>
      ) : <p className="vm-col__none">{en ? "No Senior data yet" : "시니어 자료가 아직 없다"}</p>}
      {v2 && (
        <p className={`vm-col__note${theme.length ? " vm-col__note--warn" : ""}`}>
          {en
            ? `Industry concentration (${v2.params.theme_warn}+ in same industry within top ${v2.params.theme_top}): `
            : `업종 집중 (상위 ${v2.params.theme_top} 안 같은 업종 ${v2.params.theme_warn}개+): `}
          {theme.length ? theme.map(([ind, n]) => `${ind} ${n}`).join(" · ") : (en ? "None — well diversified" : "없음 — 다각화 양호")}
        </p>
      )}
    </section>
  );
}

function Verdict({ r, label, lang = "ko" }: { r: VmRow | undefined; label: "주" | "시"; lang?: Lang }) {
  const en = lang === "en";
  const disp = en ? (label === "주" ? "J" : "S") : label;
  if (!r) return <span className="vm-vd vm-vd--na" title={en ? "No data" : "자료 없음"}>{disp} ·</span>;
  const ok = label === "주" ? r.pass : !!r.pass_v2;
  const who = label === "주" ? WHO[lang].junior : WHO[lang].senior;
  const res = en ? (ok ? "pass" : "fail") : (ok ? "통과" : "탈락");
  return <span className={`vm-vd${ok ? " vm-vd--ok" : ""}`} title={`${who} ${res}`}>{disp} {ok ? "✓" : "✕"}</span>;
}

function AuthorCol({ b, model, lang }: { b: Board; model: ValueModel; lang: Lang }) {
  const page = model.author.src === "page";
  const en = lang === "en";
  const w = WHO[lang];
  return (
    <section className="vm-col vm-col--a">
      <ColHead icon="users" who={w.research} tone="a"
        rule={en
          ? `Coverage + research notes — ${page ? "weekly-checked list" : "compiled list"} (${fmtDate(model.author.as_of, lang)})`
          : `커버리지 + 리서치 노트 — ${page ? "매주 확인한 목록" : "정리해 둔 목록"} (${fmtDate(model.author.as_of, lang)})`} />
      <Sub aside={en ? "To target · our verdict" : "목표까지 · 우리 판정"}>{en ? `Current list ${b.authors.length}` : `지금 목록 ${b.authors.length}`}</Sub>
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
                  {x.covered && <span className="vm-src__b vm-src__b--in" title={`${en ? "Coverage" : "커버리지"}${x.rating ? ` · ${x.rating}` : ""}`}>{en ? "Coverage" : "커버리지"}</span>}
                  {last && (
                    <span className="vm-src__b vm-src__b--post vm-src__b--in"
                      title={x.posts.map((p) => `${p.date} ${p.kind} · ${p.view}`).join("\n")}>
                      {en ? "Note" : "노트"} {md(last.date)}{x.posts.length > 1 ? (en ? ` +${x.posts.length - 1}` : ` 외 ${x.posts.length - 1}`) : ""}
                    </span>
                  )}
                </span>
                <span className="vm-li__nm" title={name}>
                  {name}
                  {last?.excess != null && <>{en ? " · vs index since note " : " · 노트 뒤 지수 대비 "}<b className={`num ${tone(last.excess)}`}>{ppv(last.excess)}</b></>}
                  {x.row && !isOwn(x.row) && (x.mine
                    ? <span className="vm-li__alias">{en ? ` · ${x.mine.ticker} in our universe` : ` · 우리 대상에선 ${x.mine.ticker}`}</span>
                    : <span className="vm-li__alias" title={en ? "Market cap < US$1B, etc. — computed for comparison only" : "시가총액 US$10억 미만 등 — 비교용으로만 계산"}>{en ? " · outside our universe" : " · 우리 대상 밖"}</span>)}
                </span>
              </span>
              <span className="vm-li__m vm-li__m--a">
                <span className={`num ${tone(x.upside)}`}>{pct(x.upside, 0)}</span>
                <span className="vm-vds">
                  <Verdict r={v} label="주" lang={lang} /><Verdict r={v} label="시" lang={lang} />
                  {model.v3 && <span className={`vm-vd${inPm ? " vm-vd--ok" : ""}`} title={en ? `${w.pm} portfolio: ${inPm ? "included" : "excluded"}` : `${PM} 포트폴리오 ${inPm ? "편입" : "밖"}`}>P {inPm ? "✓" : "✕"}</span>}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Summary({ s, lang = "ko" }: { s: VmSummary | undefined; lang?: Lang }) {
  const en = lang === "en";
  if (!s || !s.n) return <span className="muted">{en ? "None yet" : "아직 없음"}</span>;
  return <><b className={`num ${tone(s.excess)}`}>{ppv(s.excess)}</b><span>{en ? `${s.n} picks · avg ${pct(s.ret)} · beat ${s.beat}/${s.n}` : `${s.n}건 · 평균 ${pct(s.ret)} · 이김 ${s.beat}/${s.n}`}</span></>;
}

function TrackTable({ rows, lang }: { rows: VmTrack[]; lang: Lang }) {
  const exits = rows.some((r) => r.exit);
  const en = lang === "en";
  return (
    <Table head={<>
      <th>{en ? "Ticker" : "종목"}</th><th>{en ? "Group" : "묶음"}</th><th>{en ? "Start date" : "시작일"}</th><th className="r">{en ? "Entry price" : "시작가"}</th><th className="r">{en ? "Return" : "수익률"}</th>
      <th className="r">{en ? "Index" : "지수"}</th><th className="r">{en ? "Diff" : "차이"}</th><th className="c">{en ? "Passing now" : "지금 통과"}</th>{exits && <th>{en ? "Exit" : "끝"}</th>}
    </>}>
      {rows.map((r, i) => (
        <tr key={`${r.group}-${r.ticker}-${r.since}-${i}`}>
          <Who ticker={r.ticker} />
          <td><span className={`vm-g vm-g--${r.group}`}>{GROUP_LABEL[lang][r.group]}</span></td>
          <td>{fmtDate(r.since, lang)}</td>
          <td className="r num">{money(r.entry, r.ticker)}</td>
          <td className={`r num ${tone(r.ret)}`}>{pct(r.ret)}</td>
          <td className="r num">{r.bench === "XIU.TO" ? "XIU " : "SPY "}{pct(r.bench_ret)}</td>
          <td className={`r num ${tone(r.excess)}`}>{ppv(r.excess)}</td>
          <td className="c">{r.passing ? <GateMark g={true} lang={lang} /> : <span className="muted">·</span>}</td>
          {exits && <td className="small">{r.exit ? `${fmtDate(r.exit, lang)} · ${reasonText(r.reason, lang)}` : ""}</td>}
        </tr>
      ))}
    </Table>
  );
}

function ScorePanel({ model, lang }: { model: ValueModel; lang: Lang }) {
  const tr = model.tracking;
  const w = tr.warmup;
  const en = lang === "en";
  return (
    <Panel title={en ? "Scorecard — all six groups tracked from the same day" : "성적표 — 여섯 묶음을 같은 날부터"}
      sub={w
        ? (en
          ? <>Warming up — financials fetched for {w.have.toLocaleString()} of {w.want.toLocaleString()} target stocks ({((w.have / Math.max(w.want, 1)) * 100).toFixed(0)}%).
            All groups start together on the night coverage reaches 95% — so we don&apos;t pick top 10 from a partial universe on day one. The PM portfolio starts once SBC and diluted-share data reach 95%.</>
          : <>기록 준비 중 — 대상 {w.want.toLocaleString()}종목 중 재무를 받은 {w.have.toLocaleString()}종목 ({((w.have / Math.max(w.want, 1)) * 100).toFixed(0)}%).
            95%가 되는 밤부터 묶음들이 같은 날 시작한다 — 넓힌 대상 첫 밤에 일부만으로 상위 10 을 고르지 않게. PM 포트폴리오는 SBC · 희석주식수 자료가 95% 모인 밤부터.</>)
        : (en
          ? <>{tr.start ? `Since ${fmtDate(tr.start, lang)}` : "Before tracking start"} · Pass groups start from the first day a stock passes; top 10 from the first run of each month;
            research picks from the close on the first day they appear. Dividends included, vs SPY (XIU for Canada) over the same period. Rules are locked at the start date — never tweaked to fit results.</>
          : <>{tr.start ? `${fmtDate(tr.start, lang)}부터` : "기록 시작 전"} · 통과 묶음은 처음 통과한 날, 상위 10 은 매달 첫 실행에 고른 날,
            리서치 종목은 목록에 처음 보인 날 종가부터. 배당 포함, 같은 기간 SPY(캐나다는 XIU) 대비. 규칙은 시작일에 고정 — 성적을 보고 고치지 않는다.</>)}>
      <div className="vm-sum vm-sum--5 vm-sum--6">
        {SCORE_GROUPS.map((g) => (
          <div key={g} className="vm-sum__item">
            <span className={`vm-g vm-g--${g}`}>{GROUP_LABEL[lang][g]}</span>
            <Summary s={tr.summary[g]} lang={lang} />
          </div>
        ))}
      </div>
      {tr.rows.length > 0 && <Fold title={en ? `All ${tr.rows.length} tracked rows` : `기록 전체 ${tr.rows.length}줄`}><TrackTable rows={tr.rows} lang={lang} /></Fold>}
    </Panel>
  );
}

// ── 대기 목록 · 가치 함정 (접어 둔 자세히)

/** 수석 PM 결과 — 편입 · ④ 업종 상한/10칸 밖 · ①②③ 중 걸린 관문 · 후보 아님(반증 · 품질) · 자료 준비 중. */
function pmResult(r: VmRow, picks: Set<string>, lang: Lang): { label: string; t: "pass" | "warn" | "bad" | "plain" } {
  const en = lang === "en";
  const p = r.pm;
  if (!p) return { label: en ? "Warming up" : "자료 준비 중", t: "plain" };
  if (picks.has(r.ticker)) return { label: en ? "Included" : "편입", t: "pass" };
  if (!r.quality) return { label: en ? "Not a candidate (quality)" : "후보 아님 (품질)", t: "plain" };
  if (r.kill?.length) return { label: en ? "Not a candidate (disconfirmed)" : "후보 아님 (반증)", t: "plain" };
  if (p.pass) return { label: en ? "④ Industry cap / outside 10 slots" : "④ 업종 상한 · 10칸 밖", t: "warn" };
  const fail = [!p.sbc && "①", !p.ev && "②", !p.cap && "③"].filter(Boolean).join("·");
  return { label: en ? `Failed ${fail}` : `${fail} 탈락`, t: "bad" };
}

/**
 * 주니어 · 시니어 대기 목록 · 수석 PM 심사 공통 표 (2026-11-19 사용자 — "세 개가 똑같이, 다 중요한 정보"). 가격 · 주니어 · 시니어 ·
 * 수석 PM · 리서치 칸을 셋 다 똑같이 보여 주고, 표마다 다른 건 줄(종목)과 순서뿐. 빨간 글자 = 그 분석가의 관문에서 걸린 값.
 */
function AnalystTable({ rows, b, model, lang = "ko" }: { rows: VmRow[]; b: Board; model: ValueModel; lang?: Lang }) {
  const en = lang === "en";
  const picks = new Set(model.v3?.top ?? []);
  const aMin = model.params.alpha_min;
  const v3p = model.v3?.params;
  const grp = (label: string, n: number, t: "x" | "j" | "s" | "p") => <th colSpan={n} className={`vm-t__g vm-t__g--${t}`}>{label}</th>;
  const bad = (v: boolean | undefined) => (v ? " down" : "");
  return (
    <Table wide
      group={<>
        <th /><th />
        {grp(en ? "Price" : "가격", 5, "x")}
        {grp(WHO[lang].junior, 3, "j")}
        {grp(WHO[lang].senior, 5, "s")}
        {grp(WHO[lang].pm, 4, "p")}
        <th className="vm-t__g vm-t__g--x" />
      </>}
      head={<>
        <th>{en ? "Ticker" : "종목"}</th><th>{en ? "Industry" : "업종"}</th>
        <th className="r vm-t__g0">{en ? "Price" : "현재가"}</th><th className="r">{en ? "Buy-below" : "매수 기준가"}</th>
        <th className="r" title={FAIR_TIP[lang]}>{en ? "Fair value (bear~base)" : "적정가 (하방~기본)"}</th>
        <th className="r">{en ? "Drop needed" : "필요한 하락"}</th><th className="r">{en ? "vs 3Y high" : "3년 고점 대비"}</th>
        <th className="r vm-t__g0">ROIC</th><th className="r">{en ? "FCF yield" : "FCF 수익률"}</th><th className="r">{en ? "Expected alpha" : "기대 알파"}</th>
        <th className="r vm-t__g0">{en ? "Bear alpha" : "하방 알파"}</th><th className="r">{en ? "Implied growth" : "시장 가정 성장"}</th>
        <th className="r">{en ? "Actual growth" : "실제 성장"}</th><th className="r">{en ? "Growth gap" : "성장 괴리"}</th>
        <th>{en ? "Disconfirming" : "반증 조건"}</th>
        <th className="r vm-t__g0">{en ? "① SBC-adj alpha · bear" : "① SBC 차감 알파 · 하방"}</th><th className="r">{en ? "② EV alpha" : "② EV 알파"}</th>
        <th className="r">{en ? "③ Payout · dilution" : "③ 주주환원 · 희석"}</th><th className="c">{en ? "Result" : "결과"}</th>
        <th className="vm-t__g0">{en ? "Research" : "리서치"}</th>
      </>}
      foot={<span>{en
        ? `Red = the value that failed that analyst's gate. Junior: 5 quality gates + expected alpha ≥ ${ppv(aMin)}. Senior: + bear alpha ≥ 0 (FCF −30% · growth ≤ 0) · no disconfirming condition. `
          + `Lead PM (Senior candidates only): ① SBC-adj alpha ≥ ${ppv(v3p?.alpha_min ?? aMin)} · bear ≥ 0 ② EV alpha ≥ ${ppv(v3p?.alpha_min ?? aMin)} ③ shareholder yield ≥ 0 · dilution ≤ ${plain(v3p?.dil_max ?? 0.01)}/yr; ④ industry cap applies when filling the 10 slots.`
        : `빨간 글자 = 그 분석가의 관문에서 걸린 값. 주니어: 품질 5개 + 기대 알파 ≥ ${ppv(aMin)}. 시니어: + 하방 알파 ≥ 0 (FCF −30% · 성장 0 이하) · 반증 조건 없음. `
          + `수석 PM (시니어 후보만): ① SBC 차감 알파 ≥ ${ppv(v3p?.alpha_min ?? aMin)} · 하방 ≥ 0 ② EV 알파 ≥ ${ppv(v3p?.alpha_min ?? aMin)} ③ 주주환원 ≥ 0 · 희석 연 ${plain(v3p?.dil_max ?? 0.01)} 이하, ④ 업종 상한은 10칸에 넣을 때 본다.`}</span>}>
      {rows.map((r) => {
        const p = r.pm;
        const res = pmResult(r, picks, lang);
        const f = b.fairOf(r);
        return (
          <tr key={r.ticker}>
            <Who ticker={r.ticker} name={r.name} />
            <td className="small vm-ind">{r.industry}</td>
            <td className="r num vm-t__g0">{money(r.price, r.ticker)}</td>
            <BuyCell r={r} ticker={r.ticker} />
            <td className="r num vm-fair-td">{f ? fairText(f, r.ticker) : "—"}<BetaFloorMark warn={b.betaWarn(r)} lang={lang} /></td>
            <td className="r num">{pct(r.drop, 0)}</td>
            <td className={`r num ${tone(r.dd_3y)}`}>{pct(r.dd_3y, 0)}</td>
            <td className={`r num vm-t__g0${bad(r.gates.roic === false)}`}>{plain(r.roic)}<GapMark r={r} compact lang={lang} /></td>
            <td className="r num">{plain(r.fcf_y)}</td>
            <td className={`r num${r.alpha == null ? "" : r.alpha >= aMin ? " up" : " down"}`}>{ppv(r.alpha)}</td>
            <td className={`r num vm-t__g0${r.alpha_bear == null ? "" : r.alpha_bear >= 0 ? " up" : " down"}`}>{ppv(r.alpha_bear)}</td>
            <td className="r num">{pct(r.implied_g)}</td>
            <td className="r num">{pct(r.g1)}</td>
            <td className={`r num ${tone(r.gap)}`}>{ppv(r.gap)}</td>
            <td className="small">{r.kill?.length ? <span className="down">{killJoin(r.kill, lang)}</span> : <span className="muted">{en ? "None" : "없음"}</span>}</td>
            <td className={`r num vm-t__g0${bad(p && !p.sbc)}`}>{p ? `${ppv(p.alpha_real)} · ${ppv(p.alpha_bear_real)}` : "—"}</td>
            <td className={`r num${bad(p && !p.ev)}`}>{p ? ppv(p.alpha_ev) : "—"}</td>
            <td className={`r num${bad(p && !p.cap)}`}>{p ? `${pct(r.sh_y)} · ${pct(p.dil)}` : "—"}</td>
            <td className="c"><span className={`vm-st vm-st--${res.t}`}>{res.label}</span></td>
            <td className="vm-t__g0">{r.author === "coverage" || r.author === "research" ? <Tag>{en ? "Also in research" : "리서치도"}</Tag> : ""}</td>
          </tr>
        );
      })}
    </Table>
  );
}

function AuthorTable({ b, model, lang = "ko" }: { b: Board; model: ValueModel; lang?: Lang }) {
  const en = lang === "en";
  const gates = GATES_BY_LANG[lang];
  return (
    <Table
      head={<>
        <th>{en ? "Ticker" : "종목"}</th><th className="r">{en ? "Price" : "현재가"}</th><th className="r">{en ? "Research target" : "리서치 목표가"}</th><th className="r">{en ? "Our buy-below" : "우리 매수 기준가"}</th>
        <th className="r" title={FAIR_TIP[lang]}>{en ? "Our fair value (bear~base)" : "우리 적정가 (하방~기본)"}</th>
        {gates.map(([k, label]) => <th key={k} className="c">{label}</th>)}<th className="c">{en ? "Bear" : "하방"}</th>
        <th className="r">{en ? "Expected alpha" : "기대 알파"}</th><th className="r">{en ? "Growth gap" : "성장 괴리"}</th><th className="c">{en ? "Final status" : "최종 상태"}</th>
      </>}
      foot={<span>{en
        ? `Basis: 10Y Treasury ${plain(model.params.rf)} + β × ${plain(model.params.erp)} · terminal growth after 5Y ${plain(model.params.term_g)}. ✓ Pass · ✕ Fail · – N/A. If the buy-below price is above the current price (blue), it passes the price gate. When our listing differs from the research's, results are shown for our universe listing.`
        : `기준: 10년 국채 ${plain(model.params.rf)} + β × ${plain(model.params.erp)} · 5년 뒤 성장 ${plain(model.params.term_g)}. ✓ 통과 · ✕ 탈락 · – 판단 불가. 매수 기준가가 지금보다 높으면(파랑) 가격 관문 통과. 리서치와 우리 상장이 다르면 우리 대상 쪽 결과.`}</span>}>
      {b.authors.map((x) => {
        const r = x.mine ?? x.row;
        return (
          <tr key={x.ticker}>
            <Who ticker={x.ticker} name={r?.name} />
            <td className="r num">{money(x.price, x.ticker)}</td>
            <td className="r num">{money(x.target, x.ticker)}</td>
            <BuyCell r={x.row} ticker={x.ticker} />
            <td className="r num vm-fair-td">{(() => { const f = b.fairOf(x.row); return f ? fairText(f, x.ticker) : "—"; })()}
              <BetaFloorMark warn={b.betaWarn(x.row)} lang={lang} /></td>
            {gates.map(([k]) => <td key={k} className="c">{r ? <GateMark g={r.gates[k]} lang={lang} /> : "·"}{k === "roic" && <GapMark r={r} compact lang={lang} />}</td>)}
            <td className="c">{r && r.g_bear !== undefined ? <GateMark g={r.g_bear} lang={lang} title={en ? "Downside gate (alpha ≥ 0 even with FCF −30% & growth ≤ 0)" : "하방 관문 (FCF −30% · 성장 0 이하에서도 알파 ≥ 0)"} /> : "·"}</td>
            <td className={`r num ${tone(r?.alpha)}`}>{ppv(r?.alpha)}</td>
            <td className={`r num ${tone(r?.gap)}`}>{ppv(r?.gap)}</td>
            <td className="c"><StatusBadge r={r} lang={lang} /></td>
          </tr>
        );
      })}
    </Table>
  );
}

// ── v3 수석 PM (2026-11-16) — 시니어 후보 중 사각지대 4개(SBC · 부채(EV) · 자본배분 · 업종 쏠림)를 막은 종목으로 10칸, 빈칸 SPY

function PmChecks({ r, ind, lang = "ko" }: { r: VmRow; ind?: { n: number; cap: number }; lang?: Lang }) {
  const p = r.pm;
  const en = lang === "en";
  if (!p) return <span className="vm-pm__chk muted">{en ? "Data warming up" : "자료 준비 중"}</span>;
  const items: [string, boolean, string][] = en ? [
    ["①", p.sbc, `① SBC-deducted alpha ${ppv(p.alpha_real)} · bear ${ppv(p.alpha_bear_real)}${p.gaps.includes("sbc") ? " (no SBC line → 0)" : ""}`],
    ["②", p.ev, `② Firm-wide (EV) alpha ${ppv(p.alpha_ev)} (vs WACC)`],
    ["③", p.cap, `③ Shareholder yield ${pct(r.sh_y)} · 2-yr dilution ${pct(p.dil)}/yr${p.gaps.includes("shares") ? " (dilution N/A)" : ""}`],
  ] : [
    ["①", p.sbc, `① SBC 를 비용으로 뺀 알파 ${ppv(p.alpha_real)} · 하방 ${ppv(p.alpha_bear_real)}${p.gaps.includes("sbc") ? " (SBC 자료 없음 → 0)" : ""}`],
    ["②", p.ev, `② 회사 전체(EV) 기준 알파 ${ppv(p.alpha_ev)} (vs WACC)`],
    ["③", p.cap, `③ 주주환원 ${pct(r.sh_y)} · 최근 2년 희석 연 ${pct(p.dil)}${p.gaps.includes("shares") ? " (희석 판단 불가)" : ""}`],
  ];
  if (ind) items.push([
    "④",
    ind.n <= ind.cap,
    en
      ? `④ Industry cap — ${r.industry ?? "same industry"} ${ind.n}/${ind.cap} in this portfolio`
      : `④ 업종 쏠림 — 이 포트폴리오에서 ${r.industry ?? "같은 업종"} ${ind.n}/${ind.cap}종목`,
  ]);
  return (
    <span className="vm-pm__chk">
      {items.map(([k, ok, t]) => <span key={k} className={`vm-pm__c vm-pm__c--${ok ? "ok" : "no"}`} title={t}>{k}</span>)}
    </span>
  );
}

function PmCol({ b, model, lang }: { b: Board; model: ValueModel; lang: Lang }) {
  const v3 = model.v3;
  const n = v3?.params.slots ?? 10;
  const indN = new Map<string, number>();
  for (const r of b.pTop) indN.set(r.industry ?? "—", (indN.get(r.industry ?? "—") ?? 0) + 1);
  const spyN = n - b.pTop.length;
  const cov = v3?.want ? `${(v3.have ?? 0).toLocaleString()}/${v3.want.toLocaleString()}` : "";
  const en = lang === "en";
  return (
    <section className="vm-col vm-col--p">
      <ColHead icon="wallet" who={WHO[lang].pm} tone="p"
        rule={en ? "Senior candidates + SBC · debt (EV) · dilution · industry cap → 10 slots, empty slots in SPY" : "시니어 후보 + SBC · 부채(EV) · 희석 · 업종 쏠림 → 10칸, 빈칸은 SPY"}
        stamp={<Stamp model={model} k="v3" now={b.pTop.map((r) => r.ticker)} liveOk={false} lang={lang} />} />
      <Sub aside={v3 && (v3.ready
        ? <span className="vm-pm__st">{en ? `Tracking${v3.start ? ` · since ${fmtDate(v3.start, lang)}` : ""}` : `기록 중${v3.start ? ` · ${fmtDate(v3.start, lang)}부터` : ""}`}</span>
        : <span className="vm-pm__st vm-pm__st--wait" title={en ? "Fetching SBC & diluted shares — tracking starts on the night coverage reaches 95% (provisional until then)" : "SBC · 희석주식수를 새로 받는 중 — 대상의 95% 가 모이는 밤부터 기록 (그 전엔 임시 계산)"}>
          {en ? `Warming up ${cov}` : `자료 준비 중 ${cov}`}</span>)}>
        {en ? "10 slots · by SBC-adj bear alpha" : "10칸 · SBC 차감 하방 알파 큰 순"}
      </Sub>
      {v3 ? (
        <ol className="vm-list">
          {b.pTop.map((r, i) => (
            <Li key={r.ticker} rank={i + 1} r={r} hot metric={<>{en ? "Bear" : "하방"} {ppv(r.pm?.alpha_bear_real)}</>} metricTone="up" fair={b.fairOf(r)}
              warn={b.betaWarn(r)} lang={lang}
              sub={<><PmChecks r={r} ind={{ n: indN.get(r.industry ?? "—") ?? 1, cap: v3.params.ind_cap }} lang={lang} />{r.name}</>}
              marks={<Marks r={r} b={b} self="p" lang={lang} />} />
          ))}
          {spyN > 0 && (
            <li className="vm-li vm-li--spy">
              <span className="vm-li__rk num">{b.pTop.length + 1}{spyN > 1 ? `–${n}` : ""}</span>
              <span className="vm-li__who">
                <span className="vm-li__tk"><b>SPY</b></span>
                <span className="vm-li__nm">{en ? `${spyN} empty ${spyN === 1 ? "slot" : "slots"} — unallocated slots stay in the index` : `빈칸 ${spyN}칸 — 고를 게 없는 자리는 지수`}</span>
              </span>
              <span className="vm-li__m num">{Math.round((spyN / n) * 100)}%</span>
            </li>
          )}
        </ol>
      ) : <p className="vm-col__none">{en ? "No Lead PM data yet" : "수석 PM 자료가 아직 없다"}</p>}
      {v3 && (
        <p className="vm-col__note">
          {en
            ? "①②③④ = SBC deduction · firm-wide (EV) · shareholder yield & dilution · industry cap (hover for numbers). In 2014–2026 annual backtests on the S&P 500, it matched SPY (Sharpe 0.92 vs 0.95) while the stock sleeve alone lagged — forward tracking will judge."
            : "①②③④ = SBC 차감 · 회사 전체(EV) · 주주환원 · 희석 · 업종 상한 (마우스를 올리면 숫자). 과거 재검증(2014~2026, 1년에 한 번)은 S&P 500 기준 SPY 와 비슷(샤프 0.92 vs 0.95)했고 고른 종목만은 약했다 — 앞으로 기록으로 판정."}
        </p>
      )}
    </section>
  );
}

// ── 탭 ① 분석가 보드

type ViewProps = { model: ValueModel; lang: Lang };

export function BoardView({ model, lang }: ViewProps) {
  const b = boardData(model, lang);
  const TOP = 15;
  const en = lang === "en";
  const w = WHO[lang];
  return (
    <>
      <div className="vm-picks">
        <PickPanel mode="junior" rows={b.jPass} b={b} model={model} lang={lang} />
        <PickPanel mode="senior" rows={b.sPass} b={b} model={model} lang={lang} />
      </div>
      <div className="vm-board">
        <JuniorCol b={b} model={model} lang={lang} />
        <SeniorCol b={b} model={model} lang={lang} />
        <PmCol b={b} model={model} lang={lang} />
        <AuthorCol b={b} model={model} lang={lang} />
      </div>
      <p className="vm-board__key">
        {en ? (
          <>
            <span className="vm-mk__b vm-mk__b--j">J</span> <span className="vm-mk__b vm-mk__b--s">S</span>{" "}
            <span className="vm-mk__b vm-mk__b--p">P</span> <span className="vm-mk__b vm-mk__b--a">R</span>
            {" "}= also present in other lists (including dual listings of the same company). Numbers next to tickers show current price / buy-below price — at or below the buy-below price passes the price gate (blue). &lsquo;Fair&rsquo; is the share-price range where expected return equals required return (bear FCF −30% · growth 0 to base assumptions) — sensitive to assumptions, so not used as a target price.{" "}
            {b.minOne
              ? <>Beta minimum {b.floor}{model.params.beta_min_from ? ` (since ${fmtDate(model.params.beta_min_from, lang)})` : ""} — even when the measured beta is lower (stocks that move independently of the S&P), required return is computed at beta {b.floor}, so no stock gets a lower hurdle than the market average.</>
              : <><span className="vm-betafloor">Beta floor</span> = computed beta was below the floor ({b.floor}) and clipped — required return is set to the minimum, making buy-below and fair value higher (common in shipping & commodities that move independently of the S&P; low beta does not mean stable earnings).</>}
            {" "}Analysts pick only from our universe without knowing the research picks.
          </>
        ) : (
          <>
            <span className="vm-mk__b vm-mk__b--j">주</span> <span className="vm-mk__b vm-mk__b--s">시</span>{" "}
            <span className="vm-mk__b vm-mk__b--p">P</span> <span className="vm-mk__b vm-mk__b--a">리</span>
            {" "}= 다른 목록에도 있는 종목 (같은 회사의 다른 상장 포함). 티커 옆 숫자는 현재가 / 매수 기준가 — 매수 기준가 이하면 가격 관문 통과(파랑). &lsquo;적정&rsquo; 은 기대수익률이 요구수익률과 같아지는 주가의 범위(하방 FCF −30% · 성장 0 ~ 기본 가정) — 가정에 따라 크게 달라 목표가로 쓰지 않는다.
            {b.minOne
              ? <>베타는 최소 {b.floor}{model.params.beta_min_from ? ` (${fmtDate(model.params.beta_min_from, lang)}부터)` : ""} — 계산한 베타가 더 낮아도(S&P 와 따로 움직이는 종목) {b.floor} 로 계산해, 어떤 종목도 요구수익률이 시장 평균보다 낮게 잡히지 않는다.</>
              : <><span className="vm-betafloor">베타 하한</span> = 계산한 베타가 하한({b.floor})보다 낮아 잘린 종목 — 요구수익률이 가장 낮게 잡혀 매수 기준가 · 적정가가
                높게 나온다 (해운 · 원자재처럼 S&P 와 따로 움직이는 종목에 흔함, 베타가 낮다고 이익이 안정적인 건 아님).</>}
            {" "}분석가들은 리서치 종목을 모르는 채 우리 대상에서만 고른다.
          </>
        )}
      </p>
      <ScorePanel model={model} lang={lang} />
      {/* 접어 둔 자세히 (2026-11-19 사용자 순서) — 주니어 · 시니어 · 수석 PM (셋 다 같은 표) · 리서치 종목 · 가격만 싼 종목 */}
      <Fold title={en
        ? `${w.junior} full watchlist — passed 5 quality gates, waiting on price (${b.watchJ.length})`
        : `${JUNIOR} 대기 목록 전체 — 품질 5개 통과, 가격만 남음 (${b.watchJ.length})`}>
        <AnalystTable rows={b.watchJ.slice(0, TOP)} b={b} model={model} lang={lang} />
        {b.watchJ.length > TOP && <Fold title={en ? `Remaining ${b.watchJ.length - TOP} stocks` : `나머지 ${b.watchJ.length - TOP}종목`}>
          <AnalystTable rows={b.watchJ.slice(TOP)} b={b} model={model} lang={lang} /></Fold>}
      </Fold>
      {model.v2 && (
        <Fold title={en
          ? `${w.senior} full watchlist — sorted by largest growth gap, disconfirmed at the end (${b.watchS.length})`
          : `${SENIOR} 대기 목록 전체 — 성장 괴리 큰 순, 반증 걸린 종목은 뒤로 (${b.watchS.length})`}>
          <AnalystTable rows={b.watchS.slice(0, TOP)} b={b} model={model} lang={lang} />
          {b.watchS.length > TOP && <Fold title={en ? `Remaining ${b.watchS.length - TOP} stocks` : `나머지 ${b.watchS.length - TOP}종목`}>
            <AnalystTable rows={b.watchS.slice(TOP)} b={b} model={model} lang={lang} /></Fold>}
        </Fold>
      )}
      {model.v3 && (
        <Fold title={en
          ? `${w.pm} review — which gates filtered the ${b.pmCands.length} ${w.senior} candidates`
          : `${PM} 심사 — ${SENIOR} 후보 ${b.pmCands.length}개가 어느 관문에서 걸렸나`}>
          <AnalystTable rows={b.pmCands.slice(0, TOP)} b={b} model={model} lang={lang} />
          {b.pmCands.length > TOP && <Fold title={en ? `Remaining ${b.pmCands.length - TOP} stocks` : `나머지 ${b.pmCands.length - TOP}종목`}>
            <AnalystTable rows={b.pmCands.slice(TOP)} b={b} model={model} lang={lang} /></Fold>}
        </Fold>
      )}
      <Fold title={en
        ? `${b.authors.length} research picks — detailed gate results (✓ · ✕)`
        : `리서치 종목 ${b.authors.length}개 — 우리 관문 자세히 (✓ · ✕)`}><AuthorTable b={b} model={model} lang={lang} /></Fold>
      <Fold title={en
        ? `${b.traps.length} cheap-only stocks — failed quality ('cheap for a reason' / value-trap candidates)`
        : `가격만 싼 종목 ${b.traps.length}개 — 품질에서 떨어진 '싼 이유가 있는' 회사 (가치 함정 후보)`}>
        <div className="vm-chips">
          {b.traps.map((r) => (
            <span key={r.ticker} className="vm-chip vm-chip--trap" title={`${en ? "Alpha" : "알파"} ${ppv(r.alpha)}`}>
              <TickerLink ticker={r.ticker} /> <span>{en ? `Failed ${r.fails.join("·")}` : `${r.fails.join("·")} 탈락`}</span>
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

const DOC_SECTIONS_EN = [
  { id: "vm-rules", label: "Analyst Rules (v1 · v2 · v3)" },
  { id: "vm-retro", label: "Retrospective — Back Then" },
  { id: "vm-aseries", label: "Past Screen Lists" },
] as const;

export function docSections(lang: Lang = "ko"): readonly { id: string; label: string }[] {
  return lang === "en" ? DOC_SECTIONS_EN : DOC_SECTIONS;
}

export function DocRules({ model, lang = "ko" }: { model: ValueModel; lang?: Lang }) {
  const p = model.params;
  const u = p.universe;
  const floor = p.beta_min ?? BETA_FLOOR;
  const minOne = betaMinOne(floor);
  const en = lang === "en";
  const w = WHO[lang];
  if (en) {
    return (
      <section className="vm-rules" id="vm-rules">
        <RuleStrip who={`${w.junior} · v1`}
          items={[
            u?.size
              ? `Universe — US listings + TSX, market cap US$1B+, excluding banks, insurance, asset managers & REITs (currently ${u.size.toLocaleString()} stocks). Dual listings deduplicated (TSX preferred)`
              : "Universe — S&P 500 + research picks (legacy basis)",
            `5 quality gates — ROE avg ≥ ${plain(p.roe_min)} · CV ≤ ${p.cv_max} / ROIC ≥ ${plain(p.roic_min)} · exceeds WACC / Altman Z ≥ ${p.altman_min} / Beneish M ≤ ${p.beneish_max} / FCF positive every year`,
            `Price — 2-stage DCF expected return − required return ≥ ${ppv(p.alpha_min)} (terminal growth after 5Y ${plain(p.term_g)})`,
            minOne
              ? `Required return — 10Y Treasury + beta × ${plain(p.erp)}, with beta clipped to ${floor}–2.5 (minimum ${floor}${p.beta_min_from ? ` since ${fmtDate(p.beta_min_from, lang)}` : ""}; before that 0.3, which pulled required return of stocks moving independently of the S&P down toward the Treasury yield and pushed buy-below and fair value up — tracking entries before that date were picked with 0.3)`
              : `Required return — 10Y Treasury + beta × ${plain(p.erp)}, with beta clipped to ${floor}–2.5. Stocks at the lower bound are tagged 'Beta floor' — required return is set to the minimum, making buy-below and fair value higher (display only)`,
            "Top 10 — sorted by smallest drop needed to reach the buy-below price (reselected on the first run of each month)",
            "Fair value range (display only) — share price where expected return = required return, from bear (FCF −30% · first 5Y growth ≤ 0) to base assumptions. The buy-below price uses required return + 5%p in the same formula, so it is always lower. Highly sensitive to a single assumption, so not used as a target price",
          ]}
          note="Rules translated directly from the research checklist. Picks only from the universe above without knowing the research stocks — once a stock passes, it is tracked from that day's close." />
        <RuleStrip who={`${w.senior} · v2`}
          items={[
            `${w.junior} pass + downside gate (alpha ≥ 0 even with FCF −30% & first 5Y growth ≤ 0) + no disconfirming conditions`,
            "Top 10 — sorted by largest growth gap (actual revenue growth − perpetual growth implied by current price), excluding disconfirmed stocks",
            "Disconfirming conditions — failing quality, declining revenue, market-implied growth > actual, or reaching fair value removes the stock from pass picks and ends its tracking (if cleared and passed again later, tracked as a new entry)",
          ]}
          note={minOne ? "Industry concentration (3+ in the same industry within top 20) is a display-only flag."
            : "Beta-sensitive (fails if beta floor is raised to 0.6) and industry concentration (3+ in the same industry within top 20) are display-only flags."} />
        {model.v3 && (
          <RuleStrip who={`${w.pm} · v3`}
            items={[
              `Starts from ${w.senior} candidates (passed quality · no disconfirming) — ① deducting SBC (stock-based compensation) as an expense from FCF must still pass the price gate (alpha ≥ ${ppv(model.v3.params.alpha_min)}) and downside gate (alpha ≥ 0 with FCF −${Math.round(model.v3.params.bear_fcf_cut * 100)}% & growth ≤ 0)`,
              `② Leverage illusion — firm-wide including debt: expected return of (FCF − SBC + after-tax interest) ÷ EV − WACC ≥ ${ppv(model.v3.params.alpha_min)}`,
              `③ Capital allocation & dilution — shareholder yield (3Y avg dividends + buybacks − issuance) ≥ 0 · 2Y diluted share count growth ≤ ${plain(model.v3.params.dil_max)}/yr`,
              `④ Industry cap & portfolio — up to ${model.v3.params.slots} slots sorted by SBC-deducted bear alpha, max ${model.v3.params.ind_cap} per industry, ${Math.round(100 / model.v3.params.slots)}% per slot, empty slots in SPY. Rebalanced on the first run of each month; any stock hitting a disconfirming condition switches to SPY that day`,
            ]}
            note="Addresses the 4 blind spots from the Wall Street review & v3 proposal, with the EV formula corrected not to double-count debt (the draft divided levered FCF by EV against Ke). Backtests cannot be separated from luck — rules are locked and judged by forward tracking." />
        )}
        <RuleStrip who={w.research}
          items={[
            "Coverage list — target prices & ratings. Checked weekly and mirrored automatically (additions, removals, targets)",
            "Research notes — each note's ticker, thesis & target price are added line by line (new-note alert → 'summarize new note')",
            "Selection style — checklist + discretionary DCF + contrarian (after sharp drawdowns). Summarized in sections 4 & 5 below",
          ]}
          note="All lists are tracked from the same day to compare performance — research picks start on the first day they appear on the list, and end on the day they are removed." />
      </section>
    );
  }
  return (
    <section className="vm-rules" id="vm-rules">
      <RuleStrip who={`${JUNIOR} · v1`}
        items={[
          u?.size
            ? `대상 — 미국 상장 + TSX, 시가총액 US$10억 이상, 은행 · 보험 · 운용 · 리츠 제외 (지금 ${u.size.toLocaleString()}종목). 같은 회사는 한 줄(TSX 쪽 우선)`
            : "대상 — S&P 500 + 리서치 종목 (예전 기준)",
          `품질 5개 — ROE 평균 ≥ ${plain(p.roe_min)} · CV ≤ ${p.cv_max} / ROIC ≥ ${plain(p.roic_min)} · WACC 초과 / Altman Z ≥ ${p.altman_min} / Beneish M ≤ ${p.beneish_max} / FCF 매년 플러스`,
          `가격 — 2단계 DCF 기대수익률 − 요구수익률 ≥ ${ppv(p.alpha_min)} (5년 뒤 성장 ${plain(p.term_g)})`,
          minOne
            ? `요구수익률 — 10년 국채 + 베타 × ${plain(p.erp)}, 베타는 ${floor}~2.5 로 자름 (${p.beta_min_from ? `${fmtDate(p.beta_min_from, lang)}부터 ` : ""}최소 ${floor}. 그 전엔 0.3 이라 S&P 와 따로 움직이는 종목의 요구수익률이 국채 근처까지 내려가 매수 기준가 · 적정가가 높게 나왔다 — 그 전 기록은 0.3 으로 고른 것)`
            : `요구수익률 — 10년 국채 + 베타 × ${plain(p.erp)}, 베타는 ${floor}~2.5 로 자름. 하한에 걸린 종목은 '베타 하한' 표시 — 요구수익률이 가장 낮게 잡혀 매수 기준가 · 적정가가 높게 나온다 (표시만)`,
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
        note={minOne ? "업종 집중(상위 20 안 같은 업종 3개 이상)은 표시만."
          : "베타 민감(베타 하한 0.6 이면 탈락) · 업종 집중(상위 20 안 같은 업종 3개 이상)은 표시만."} />
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
  const en = lang === "en";
  const gates = GATES_BY_LANG[lang];
  return (
    <Panel id="vm-aseries" title={en ? "Past research screen lists — through our current gates" : "리서치 스크린 과거 목록 — 지금 우리 관문으로"}
      sub={en
        ? "Checklist-passing / undervalued lists published in research market notes (late Sep & late Oct 2025). Not current recommendations — performance as of publication dates is in the retrospective above."
        : "리서치 시황 노트(2025-09 말 · 10월 말)에 실린 체크리스트 통과 · 저평가 목록. 지금 추천하는 목록은 아니다 — 게시일 기준 결과는 위 회고에."}>
      <Table head={<>
        <th>{en ? "Ticker" : "종목"}</th><th>{en ? "Posted" : "게시"}</th><th className="r">{en ? "Price" : "현재가"}</th><th className="r">{en ? "Our buy-below" : "우리 매수 기준가"}</th>
        {gates.map(([k, label]) => <th key={k} className="c">{label}</th>)}<th className="c">{en ? "Bear" : "하방"}</th>
        <th className="r">{en ? "Expected alpha" : "기대 알파"}</th><th className="c">{en ? "Final status" : "최종 상태"}</th>
      </>}>
        {rows.map(({ s, r }) => (
          <tr key={`${s.ticker}-${s.date}`}>
            <Who ticker={s.ticker} name={r?.name} />
            <td>{fmtDate(s.date, lang)}</td>
            <td className="r num">{money(r?.price, s.ticker)}</td>
            <BuyCell r={r} ticker={s.ticker} />
            {gates.map(([k]) => <td key={k} className="c">{r ? <GateMark g={r.gates[k]} lang={lang} /> : "·"}{k === "roic" && <GapMark r={r} compact lang={lang} />}</td>)}
            <td className="c">{r && r.g_bear !== undefined ? <GateMark g={r.g_bear} lang={lang} /> : "·"}</td>
            <td className={`r num ${tone(r?.alpha)}`}>{ppv(r?.alpha)}</td>
            <td className="c"><StatusBadge r={r} lang={lang} /></td>
          </tr>
        ))}
      </Table>
    </Panel>
  );
}
