import { Fragment } from "react";
import { GateMark, JUNIOR, SENIOR, ppv } from "./ValueModelViews";
import { TickerLink } from "./TickerLink";
import { fmtDate, money, pct, tone } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import type { RetroEvent, ValueModelRetro } from "@/lib/valueModel";

/**
 * 문서 기록 탭 — '그때로 돌아가면 우리도 뽑았을까?' (2026-11-12, 사용자 요청 리뷰).
 * 리서치 노트가 나온 날의 재무 · 주가 · 베타 · 국채금리로 주니어(v1) · 시니어(v2)를 다시 돌린 고정 결과(content/valueModelRetro.json).
 * 위: 게시일마다 관문 결과 + 그 뒤 성과, 아래: 2025-09 ~ 2026-11 매달 1일 결과 격자(게시한 달 표시).
 */

const GATES = ["roe", "roic", "z", "m", "fcf", "price", "bear"] as const;
const CELL_CLS: Record<string, string> = {
  V: "vm-cell--v2", P: "vm-cell--v1", q: "vm-cell--q", $: "vm-cell--p", ".": "vm-cell--x", "-": "vm-cell--na",
};

const L = {
  ko: {
    gate: { roe: "ROE", roic: "ROIC", z: "Z", m: "M", fcf: "FCF", price: "가격", bear: "하방" } as Record<(typeof GATES)[number], string>,
    cell: { V: "시니어 통과", P: "주니어만 통과", q: "품질만 통과", $: "가격만 통과", ".": "둘 다 탈락", "-": "재무 3년 미만" } as Record<string, string>,
    group: { coverage: "리서치 커버리지", research: "리서치 노트 (커버리지 아님)", screen: "가치주 스크린" } as Record<string, string>,
    none: "없음",
    title: "그때로 돌아가면 우리도 뽑았을까? — 리서치 게시일 기준 회고",
    intro: (lagUs: number, lagCa: number, junior: string, senior: string, to: string) =>
      `리서치 노트가 나온 날까지 공개된 연간 재무(결산 + ${lagUs}일, 캐나다 ${lagCa}일) · 그날 종가 · 그날까지 60개월 베타 · 그날 10년 국채로 ${junior}(v1) · ${senior}(v2)를 다시 돌렸다. 성과는 게시일 → ${to}, 배당 포함, SPY(캐나다는 XIU) 대비.`,
    madeOnce: (d: string) => `${d} 한 번 계산`,
    sCovLabel: "커버리지 · 리서치 노트",
    sCovSub: (hits: string, v2: number) => `주니어 통과 ${hits} · 시니어 ${v2}`,
    sScrLabel: "가치주 스크린",
    sScrSub: "리서치 체크리스트 목록인데 우리는 0",
    sUndLabel: "날짜 없는 커버리지",
    sUndSub: (names: string) => `${names} — 15개월 매달 확인`,
    sMissLabel: "놓친 커버리지 · 리서치 그 뒤",
    sMissSub: (n: number, med: string) => `${n}건 평균 지수 대비 · 중앙 ${med}`,
    sAftLabel: "스크린 그 뒤",
    sAftSub: (n: number, med: string) => `${n}건 평균 · 중앙 ${med}`,
    thTicker: "종목", thPosted: "게시", thPrice: "그날 가격 / 매수 기준가", thAlpha: "기대 알파",
    thJunior: "주니어", thSenior: "시니어", thAfter: "그 뒤 지수 대비",
    grpScreen: "가치주 스크린 (시황 노트 목록)", grpCov: "커버리지 · 리서치 노트",
    picked: "뽑음", notPicked: "안 뽑음",
    noteMeta: (years: number, beta: string, rf: string) => `재무 ${years}년치 · β ${beta} · 국채 ${rf}`,
    monthsH: (a: string, b: string) => `매달 1일에 돌렸다면 — ${a} ~ ${b}`,
    monthsP: (n: number) => `리서치 종목 ${n}개를 매달 1일 기준으로 다시 계산했다. 테두리 = 그 종목 리서치 노트가 나온 달.`,
    everHit: (list: string) => `한 번이라도 주니어가 통과시킨 종목: ${list}.`,
    months: (n: number) => `${n}개월`,
    postedTip: " · 리서치 게시",
    postedLegend: "리서치 게시한 달",
    verdictH: "리뷰 — 주니어는 리서치보다 훨씬 엄격하다",
    verdict: (v: { n: number; hits: string; extra: string }) => (
      <>
        <ul>
          <li>
            리서치 게시일 기준 {v.n}건 중 우리가 같이 뽑았을 종목은 <b>{v.hits}</b> 하나.
            CGI 는 게시 시점 주니어 · 시니어 둘 다 통과했고 그 뒤 성과는 XIU 와 비슷했다.
          </li>
          <li>
            <b>가격 관문</b>이 가장 큰 차이 — 품질은 통과한 FDS · ACN · NVO · HSY · KMB 가 알파 5%p 에 못 미쳤다. 우리는 5년 뒤 성장을 2.5% 로
            두는데 리서치는 국채금리(4~5%)로 둔다. 리서치식으로 계산해도 FDS 4.7%p · ACN 1.9%p · NVO 2.0%p 라 여전히 미달.
          </li>
          <li>
            <b>변동계수</b> — 재무가 3~4년치라 한 해만 나빠도 CV 가 0.3을 넘는다(RHI · MRK · GILD · CLX). 변동계수 조건만 빼면{" "}
            {v.extra || "추가 없음"}가 더 통과.
          </li>
          <li>
            <b>체크리스트 밖 종목</b> — 특수상황 노트(PPL · III)과 판단으로 고른 리서치(Fiserv · NICE · EFOR · IT · RCI · SJ)는 품질 관문에서
            떨어진다. 리서치도 이 종목들은 체크리스트로 고른 게 아니다.
          </li>
          <li>
            놓친 종목 중 RHI · FDS · Fiserv · MRK 는 그 뒤 크게 올랐다. 다만 {v.n}건 · 1년 남짓이고 2026-10 &lsquo;AI 공포주&rsquo; 반등이 몰린
            구간이라 &lsquo;규칙을 느슨하게&rsquo;의 근거로는 약하다 — 이 결과를 보고 고치면 과적합. 바꾼다면 v3 로 새로 시작해 같은 날부터 나란히 기록한다.
          </li>
        </ul>
        <p className="vm-retro__fine">
          한계: 재무는 지금 받은 yfinance 연간 4년치라 과거 시점엔 3년치만 쓰인 경우가 많고(그때 받았다면 4년치), 나중에 고친 숫자가 섞여 있다.
          시가총액은 지금 시총 × 주가 비율(자사주로 줄어든 주식 수는 무시). 표의 ROE ~ 하방은 그날 기준, 위 &lsquo;교차 검증&rsquo; 표는 오늘 기준.
        </p>
      </>
    ),
  },
  en: {
    gate: { roe: "ROE", roic: "ROIC", z: "Z", m: "M", fcf: "FCF", price: "Price", bear: "Downside" } as Record<(typeof GATES)[number], string>,
    cell: { V: "Senior pass", P: "Junior-only pass", q: "Quality-only pass", $: "Price-only pass", ".": "Both fail", "-": "Under 3 yrs of financials" } as Record<string, string>,
    group: { coverage: "Research coverage", research: "Research notes (not coverage)", screen: "Value screens" } as Record<string, string>,
    none: "none",
    title: "Would we have picked them back then? — Retrospective at each research post date",
    intro: (lagUs: number, lagCa: number, junior: string, senior: string, to: string) =>
      `We re-ran ${junior} (v1) and ${senior} (v2) using the annual financials public as of each research note's date (fiscal year-end + ${lagUs} days; ${lagCa} days for Canada), that day's close, the 60-month beta up to that day, and that day's 10-year Treasury yield. Performance runs from the post date to ${to}, dividends included, versus SPY (XIU for Canada).`,
    madeOnce: (d: string) => `Computed once on ${d}`,
    sCovLabel: "Coverage · research notes",
    sCovSub: (hits: string, v2: number) => `Junior passed ${hits} · Senior ${v2}`,
    sScrLabel: "Value screens",
    sScrSub: "Research checklist lists, yet we pick 0",
    sUndLabel: "Undated coverage",
    sUndSub: (names: string) => `${names} — checked monthly for 15 months`,
    sMissLabel: "Missed coverage · research, afterward",
    sMissSub: (n: number, med: string) => `${n} cases, mean vs index · median ${med}`,
    sAftLabel: "Screens, afterward",
    sAftSub: (n: number, med: string) => `${n} cases mean · median ${med}`,
    thTicker: "Ticker", thPosted: "Posted", thPrice: "Price that day / buy-below price", thAlpha: "Expected alpha",
    thJunior: "Junior", thSenior: "Senior", thAfter: "Vs index since",
    grpScreen: "Value screens (market-note lists)", grpCov: "Coverage · research notes",
    picked: "Picked", notPicked: "Not picked",
    noteMeta: (years: number, beta: string, rf: string) => `${years} yrs of financials · β ${beta} · Treasury ${rf}`,
    monthsH: (a: string, b: string) => `If we had run it on the 1st of each month — ${a} ~ ${b}`,
    monthsP: (n: number) => `We recomputed ${n} research tickers as of the 1st of every month. Outline = the month that ticker's research note was posted.`,
    everHit: (list: string) => `Tickers Junior passed at least once: ${list}.`,
    months: (n: number) => `${n} mo`,
    postedTip: " · research posted",
    postedLegend: "Month research was posted",
    verdictH: "Review — Junior is far stricter than the research",
    verdict: (v: { n: number; hits: string; extra: string }) => (
      <>
        <ul>
          <li>
            Of {v.n} cases at the research post dates, the only one we would have picked too is <b>{v.hits}</b>.
            CGI passed both Junior and Senior at the time of posting, and its performance afterward was similar to XIU.
          </li>
          <li>
            The <b>price gate</b> is the biggest difference — FDS · ACN · NVO · HSY · KMB passed quality but fell short of 5%p alpha. We assume 2.5% growth
            five years out, while the research uses the Treasury yield (4–5%). Even computed the research way, FDS 4.7%p · ACN 1.9%p · NVO 2.0%p still fall short.
          </li>
          <li>
            <b>Coefficient of variation</b> — with only 3–4 years of financials, a single bad year pushes CV above 0.3 (RHI · MRK · GILD · CLX). Without the CV condition,{" "}
            {v.extra || "no additional names"} would also pass.
          </li>
          <li>
            <b>Names outside the checklist</b> — special-situation notes (PPL · III) and judgment-picked research (Fiserv · NICE · EFOR · IT · RCI · SJ) fail the quality gate.
            The research didn&rsquo;t pick these from a checklist either.
          </li>
          <li>
            Among the missed names, RHI · FDS · Fiserv · MRK rose sharply afterward. But with only {v.n} cases over a bit more than a year, and the 2026-10 &lsquo;AI-scare stocks&rsquo; rebound
            concentrated in that window, it is weak grounds for &lsquo;loosening the rules&rsquo; — changing them based on this result would be overfitting. If we change anything, we start fresh as v3 and record side by side from the same day.
          </li>
        </ul>
        <p className="vm-retro__fine">
          Limitations: financials are the 4 years of yfinance annual data fetched now, so past dates often used only 3 years (4 years had we fetched back then), and later-restated numbers are mixed in.
          Market cap is current market cap × price ratio (ignores share-count reductions from buybacks). The table&rsquo;s ROE to Downside columns are as of that day; the &lsquo;cross-check&rsquo; table above is as of today.
        </p>
      </>
    ),
  },
};

