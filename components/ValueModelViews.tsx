import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { TickerLink } from "./TickerLink";
import { fmtDate, money, pct, tone } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import type { Gate, ValueModel, VmGroup, VmResearch, VmRow, VmSummary, VmTab, VmTrack } from "@/lib/valueModel";

/**
 * 내계좌 › 예측 모델 화면 (2026-11-12 개편 — 사용자 시안: 위 숫자 4칸 + 안쪽 탭 + 대표 픽 카드 + 저자 종목 교차 검증 표).
 * 저자 종목 출처는 두 곳 (2026-11-12): 저자 사이트 Coverage 페이지 + Ideas(블로그) 심층 리서치 글 (Fiserv 처럼 커버리지에 없는 종목도).
 * 모델 결과는 Project_1 web_export/value_model.py 가 밤마다 만드는 value_model.json (없으면 스냅샷).
 * 주니어 분석가 = v1 (저자 체크리스트 그대로: 품질 5개 + 가격), 시니어 분석가 = v2 (주니어 + 하방 관문 · 괴리 순 · 반증 조건).
 * 두 규칙은 같은 날부터 함께 기록해 어느 쪽이 나은지 본다. 시안의 왼쪽 세로 메뉴 · 엔진 지연시간 같은 장식 숫자는 안 씀.
 */

const GATES = [
  ["roe", "ROE"], ["roic", "ROIC"], ["z", "Z"], ["m", "M"], ["fcf", "FCF"], ["price", "가격"],
] as const;

export const JUNIOR = "주니어 분석가";

const AUTHOR_TAG = { coverage: "저자 커버리지 일치", research: "저자 리서치 글 종목", screen: "저자 A-Series 목록" } as const;
export const SENIOR = "시니어 분석가";

const GROUP_LABEL: Record<VmGroup, string> = {
  ours: "주니어 통과", v2: "시니어 통과", v1_top: "주니어 상위 10", v2_top: "시니어 상위 10", author: "저자 종목",
};

