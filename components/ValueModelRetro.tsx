import { Fragment } from "react";
import { GateMark, JUNIOR, SENIOR, ppv } from "./ValueModelViews";
import { TickerLink } from "./TickerLink";
import { fmtDate, money, pct, tone } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import type { RetroEvent, ValueModelRetro } from "@/lib/valueModel";

/**
 * 문서 기록 탭 — '그때로 돌아가면 우리도 뽑았을까?' (2026-11-12, 사용자 요청 리뷰).
 * 저자가 글을 올린 날의 재무 · 주가 · 베타 · 국채금리로 주니어(v1) · 시니어(v2)를 다시 돌린 고정 결과(content/valueModelRetro.json).
 * 위: 게시일마다 관문 결과 + 그 뒤 성과, 아래: 2025-09 ~ 2026-11 매달 1일 결과 격자(게시한 달 표시).
 */

const GATES = ["roe", "roic", "z", "m", "fcf", "price", "bear"] as const;
const GATE_LABEL: Record<(typeof GATES)[number], string> = {
  roe: "ROE", roic: "ROIC", z: "Z", m: "M", fcf: "FCF", price: "가격", bear: "하방",
};

const CELL: Record<string, { cls: string; label: string }> = {
  V: { cls: "vm-cell--v2", label: "시니어 통과" },
  P: { cls: "vm-cell--v1", label: "주니어만 통과" },
  q: { cls: "vm-cell--q", label: "품질만 통과" },
  $: { cls: "vm-cell--p", label: "가격만 통과" },
  ".": { cls: "vm-cell--x", label: "둘 다 탈락" },
  "-": { cls: "vm-cell--na", label: "재무 3년 미만" },
};

const GROUP_LABEL = { coverage: "저자 커버리지", research: "리서치 (커버리지 아님)", screen: "A-Series 스크린" } as const;