const isScreen = (e: RetroEvent) => e.kind.startsWith("스크린");

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function Stat({ label, big, sub, t }: { label: string; big: string; sub: string; t?: string }) {
  return (
    <div className="vm-rstat">
      <span>{label}</span>
      <b className={t}>{big}</b>
      <small>{sub}</small>
    </div>
  );
}

export function ValueModelRetro({ retro, lang }: { retro: ValueModelRetro; lang: Lang }) {
  const l = L[lang];
  const ev = retro.events;
  const cov = ev.filter((e) => !isScreen(e));
  const scr = ev.filter(isScreen);
  const hit = (xs: RetroEvent[]) => xs.filter((e) => e.pass);
  const covHit = hit(cov);
  const scrHit = hit(scr);
  const undated = retro.grid.filter((g) => g.group === "coverage" && g.posted.length === 0);
  const undatedHit = undated.filter((g) => /[VP]/.test(g.cells));
  const everHit = retro.grid.filter((g) => /[VP]/.test(g.cells));
  const exc = (xs: RetroEvent[]) => xs.map((e) => e.excess).filter((v): v is number => v != null);
  const missedCov = exc(cov.filter((e) => !e.pass));
  const scrEx = exc(scr);
  const nocvExtra = ev.filter((e) => e.pass_nocv && !e.pass);
  const monthLabel = (m: string) => `${m.slice(2, 4)}.${m.slice(5, 7)}`;
  const cols = 3 + GATES.length + 5;
  const firstOf = (g: string) => retro.grid.findIndex((x) => x.group === g);

  return (
    <section className="vm-panel vm-retro" id="vm-retro">
      <div className="vm-panel__head">
        <div>
          <h3>{l.title}</h3>
          <p>
            {l.intro(retro.method.lag_us, retro.method.lag_ca, lang === "en" ? "Junior Analyst" : JUNIOR, lang === "en" ? "Senior Analyst" : SENIOR, fmtDate(retro.prices_to, lang))}
          </p>
        </div>
        <div className="vm-panel__aside"><span className="vm-tag vm-tag--plain">{l.madeOnce(fmtDate(retro.made, lang))}</span></div>
      </div>

      <div className="vm-rstats">
        <Stat label={l.sCovLabel} big={`${covHit.length} / ${cov.length}`}
          sub={l.sCovSub(covHit.map((e) => e.ticker).join(" · ") || l.none, cov.filter((e) => e.pass_v2).length)} t={covHit.length ? "up" : undefined} />
        <Stat label={l.sScrLabel} big={`${scrHit.length} / ${scr.length}`} sub={l.sScrSub} />
        <Stat label={l.sUndLabel} big={`${undatedHit.length} / ${undated.length}`}
          sub={l.sUndSub(undated.map((g) => g.ticker.replace(".TO", "")).join(" · "))} />
        <Stat label={l.sMissLabel} big={ppv(mean(missedCov))} t={tone(mean(missedCov))}
          sub={l.sMissSub(missedCov.length, ppv(median(missedCov)))} />
        <Stat label={l.sAftLabel} big={ppv(mean(scrEx))} t={tone(mean(scrEx))}
          sub={l.sAftSub(scrEx.length, ppv(median(scrEx)))} />
      </div>

      <div className="table-wrap vm-tw">
        <table className="vm-t vm-t--retro">
          <thead>
            <tr>
              <th>{l.thTicker}</th><th>{l.thPosted}</th><th className="r">{l.thPrice}</th>
              {GATES.map((g) => <th key={g} className="c">{l.gate[g]}</th>)}
              <th className="r">{l.thAlpha}</th><th className="c">{l.thJunior}</th><th className="c">{l.thSenior}</th><th className="r">{l.thAfter}</th>
            </tr>
          </thead>
          <tbody>
            {ev.map((e, i) => (
              <Fragment key={`${e.ticker}-${e.date}`}>
                {(i === 0 || isScreen(e) !== isScreen(ev[i - 1])) && (
                  <tr className="vm-t__group"><td colSpan={cols + 1}><span className="vm-t__pin">{isScreen(e) ? l.grpScreen : l.grpCov}</span></td></tr>
                )}
                <tr className={e.pass_v2 ? "vm-row--pass" : e.pass ? "vm-row--junior" : undefined}>
                  <td className="vm-who"><TickerLink ticker={e.ticker} /><span className="vm-who__name">{e.kind}</span></td>
                  <td className="num">{e.date}</td>
                  <td className="r num">
                    {money(e.price, e.ticker)} / <span className={e.buy != null && e.price != null && e.buy >= e.price ? "vm-buy--ok" : "vm-buy--no"}>{money(e.buy, e.ticker)}</span>
                  </td>
                  {GATES.map((g) => <td key={g} className="c"><GateMark g={e.gates[g]} lang={lang} /></td>)}
                  <td className={`r num ${tone(e.alpha)}`}>{ppv(e.alpha)}</td>
                  <td className="c">{e.pass ? <span className="vm-st vm-st--junior">{l.picked}</span> : <span className="vm-st vm-st--plain">{l.notPicked}</span>}</td>
                  <td className="c">{e.pass_v2 ? <span className="vm-st vm-st--pass">{l.picked}</span> : <span className="vm-st vm-st--plain">{l.notPicked}</span>}</td>
                  <td className={`r num ${tone(e.excess)}`} title={`${pct(e.ret)} vs ${e.bench.replace(".TO", "")} ${pct(e.bench_ret)}`}>{ppv(e.excess)}</td>
                </tr>
                <tr className="vm-t__note"><td colSpan={cols + 1}><span className="vm-t__pin">{e.note} <span className="muted">{l.noteMeta(e.years, e.beta.toFixed(2), pct(e.rf, 2, false))}</span></span></td></tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="vm-retro__h">{l.monthsH(monthLabel(retro.months[0]), monthLabel(retro.months[retro.months.length - 1]))}</h4>
      <p className="vm-retro__p">
        {l.monthsP(retro.grid.length)}{" "}
        {l.everHit(everHit.map((g) => `${g.ticker} ${l.months((g.cells.match(/[VP]/g) ?? []).length)}`).join(" · ") || l.none)}
      </p>
      <div className="table-wrap vm-tw">
        <table className="vm-grid">
          <thead>
            <tr>
              <th>{l.thTicker}</th>
              {retro.months.map((m) => <th key={m} className="num">{monthLabel(m)}</th>)}
            </tr>
          </thead>
          <tbody>
            {retro.grid.map((g, i) => (
              <Fragment key={g.ticker}>
                {i === firstOf(g.group) && <tr className="vm-grid__group"><td colSpan={retro.months.length + 1}>{l.group[g.group]}</td></tr>}
                <tr>
                  <th scope="row"><TickerLink ticker={g.ticker} /></th>
                  {g.cells.split("").map((c, j) => {
                    const m = retro.months[j];
                    const posted = g.posted.includes(m.slice(0, 7));
                    const kc = CELL_CLS[c] ? c : ".";
                    const k = { cls: CELL_CLS[kc], label: l.cell[kc] };
                    return (
                      <td key={m} className={`vm-cell ${k.cls}${posted ? " vm-cell--posted" : ""}`} title={`${m} · ${k.label}${posted ? l.postedTip : ""}`}>
                        <span>{c === "V" ? "S" : c === "P" ? "J" : ""}</span>
                      </td>
                    );
                  })}
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="vm-legend">
        {(["V", "P", "q", "$", ".", "-"] as const).map((c) => (
          <span key={c}><i className={`vm-cell ${CELL_CLS[c]}`}>{c === "V" ? "S" : c === "P" ? "J" : ""}</i>{l.cell[c]}</span>
        ))}
        <span><i className="vm-cell vm-cell--x vm-cell--posted" />{l.postedLegend}</span>
      </div>

      <div className="vm-verdict">
        <h4>{l.verdictH}</h4>
        {l.verdict({ n: ev.length, hits: [...new Set([...covHit, ...scrHit].map((e) => e.ticker))].join(" · ") || l.none, extra: nocvExtra.map((e) => `${e.ticker}(${e.date.slice(5)})`).join(" · ") })}
      </div>
    </section>
  );
}