/** 0.06 → '+6.0%p' (알파 · 괴리처럼 %p 로 읽는 값). */
export function ppv(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v * 100).toFixed(1);
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${a}%p`;
}

const plain = (v: number | null | undefined) => pct(v, 1, false);

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

function Panel({ title, sub, aside, children, className }: {
  title: ReactNode; sub?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`vm-panel${className ? ` ${className}` : ""}`}>
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

function Summary({ s }: { s: VmSummary | undefined }) {
  if (!s || !s.n) return <>아직 기록 없음</>;
  return <><b className={`num ${tone(s.excess)}`}>{ppv(s.excess)}</b> ({s.beat}/{s.n} 이김)</>;
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
  const picks = model.rows.filter((r) => r.pass_v2);
  const one = picks.length === 1 ? picks[0] : null;
  const rate = f.computed ? (f.quality / f.computed) * 100 : 0;
  return (
    <div className="vm-kpis">
      <Kpi label="분석 대상 유니버스" icon="database" foot={`금융 · 리츠 제외 ${f.excluded}개`} tag="S&P 500 + 저자 종목">
        <b className="vm-kpi__n">{f.computed}</b><span>개</span>
      </Kpi>
      <Kpi label="품질 5대 관문 통과" icon="check-badge" className="vm-kpi--good"
        foot={<span className="num">ROE {f.roe} · ROIC {f.roic} · Z {f.z} · M {f.m} · FCF {f.fcf}</span>}>
        <b className="vm-kpi__n">{f.quality}</b><span>개 (통과율 {rate.toFixed(1)}%)</span>
      </Kpi>
      <Kpi label="가격 관문 통과" icon="scale" foot={`요구수익률 = 10년 국채 ${plain(p.rf)} + β × ${plain(p.erp)}`} tag="DCF 2단계">
        <b className="vm-kpi__n">{f.price}</b><span>개 (알파 ≥ {ppv(p.alpha_min)})</span>
      </Kpi>
      <Kpi label={`${SENIOR} 최종 픽`} icon="pin" className="vm-kpi--pick"
        foot={one ? <>하방 알파 {ppv(one.alpha_bear)}{one.author ? " · 저자도 ○" : ""}{one.sensitive ? " · " : ""}{one.sensitive && <b className="vm-warn-t">베타 민감</b>}</>
          : picks.length ? `${JUNIOR} 통과 ${f.pass}개 중 하방 관문까지` : `${JUNIOR} 통과 ${f.pass}개 · 시니어 0`}>
        {one ? (
          <div className="vm-kpi__pick">
            <span className="vm-kpi__tk"><TickerLink ticker={one.ticker} /></span>
            <span className="vm-kpi__nm">{one.name}</span>
            <span className="vm-kpi__chip">알파<b>{ppv(one.alpha)}</b></span>
          </div>
        ) : picks.length ? (
          <div className="vm-kpi__pick">
            <b className="vm-kpi__n">{picks.length}</b><span>개</span>
            <span className="vm-kpi__list">{picks.slice(0, 4).map((r) => <TickerLink key={r.ticker} ticker={r.ticker} />)}</span>
          </div>
        ) : (
          <><b className="vm-kpi__n">0</b><span>개 — 지금은 없음</span></>
        )}
      </Kpi>
    </div>
  );
}

// ── 안쪽 탭

const TABS: { key: VmTab; label: string; sub: string; icon: IconName }[] = [
  { key: "author", label: "저자 대조", sub: "커버리지 · 리서치 글", icon: "compare" },
  { key: "junior", label: JUNIOR, sub: "v1", icon: "user" },
  { key: "senior", label: SENIOR, sub: "v2", icon: "user-star" },
  { key: "cmp", label: "주니어 vs 시니어", sub: "비교 · 기록", icon: "scale" },
  { key: "doc", label: "문서 기록", sub: "블로그 정리 1~8", icon: "doc" },
];

export function VmTabBar({ tab, model, live, lang }: { tab: VmTab; model: ValueModel; live: boolean; lang: Lang }) {
  return (
    <div className="vm-tabbar">
      <nav className="vm-tabs" aria-label="예측 모델 보기">
        {TABS.map((x) => (
          <Link key={x.key} href={x.key === "author" ? "/quant/model" : `/quant/model?tab=${x.key}`}
            aria-current={x.key === tab ? "page" : undefined} scroll={false}>
            <Icon name={x.icon} size={16} />
            <span>{x.label}</span>
            <span className="vm-tabs__sub">{x.sub}</span>
          </Link>
        ))}
      </nav>
      <p className={`vm-tabbar__meta${live ? "" : " vm-tabbar__meta--snap"}`}>
        <span className="vm-dot" aria-hidden="true" />
        {live ? `${fmtDate(model.date, lang)} 종가 · 밤마다 다시 계산` : `임시 스냅샷 · ${fmtDate(model.date, lang)} 로컬 실행`}
      </p>
    </div>
  );
}

// ── 대표 픽 카드 (시안의 'v2 단독 통과 픽')

function PickHero({ r, mode, lang }: { r: VmRow; mode: "junior" | "senior"; lang: Lang }) {
  const senior = mode === "senior";
  return (
    <section className="vm-hero">
      <div className="vm-hero__icon"><Icon name={senior ? "shield" : "check-badge"} size={24} /></div>
      <div className="vm-hero__body">
        <h3>
          {senior ? "시니어 통과 픽" : "주니어 통과 픽"}: <TickerLink ticker={r.ticker} /> <span className="vm-hero__nm">({r.name})</span>
        </h3>
        <div className="vm-hero__tags">
          {r.industry && <Tag tone="info">{r.industry}</Tag>}
          <Tag tone="good">품질 5개 통과</Tag>
          {r.author && <Tag>{AUTHOR_TAG[r.author]}</Tag>}
          {senior && r.sensitive && <Tag tone="warn" title={`베타 0.6 이면 알파 ${ppv(r.alpha_b06)}`}>베타 민감</Tag>}
          {!senior && r.pass_v2 && <Tag tone="good">시니어도 통과</Tag>}
          {!senior && !r.pass_v2 && <Tag tone="warn">시니어 하방 관문 탈락</Tag>}
        </div>
        <p>
          {senior
            ? <>하방 관문: FCF 가 30% 줄고 첫 5년 성장이 0 이하여도 알파 {ppv(r.alpha_bear)} ≥ 0. {r.sensitive && <>베타 하한을 0.6 으로 올리면 알파 {ppv(r.alpha_b06)} 로 가격 관문 탈락 — 베타 하나에 걸린 경계선 종목.</>}</>
            : <>품질 5개(ROE {plain(r.roe)} · ROIC {plain(r.roic)} &gt; WACC {plain(r.wacc)} · Z {r.z?.toFixed(2)} · M {r.m?.toFixed(2)} · FCF {r.fcf_years}년 플러스) + 가격 관문(알파 {ppv(r.alpha)} ≥ 5%p).</>}
          {" "}재무 {r.fetched ? `${fmtDate(r.fetched, lang)} 받음` : ""} · 베타 {r.beta?.toFixed(2)}.
        </p>
      </div>
      <dl className="vm-hero__stats">
        <div><dt>현재가 / 매수 기준가</dt><dd className="num">{money(r.price, r.ticker)} / {money(r.buy, r.ticker)}</dd></div>
        <div><dt>기대 알파 / 하방 알파</dt><dd className="num up">{ppv(r.alpha)} / {ppv(r.alpha_bear)}</dd></div>
        {senior ? <>
          <div><dt>성장률 (시장 가정 vs 실제)</dt><dd className="num">{pct(r.implied_g)} vs {pct(r.g1)}</dd></div>
          <div><dt>성장 괴리 / 3년 고점 대비</dt><dd className="num"><span className={tone(r.gap)}>{ppv(r.gap)}</span> <span className={tone(r.dd_3y)}>({pct(r.dd_3y, 0)})</span></dd></div>
        </> : <>
          <div><dt>FCF 수익률 / 요구수익률</dt><dd className="num">{plain(r.fcf_y)} / {plain(r.ke)}</dd></div>
          <div><dt>매수 기준가 여유 / 3년 고점 대비</dt><dd className="num">{pct(r.drop, 0)} <span className={tone(r.dd_3y)}>({pct(r.dd_3y, 0)})</span></dd></div>
        </>}
      </dl>
    </section>
  );
}

function Picks({ rows, mode, lang, model }: { rows: VmRow[]; mode: "junior" | "senior"; lang: Lang; model: ValueModel }) {
  if (rows.length === 0) {
    const f = model.funnel;
    return (
      <section className="vm-hero vm-hero--empty">
        <div className="vm-hero__icon"><Icon name="pin" size={22} /></div>
        <div className="vm-hero__body">
          <h3>{mode === "senior" ? SENIOR : JUNIOR} 통과 종목 — 지금은 없음</h3>
          <p>이 방식은 늘 여러 종목이 나오는 스크린이 아니다. 품질 통과 {f.quality}개가 아래 대기 목록에서 매수 기준가까지 내려오길 기다린다.</p>
        </div>
      </section>
    );
  }
  if (rows.length <= 3) return <>{rows.map((r) => <PickHero key={r.ticker} r={r} mode={mode} lang={lang} />)}</>;
  return (
    <Panel title={`${mode === "senior" ? SENIOR : JUNIOR} 통과 — ${rows.length}종목`}>
      <Table head={<>
        <th>종목</th><th>업종</th><th className="r">현재가</th><th className="r">매수 기준가</th><th className="r">알파</th>
        <th className="r">하방 알파</th><th className="r">괴리</th><th className="r">3년 고점 대비</th><th>표시</th>
      </>}>
        {rows.map((r) => (
          <tr key={r.ticker}>
            <Who ticker={r.ticker} name={r.name} />
            <td className="small">{r.industry}</td>
            <td className="r num">{money(r.price, r.ticker)}</td>
            <BuyCell r={r} ticker={r.ticker} />
            <td className="r num up">{ppv(r.alpha)}</td>
            <td className={`r num ${tone(r.alpha_bear)}`}>{ppv(r.alpha_bear)}</td>
            <td className={`r num ${tone(r.gap)}`}>{ppv(r.gap)}</td>
            <td className={`r num ${tone(r.dd_3y)}`}>{pct(r.dd_3y, 0)}</td>
            <td>{r.author && <Tag>저자도</Tag>} {r.sensitive && <Tag tone="warn">베타 민감</Tag>}</td>
          </tr>
        ))}
      </Table>
    </Panel>
  );
}

// ── 저자 종목 교차 검증 (시안 가운데 표) · 리서치 글

/** 저자 종목 한 줄 — 출처 두 곳 (2026-11-12): Coverage 페이지(목표가 · 의견)와 Ideas 의 심층 리서치 글. */
type AuthorItem = {
  ticker: string;
  price: number | null;
  target: number | null;
  upside: number | null;
  covered: boolean; // Coverage 페이지에 있음
  posts: VmResearch[]; // 그 종목 리서치 글 (적정가 업데이트 포함)
};

function authorItems(model: ValueModel, byT: Map<string, VmRow>): AuthorItem[] {
  const research = model.author.research ?? [];
  const postsOf = (t: string) => research.filter((a) => a.ticker === t);
  const items: AuthorItem[] = model.author.coverage.map((c) => ({
    ticker: c.ticker, price: c.price, target: c.target, upside: c.upside, covered: true, posts: postsOf(c.ticker),
  }));
  for (const a of research) {
    if (items.some((x) => x.ticker === a.ticker)) continue;
    const posts = postsOf(a.ticker);
    const last = [...posts].reverse().find((x) => x.target != null) ?? posts[posts.length - 1];
    items.push({
      ticker: a.ticker, price: byT.get(a.ticker)?.price ?? last.price, target: last.target, upside: last.upside,
      covered: false, posts,
    });
  }
  return items;
}

function SourceCell({ x }: { x: AuthorItem }) {
  const last = x.posts[x.posts.length - 1];
  const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
  return (
    <td className="vm-src">
      {x.covered && <span className="vm-src__b" title="저자 사이트 Coverage 페이지 — 목표가 · 의견">커버리지</span>}
      {last && (
        <a className="vm-src__b vm-src__b--post" href={last.url} target="_blank" rel="noopener noreferrer"
          title={x.posts.map((p) => `${p.date} ${p.kind} · ${p.view}`).join("\n") + "\n— 최근 글 원문 열기"}>
          리서치 {md(last.date)}{x.posts.length > 1 ? ` 외 ${x.posts.length - 1}` : ""}
        </a>
      )}
    </td>
  );
}

function CrossTable({ model, byT }: { model: ValueModel; byT: Map<string, VmRow> }) {
  const items = authorItems(model, byT).map((x) => ({ x, r: byT.get(x.ticker) }));
  const nCov = items.filter(({ x }) => x.covered).length;
  const nRes = items.length - nCov;
  const q = items.filter(({ r }) => r?.quality).length;
  const pr = items.filter(({ r }) => r?.gates.price).length;
  const j = items.filter(({ r }) => r?.pass).length;
  const sv = items.filter(({ r }) => r?.pass_v2).length;
  const s = model.tracking.summary;
  return (
    <Panel className="vm-panel--x"
      title={`저자 종목 ${items.length}개 전수 교차 검증 — 커버리지 ${nCov}${nRes ? ` + 리서치 글에만 ${nRes}` : ""}`}
      sub={<>저자 종목은 두 곳에서 온다: Coverage 페이지({model.author.as_of} 기준 목표가 · 의견)와 Ideas(블로그)의 심층 리서치 글.
        우리 관문으로 다시 계산 — 품질 통과 {q} · 가격 통과 {pr} · 주니어 통과 {j} · 시니어 통과 {sv}.
        ✓ 통과 · ✕ 탈락 · – 판단 불가. 매수 기준가가 지금보다 높으면(파랑) 가격 관문 통과.</>}
      aside={<>
        <span className="vm-pill">시니어 픽 지수 대비 <Summary s={s.v2} /></span>
        <span className="vm-pill">저자 종목 지수 대비 <Summary s={s.author} /></span>
      </>}>
      <Table
        head={<>
          <th>종목 / 기업명</th><th>출처</th><th className="r">현재가</th><th className="r">저자 목표가</th><th className="r">상승여력</th>
          <th className="r">우리 매수 기준가</th>
          {GATES.map(([k, label]) => <th key={k} className="c">{label}</th>)}<th className="c">하방</th>
          <th className="r">기대 알파</th><th className="r">성장 괴리</th><th className="c">최종 상태</th>
        </>}
        foot={<>
          <span>* 매수 추천이 아니라 후보를 찾는 절차를 기계적으로 돌린 결과. yfinance 연간 4~5년치라 변동계수가 저자의 10년 기준보다 엄격하다.
            리서치 글에만 있는 종목의 목표가는 글의 기본 시나리오.</span>
          <span>기준: 10년 국채 {plain(model.params.rf)} + β × {plain(model.params.erp)} · 5년 뒤 성장 {plain(model.params.term_g)}</span>
        </>}>
        {items.map(({ x, r }) => (
          <tr key={x.ticker} className={r?.pass_v2 ? "vm-row--pass" : r?.pass ? "vm-row--junior" : undefined}>
            <Who ticker={x.ticker} name={r?.name}
              badge={r?.pass_v2 ? <span className="vm-mini vm-mini--pass">시니어</span> : r?.pass ? <span className="vm-mini">주니어</span> : null} />
            <SourceCell x={x} />
            <td className="r num">{money(x.price, x.ticker)}</td>
            <td className="r num">{money(x.target, x.ticker)}</td>
            <td className={`r num ${tone(x.upside)}`}>{pct(x.upside, 0)}</td>
            <BuyCell r={r} ticker={x.ticker} />
            {GATES.map(([k]) => <td key={k} className="c">{r ? <GateMark g={r.gates[k]} /> : "·"}</td>)}
            <td className="c">{r && r.g_bear !== undefined ? <GateMark g={r.g_bear} title="하방 관문 (FCF −30% · 성장 0 이하에서도 알파 ≥ 0)" /> : "·"}</td>
            <td className={`r num ${tone(r?.alpha)}`}>{ppv(r?.alpha)}</td>
            <td className={`r num ${tone(r?.gap)}`}>{ppv(r?.gap)}</td>
            <td className="c"><StatusBadge r={r} /></td>
          </tr>
        ))}
      </Table>
    </Panel>
  );
}

/** Ideas(블로그)의 심층 리서치 글 — 저자 종목의 두 번째 출처. 글마다 저자 결론 · 원문 · 게시일 이후 성과 · 우리 관문 결과. */
function ResearchPanel({ model, byT, lang }: { model: ValueModel; byT: Map<string, VmRow>; lang: Lang }) {
  const rs = [...(model.author.research ?? [])].reverse(); // 최근 글 먼저
  const title = `저자 심층 리서치 글 ${rs.length ? `${rs.length}개 ` : ""}— Ideas(블로그)`;
  const sub = "회사 하나를 길게 분석한 글만 모았다 — Model C 리서치 · 적정가 업데이트 · 2026 특수상황 장문. 게시일 종가에 샀다면 지금까지(배당 포함), 같은 기간 SPY(캐나다는 XIU) 대비.";
  if (!rs.length) {
    return <Panel title={title} sub={sub}><p className="muted small">리서치 글 자료는 다음 밤 실행부터 나온다.</p></Panel>;
  }
  const ex = rs.map((a) => a.excess).filter((v): v is number => v != null && Number.isFinite(v));
  const avg = ex.length ? ex.reduce((x, y) => x + y, 0) / ex.length : null;
  return (
    <Panel title={title} sub={sub}
      aside={<span className="vm-pill">지수를 이긴 글 <b className="num">{ex.filter((v) => v > 0).length}/{ex.length}</b> · 평균 <b className={`num ${tone(avg)}`}>{ppv(avg)}</b></span>}>
      <Table head={<>
        <th>종목</th><th>게시일</th><th>글</th><th>저자 결론</th><th className="r">현재가</th><th className="r">목표까지</th>
        <th className="r">게시 후</th><th className="r">지수</th><th className="r">차이</th><th className="c">우리 지금</th>
      </>}>
        {rs.map((a) => {
          const r = byT.get(a.ticker);
          return (
            <tr key={a.slug}>
              <Who ticker={a.ticker} name={r?.name} />
              <td className="vm-nowrap">{fmtDate(a.date, lang)}</td>
              <td><a className="vm-post" href={a.url} target="_blank" rel="noopener noreferrer">{a.kind} ↗</a></td>
              <td className="vm-view">{a.view}</td>
              <td className="r num">{money(a.price, a.ticker)}</td>
              <td className={`r num ${tone(a.upside)}`}>{pct(a.upside, 0)}</td>
              <td className={`r num ${tone(a.ret)}`}>{pct(a.ret)}</td>
              <td className="r num">{a.bench.startsWith("XIU") ? "XIU " : "SPY "}{pct(a.bench_ret)}</td>
              <td className={`r num ${tone(a.excess)}`}>{ppv(a.excess)}</td>
              <td className="c"><StatusBadge r={r} /></td>
            </tr>
          );
        })}
      </Table>
    </Panel>
  );
}

function ScreenTable({ model, byT, lang }: { model: ValueModel; byT: Map<string, VmRow>; lang: Lang }) {
  const rows = model.author.screen.map((s) => ({ s, r: byT.get(s.ticker) }));
  return (
    <Panel title="저자 A-Series 스크린 종목 — 지금 우리 관문으로" sub="저자 시황 글(2025-09 말 · 10월 말)에 올라온 체크리스트 통과 · 저평가 목록. 게시일 기준 결과는 아래 회고에.">
      <Table head={<>
        <th>종목</th><th>저자 게시</th><th className="r">현재가</th><th className="r">우리 매수 기준가</th>
        {GATES.map(([k, label]) => <th key={k} className="c">{label}</th>)}<th className="c">하방</th>
        <th className="r">기대 알파</th><th className="c">최종 상태</th>
      </>}>
        {rows.map(({ s, r }) => (
          <tr key={`${s.ticker}-${s.date}`}>
            <Who ticker={s.ticker} name={r?.name} />
            <td>{fmtDate(s.date, lang)}</td>
            <td className="r num">{money(r?.price, s.ticker)}</td>
            <BuyCell r={r} ticker={s.ticker} />
            {GATES.map(([k]) => <td key={k} className="c">{r ? <GateMark g={r.gates[k]} /> : "·"}</td>)}
            <td className="c">{r && r.g_bear !== undefined ? <GateMark g={r.g_bear} /> : "·"}</td>
            <td className={`r num ${tone(r?.alpha)}`}>{ppv(r?.alpha)}</td>
            <td className="c"><StatusBadge r={r} /></td>
          </tr>
        ))}
      </Table>
    </Panel>
  );
}

// ── 아래 두 칸 (업종 집중 · 가치 함정)

function ThemePanel({ model }: { model: ValueModel }) {
  const v2 = model.v2;
  if (!v2) return null;
  const items = Object.entries(v2.theme);
  const warn = items.filter(([, n]) => n >= v2.params.theme_warn).length;
  return (
    <Panel title={`업종 집중도 — ${SENIOR} 상위 ${v2.params.theme_top}`}
      sub={`같은 업종이 ${v2.params.theme_warn}개 이상이면 주황 — 한 테마에 몰리면 종목이 여러 개여도 사실상 베팅 하나다.`}
      aside={<Tag tone={warn ? "warn" : "plain"}>{warn ? `집중 ${warn}곳` : "다각화 양호"}</Tag>}>
      <div className="vm-chips">
        {items.map(([ind, n]) => (
          <span key={ind} className={`vm-chip${n >= v2.params.theme_warn ? " vm-chip--warn" : ""}`}>{ind} <b className="num">{n}</b></span>
        ))}
      </div>
    </Panel>
  );
}

function TrapPanel({ rows }: { rows: VmRow[] }) {
  return (
    <Panel title={`가격만 통과하고 품질에서 떨어진 ${rows.length}종목`}
      sub="숫자로는 싸 보이지만 빚이 많거나(Altman Z) 수익성이 들쭉날쭉한(ROE · ROIC) '싼 이유가 있는' 회사 — 품질 관문이 걸러 낸 함정."
      aside={<Tag tone="bad">가치 함정 경고</Tag>}>
      <div className="vm-chips">
        {rows.map((r) => (
          <span key={r.ticker} className="vm-chip vm-chip--trap" title={`알파 ${ppv(r.alpha)}`}>
            <TickerLink ticker={r.ticker} /> <span>{r.fails.join("·")} 탈락</span>
          </span>
        ))}
      </div>
    </Panel>
  );
}

// ── 대기 목록

function WatchTable({ rows, senior }: { rows: VmRow[]; senior: boolean }) {
  return (
    <Table head={<>
      <th>종목</th><th>업종</th><th className="r">현재가</th><th className="r">매수 기준가</th><th className="r">필요한 하락</th>
      {senior ? <>
        <th className="r">시장 가정 성장</th><th className="r">실제 성장</th><th className="r">성장 괴리</th><th>반증 조건</th>
      </> : <>
        <th className="r">3년 고점 대비</th><th className="r">ROIC</th><th className="r">FCF 수익률</th><th className="r">기대 알파</th>
      </>}
      <th>저자</th>
    </>}>
      {rows.map((r) => (
        <tr key={r.ticker}>
          <Who ticker={r.ticker} name={r.name} />
          <td className="small vm-ind">{r.industry}</td>
          <td className="r num">{money(r.price, r.ticker)}</td>
          <BuyCell r={r} ticker={r.ticker} />
          <td className="r num">{pct(r.drop, 0)}</td>
          {senior ? <>
            <td className="r num">{pct(r.implied_g)}</td>
            <td className="r num">{pct(r.g1)}</td>
            <td className={`r num ${tone(r.gap)}`}>{ppv(r.gap)}</td>
            <td className="small">{r.kill?.length ? <span className="down">{r.kill.join(" · ")}</span> : <span className="muted">없음</span>}</td>
          </> : <>
            <td className={`r num ${tone(r.dd_3y)}`}>{pct(r.dd_3y, 0)}</td>
            <td className="r num">{plain(r.roic)}</td>
            <td className="r num">{plain(r.fcf_y)}</td>
            <td className={`r num ${tone(r.alpha)}`}>{ppv(r.alpha)}</td>
          </>}
          <td>{r.author ? <Tag>저자도</Tag> : ""}</td>
        </tr>
      ))}
    </Table>
  );
}

function WatchPanel({ rows, senior }: { rows: VmRow[]; senior: boolean }) {
  const TOP = 15;
  return (
    <Panel
      title={senior ? `대기 목록 — 성장 괴리 큰 순 (${rows.length})` : `대기 목록 — 품질 5개 통과, 가격만 남음 (${rows.length})`}
      sub={senior
        ? "괴리 = 최근 4년 매출 성장(10%에서 자름) − 지금 주가가 가정하는 영구 성장. 클수록 '성장이 이어지면 싸다'. 반증 조건에 걸린 종목은 뒤로. 살 목록이 아니라 파 볼 목록."
        : "매수 기준가까지 내려오면 가격 관문도 통과한다. 필요한 하락이 작은 순 — 맨 위가 다음 후보."}>
      <WatchTable rows={rows.slice(0, TOP)} senior={senior} />
      {rows.length > TOP && (
        <details className="vm-details">
          <summary>나머지 {rows.length - TOP}종목</summary>
          <WatchTable rows={rows.slice(TOP)} senior={senior} />
        </details>
      )}
    </Panel>
  );
}

// ── 앞으로 기록

function TrackTable({ rows, lang }: { rows: VmTrack[]; lang: Lang }) {
  if (!rows.length) return <p className="muted small">아직 기록이 없다 — 밤 실행이 하루 돌면 여기부터 쌓인다.</p>;
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

function TrackPanel({ model, groups, lang, title }: { model: ValueModel; groups: VmGroup[]; lang: Lang; title: string }) {
  const rows = model.tracking.rows.filter((r) => groups.includes(r.group));
  return (
    <Panel title={title} sub={<>
      통과 묶음은 처음 통과한 날 종가, 상위 10 묶음은 매달 첫 실행에 다시 고른 날, 저자 종목은 기록에 처음 들어간 날
      ({model.tracking.start ? fmtDate(model.tracking.start, lang) : "—"}) 종가부터. 배당 포함, 같은 기간 SPY(캐나다는 XIU)와 비교.
      규칙은 시작일에 고정 — 성적을 보고 고치지 않는다.
    </>}>
      <div className="vm-sum">
        {groups.map((g) => {
          const s = model.tracking.summary[g];
          return (
            <div key={g} className="vm-sum__item">
              <span className={`vm-g vm-g--${g}`}>{GROUP_LABEL[g]}</span>
              {s && s.n > 0 ? <>
                <b className={`num ${tone(s.excess)}`}>{ppv(s.excess)}</b>
                <span>{s.n}건 · 평균 {pct(s.ret)} · 이김 {s.beat}/{s.n}{s.open != null && s.open !== s.n ? ` · 보유 ${s.open}` : ""}</span>
              </> : <span>아직 기록 없음</span>}
            </div>
          );
        })}
      </div>
      <TrackTable rows={rows} lang={lang} />
    </Panel>
  );
}

// ── 규칙 띠 (주니어 · 시니어 탭 맨 위)

function RuleStrip({ who, items, note }: { who: string; items: string[]; note: ReactNode }) {
  return (
    <div className="vm-rule">
      <b>{who}</b>
      <ol>{items.map((x) => <li key={x}>{x}</li>)}</ol>
      <p>{note}</p>
    </div>
  );
}

// ── 탭 본문

type ViewProps = { model: ValueModel; lang: Lang };

function splitRows(model: ValueModel) {
  const byT = new Map(model.rows.map((r) => [r.ticker, r]));
  const junior = model.rows.filter((r) => r.pass).sort((a, b) => (b.alpha ?? 0) - (a.alpha ?? 0));
  const senior = model.rows.filter((r) => r.pass_v2).sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0));
  const watchJ = model.rows.filter((r) => r.quality && !r.pass && r.drop != null).sort((a, b) => (b.drop ?? -9) - (a.drop ?? -9));
  const watchS = model.rows
    .filter((r) => r.quality && !r.pass_v2 && r.gap != null)
    .sort((a, b) => Number(!!a.kill?.length) - Number(!!b.kill?.length) || (b.gap ?? -9) - (a.gap ?? -9));
  const traps = model.rows.filter((r) => !r.quality && r.gates.price).sort((a, b) => (b.alpha ?? 0) - (a.alpha ?? 0));
  return { byT, junior, senior, watchJ, watchS, traps };
}

const NO_V2 = <div className="vm-panel"><p className="muted small">시니어(v2) 자료가 아직 없다 — 다음 밤 실행부터 주니어와 함께 계산된다.</p></div>;

export function AuthorView({ model, lang, retro }: ViewProps & { retro: ReactNode }) {
  const { byT, senior, junior, traps } = splitRows(model);
  const hero = senior.length ? senior : junior;
  return (
    <>
      <Picks rows={hero.slice(0, 1)} mode={senior.length ? "senior" : "junior"} lang={lang} model={model} />
      <CrossTable model={model} byT={byT} />
      <ResearchPanel model={model} byT={byT} lang={lang} />
      <div className="vm-two">
        <ThemePanel model={model} />
        <TrapPanel rows={traps} />
      </div>
      {retro}
      <ScreenTable model={model} byT={byT} lang={lang} />
    </>
  );
}

export function JuniorView({ model, lang }: ViewProps) {
  const { junior, watchJ, traps } = splitRows(model);
  const p = model.params;
  return (
    <>
      <RuleStrip who={`${JUNIOR} · v1`}
        items={[
          `품질 5개 — ROE 평균 ≥ ${plain(p.roe_min)} · CV ≤ ${p.cv_max} / ROIC ≥ ${plain(p.roic_min)} · WACC 초과 / Altman Z ≥ ${p.altman_min} / Beneish M ≤ ${p.beneish_max} / FCF 매년 플러스`,
          `가격 — 2단계 DCF 기대수익률 − 요구수익률 ≥ ${ppv(p.alpha_min)} (5년 뒤 성장 ${plain(p.term_g)})`,
          "우선순위 — 매수 기준가까지 필요한 하락이 작은 순",
        ]}
        note="저자 체크리스트를 그대로 옮긴 규칙. 통과하면 그날 종가부터 계속 기록한다." />
      <Picks rows={junior} mode="junior" lang={lang} model={model} />
      <WatchPanel rows={watchJ} senior={false} />
      <TrapPanel rows={traps} />
      <TrackPanel model={model} groups={["ours", "v1_top", "author"]} lang={lang} title={`앞으로 기록 — ${JUNIOR} vs 저자 종목`} />
    </>
  );
}

export function SeniorView({ model, lang }: ViewProps) {
  if (!model.v2) return NO_V2;
  const { senior, watchS } = splitRows(model);
  return (
    <>
      <RuleStrip who={`${SENIOR} · v2`}
        items={[
          `${JUNIOR} 통과 + 하방 관문 — FCF 30% 감소 · 첫 5년 성장 0 이하에서도 알파 ≥ 0`,
          "우선순위 — 성장 괴리(실제 매출 성장 − 지금 주가가 가정하는 영구 성장) 큰 순",
          "반증 조건 — 품질 탈락 · 매출 감소 · 시장 가정 성장 > 실제 · 적정가 도달 중 하나면 기록 끝",
        ]}
        note="베타 민감(베타 하한 0.6 이면 탈락) · 업종 집중(상위 20 안 같은 업종 3개 이상)은 표시만." />
      <Picks rows={senior} mode="senior" lang={lang} model={model} />
      <ThemePanel model={model} />
      <WatchPanel rows={watchS} senior />
      <TrackPanel model={model} groups={["v2", "v2_top", "author"]} lang={lang} title={`앞으로 기록 — ${SENIOR} vs 저자 종목`} />
    </>
  );
}

export function CompareView({ model, lang }: ViewProps) {
  if (!model.v2) return NO_V2;
  const { byT, junior, senior } = splitRows(model);
  const v2 = model.v2;
  const p1 = junior.map((r) => r.ticker);
  const p2 = senior.map((r) => r.ticker);
  const t1 = v2.top.v1;
  const t2 = v2.top.v2;
  const both = t1.filter((t) => t2.includes(t));
  const n = Math.max(t1.length, t2.length);
  const tag = (t: string, other: string[]) =>
    other.includes(t) ? <span className="vm-mini">둘 다</span> : <span className="vm-mini vm-mini--only">여기만</span>;
  return (
    <>
      <div className="vm-two">
        <Panel title={`${JUNIOR} 통과 (${p1.length})`} sub="품질 5개 + 가격 관문.">
          <div className="vm-chips">
            {p1.length ? p1.map((t) => <span key={t} className="vm-chip"><TickerLink ticker={t} /> {tag(t, p2)}</span>) : <span className="muted small">없음</span>}
          </div>
        </Panel>
        <Panel title={`${SENIOR} 통과 (${p2.length})`} sub="주니어 통과 중 하방 관문까지 넘은 종목 — 시니어 ⊂ 주니어.">
          <div className="vm-chips">
            {p2.length ? p2.map((t) => (
              <span key={t} className="vm-chip"><TickerLink ticker={t} /> {tag(t, p1)}{byT.get(t)?.sensitive && <Tag tone="warn">베타 민감</Tag>}</span>
            )) : <span className="muted small">없음</span>}
          </div>
        </Panel>
      </div>
      <Panel title={`우선순위 상위 ${v2.params.top_n} — 겹침 ${both.length}`}
        sub="주니어 = 매수 기준가까지 필요한 하락이 작은 순 · 시니어 = 성장 괴리 큰 순(반증 조건 걸린 종목 제외). 두 묶음 모두 매달 첫 실행에 다시 골라 기록한다.">
        <Table head={<><th className="c">순위</th><th>{JUNIOR}</th><th className="r">필요한 하락</th><th>{SENIOR}</th><th className="r">성장 괴리</th></>}>
          {Array.from({ length: n }, (_, i) => {
            const a = t1[i];
            const b = t2[i];
            return (
              <tr key={i}>
                <td className="c num">{i + 1}</td>
                <td className="vm-who">{a ? <><TickerLink ticker={a} /> {tag(a, t2)}</> : ""}</td>
                <td className="r num">{a ? pct(byT.get(a)?.drop, 0) : ""}</td>
                <td className="vm-who">{b ? <><TickerLink ticker={b} /> {tag(b, t1)}</> : ""}</td>
                <td className={`r num ${tone(b ? byT.get(b)?.gap : null)}`}>{b ? ppv(byT.get(b)?.gap) : ""}</td>
              </tr>
            );
          })}
        </Table>
      </Panel>
      <TrackPanel model={model} groups={["ours", "v2", "v1_top", "v2_top", "author"]} lang={lang}
        title={`앞으로 기록 — ${JUNIOR} vs ${SENIOR} vs 저자`} />
    </>
  );
}