const isScreen = (e: RetroEvent) => e.kind.startsWith("A-Series");

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
          <h3>그때로 돌아가면 우리도 뽑았을까? — 저자 게시일 기준 회고</h3>
          <p>
            저자가 글을 올린 날까지 공개된 연간 재무(결산 + {retro.method.lag_us}일, 캐나다 {retro.method.lag_ca}일) · 그날 종가 ·
            그날까지 60개월 베타 · 그날 10년 국채로 {JUNIOR}(v1) · {SENIOR}(v2)를 다시 돌렸다. 성과는 게시일 → {fmtDate(retro.prices_to, lang)},
            배당 포함, SPY(캐나다는 XIU) 대비.
          </p>
        </div>
        <div className="vm-panel__aside"><span className="vm-tag vm-tag--plain">{fmtDate(retro.made, lang)} 한 번 계산</span></div>
      </div>

      <div className="vm-rstats">
        <Stat label="커버리지 · 리서치 글" big={`${covHit.length} / ${cov.length}`}
          sub={`주니어 통과 ${covHit.map((e) => e.ticker).join(" · ") || "없음"} · 시니어 ${cov.filter((e) => e.pass_v2).length}`} t={covHit.length ? "up" : undefined} />
        <Stat label="A-Series 스크린" big={`${scrHit.length} / ${scr.length}`} sub="저자 체크리스트 목록인데 우리는 0" />
        <Stat label="날짜 없는 커버리지" big={`${undatedHit.length} / ${undated.length}`}
          sub={`${undated.map((g) => g.ticker.replace(".TO", "")).join(" · ")} — 15개월 매달 확인`} />
        <Stat label="놓친 커버리지 · 리서치 그 뒤" big={ppv(mean(missedCov))} t={tone(mean(missedCov))}
          sub={`${missedCov.length}건 평균 지수 대비 · 중앙 ${ppv(median(missedCov))}`} />
        <Stat label="A-Series 그 뒤" big={ppv(mean(scrEx))} t={tone(mean(scrEx))}
          sub={`${scrEx.length}건 평균 · 중앙 ${ppv(median(scrEx))}`} />
      </div>

      <div className="table-wrap vm-tw">
        <table className="vm-t vm-t--retro">
          <thead>
            <tr>
              <th>종목</th><th>저자 게시</th><th className="r">그날 가격 / 매수 기준가</th>
              {GATES.map((g) => <th key={g} className="c">{GATE_LABEL[g]}</th>)}
              <th className="r">기대 알파</th><th className="c">주니어</th><th className="c">시니어</th><th className="r">그 뒤 지수 대비</th>
            </tr>
          </thead>
          <tbody>
            {ev.map((e, i) => (
              <Fragment key={`${e.ticker}-${e.date}`}>
                {(i === 0 || isScreen(e) !== isScreen(ev[i - 1])) && (
                  <tr className="vm-t__group"><td colSpan={cols + 1}><span className="vm-t__pin">{isScreen(e) ? "A-Series 스크린 (시황 글 목록)" : "커버리지 · 리서치 글"}</span></td></tr>
                )}
                <tr className={e.pass_v2 ? "vm-row--pass" : e.pass ? "vm-row--junior" : undefined}>
                  <td className="vm-who"><TickerLink ticker={e.ticker} /><span className="vm-who__name">{e.kind}</span></td>
                  <td className="num">{e.date}</td>
                  <td className="r num">
                    {money(e.price, e.ticker)} / <span className={e.buy != null && e.price != null && e.buy >= e.price ? "vm-buy--ok" : "vm-buy--no"}>{money(e.buy, e.ticker)}</span>
                  </td>
                  {GATES.map((g) => <td key={g} className="c"><GateMark g={e.gates[g]} /></td>)}
                  <td className={`r num ${tone(e.alpha)}`}>{ppv(e.alpha)}</td>
                  <td className="c">{e.pass ? <span className="vm-st vm-st--junior">뽑음</span> : <span className="vm-st vm-st--plain">안 뽑음</span>}</td>
                  <td className="c">{e.pass_v2 ? <span className="vm-st vm-st--pass">뽑음</span> : <span className="vm-st vm-st--plain">안 뽑음</span>}</td>
                  <td className={`r num ${tone(e.excess)}`} title={`${pct(e.ret)} vs ${e.bench.replace(".TO", "")} ${pct(e.bench_ret)}`}>{ppv(e.excess)}</td>
                </tr>
                <tr className="vm-t__note"><td colSpan={cols + 1}><span className="vm-t__pin">{e.note} <span className="muted">재무 {e.years}년치 · β {e.beta.toFixed(2)} · 국채 {pct(e.rf, 2, false)}</span></span></td></tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="vm-retro__h">매달 1일에 돌렸다면 — {monthLabel(retro.months[0])} ~ {monthLabel(retro.months[retro.months.length - 1])}</h4>
      <p className="vm-retro__p">
        저자 종목 {retro.grid.length}개를 매달 1일 기준으로 다시 계산했다. 테두리 = 저자가 그 종목 글을 올린 달.
        한 번이라도 주니어가 통과시킨 종목: {everHit.map((g) => `${g.ticker} ${(g.cells.match(/[VP]/g) ?? []).length}개월`).join(" · ") || "없음"}.
      </p>
      <div className="table-wrap vm-tw">
        <table className="vm-grid">
          <thead>
            <tr>
              <th>종목</th>
              {retro.months.map((m) => <th key={m} className="num">{monthLabel(m)}</th>)}
            </tr>
          </thead>
          <tbody>
            {retro.grid.map((g, i) => (
              <Fragment key={g.ticker}>
                {i === firstOf(g.group) && <tr className="vm-grid__group"><td colSpan={retro.months.length + 1}>{GROUP_LABEL[g.group]}</td></tr>}
                <tr>
                  <th scope="row"><TickerLink ticker={g.ticker} /></th>
                  {g.cells.split("").map((c, j) => {
                    const m = retro.months[j];
                    const posted = g.posted.includes(m.slice(0, 7));
                    const k = CELL[c] ?? CELL["."];
                    return (
                      <td key={m} className={`vm-cell ${k.cls}${posted ? " vm-cell--posted" : ""}`} title={`${m} · ${k.label}${posted ? " · 저자 게시" : ""}`}>
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
          <span key={c}><i className={`vm-cell ${CELL[c].cls}`}>{c === "V" ? "S" : c === "P" ? "J" : ""}</i>{CELL[c].label}</span>
        ))}
        <span><i className="vm-cell vm-cell--x vm-cell--posted" />저자 게시한 달</span>
      </div>

      <div className="vm-verdict">
        <h4>리뷰 — 주니어는 저자보다 훨씬 엄격하다</h4>
        <ul>
          <li>
            저자 게시일 기준 {ev.length}건 중 우리가 같이 뽑았을 종목은 <b>{[...new Set([...covHit, ...scrHit].map((e) => e.ticker))].join(" · ") || "없음"}</b> 하나.
            CGI 는 게시 시점 주니어 · 시니어 둘 다 통과했고 그 뒤 성과는 XIU 와 비슷했다.
          </li>
          <li>
            <b>가격 관문</b>이 가장 큰 차이 — 품질은 통과한 FDS · ACN · NVO · HSY · KMB 가 알파 5%p 에 못 미쳤다. 우리는 5년 뒤 성장을 2.5% 로
            두는데 저자는 국채금리(4~5%)로 둔다. 저자식으로 계산해도 FDS 4.7%p · ACN 1.9%p · NVO 2.0%p 라 여전히 미달.
          </li>
          <li>
            <b>변동계수</b> — 재무가 3~4년치라 한 해만 나빠도 CV 가 0.3을 넘는다(RHI · MRK · GILD · CLX). 변동계수 조건만 빼면{" "}
            {nocvExtra.map((e) => `${e.ticker}(${e.date.slice(5)})`).join(" · ") || "추가 없음"}가 더 통과.
          </li>
          <li>
            <b>체크리스트 밖 종목</b> — 특수상황 글(PPL · III)과 판단으로 고른 리서치(Fiserv · NICE · EFOR · IT · RCI · SJ)는 품질 관문에서
            떨어진다. 저자도 이 종목들은 체크리스트로 고른 게 아니다.
          </li>
          <li>
            놓친 종목 중 RHI · FDS · Fiserv · MRK 는 그 뒤 크게 올랐다. 다만 {ev.length}건 · 1년 남짓이고 2026-10 &lsquo;AI 공포주&rsquo; 반등이 몰린
            구간이라 &lsquo;규칙을 느슨하게&rsquo;의 근거로는 약하다 — 이 결과를 보고 고치면 과적합. 바꾼다면 v3 로 새로 시작해 같은 날부터 나란히 기록한다.
          </li>
        </ul>
        <p className="vm-retro__fine">
          한계: 재무는 지금 받은 yfinance 연간 4년치라 과거 시점엔 3년치만 쓰인 경우가 많고(그때 받았다면 4년치), 나중에 고친 숫자가 섞여 있다.
          시가총액은 지금 시총 × 주가 비율(자사주로 줄어든 주식 수는 무시). 표의 ROE ~ 하방은 그날 기준, 위 &lsquo;교차 검증&rsquo; 표는 오늘 기준.
        </p>
      </div>
    </section>
  );
}
