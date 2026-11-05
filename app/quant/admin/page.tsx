import type { Metadata } from "next";
import { AdminTabs, LockIcon } from "@/components/AdminTabs";
import { ago, HM, makeClock, ms, when, YMD, type Clock } from "@/lib/adminTime";
import { getDashboardCore } from "@/lib/dashboard";
import { getEtf } from "@/lib/etf";
import { getApiAccess, getBranchDate, getRuns, getSteps, type ApiAccess, type RunLite, type StepLite } from "@/lib/github";
import { getMacro } from "@/lib/macro";
import { DATA_SOURCES, INDICATOR_ROWS, PIPELINES, type DataSource, type Pipeline } from "@/lib/pipelines";
import { nextOccurrence, occurrences, prevOccurrence, torontoMidnight } from "@/lib/schedule";
import { getMarketSummary } from "@/lib/universeServer";

/**
 * 관리 · 파이프라인 (2026-11-04) — Project_1 자동 작업이 언제 돌았고 무엇을 하는지. 비밀번호(proxy.ts, 내계좌와 같은 것),
 * 공개 메뉴에는 없고 내계좌 화면 제목 옆 링크로만 들어온다. 본인만 보는 화면이라 한국어만.
 * 실행 기록 = GitHub API (lib/github.ts, 5분 캐시) · 데이터 시각 = 사이트가 읽는 파일의 generated_at.
 */

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "관리", robots: { index: false, follow: false } };

function dur(m: number): string {
  if (m < 60_000) return `${Math.max(1, Math.round(m / 1000))}초`;
  const min = Math.round(m / 60_000);
  const h = Math.floor(min / 60);
  const r = min % 60;
  return h ? (r ? `${h}시간 ${r}분` : `${h}시간`) : `${min}분`;
}

/** 최근 실행 칩용 짧은 시간 — '36초' · '14분' · '5:20'(시:분). */
function hmm(m: number): string {
  if (m < 60_000) return `${Math.max(1, Math.round(m / 1000))}초`;
  const min = Math.round(m / 60_000);
  return min < 60 ? `${min}분` : `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
}


const runEnd = (r: RunLite, now: number) => (r.status === "completed" ? ms(r.updated) : now);
const runDur = (r: RunLite, now: number) => Math.max(0, runEnd(r, now) - ms(r.started));
const isBad = (r: RunLite) => r.status === "completed" && ["failure", "cancelled", "timed_out", "startup_failure"].includes(r.conclusion ?? "");

type Tone = "ok" | "bad" | "warn" | "wait";

function runState(r: RunLite, p: Pipeline, now: number): { label: string; tone: Tone } {
  if (r.status !== "completed") return r.status === "in_progress" ? { label: "진행 중", tone: "wait" } : { label: "대기 중", tone: "wait" };
  switch (r.conclusion) {
    case "success":
      return { label: "성공", tone: "ok" };
    case "failure":
    case "startup_failure":
      return { label: "실패", tone: "bad" };
    case "timed_out":
      return { label: "시간 초과", tone: "bad" };
    case "cancelled":
      // 시간 한도에 걸리면 GitHub 가 '취소'로 끝낸다
      return runDur(r, now) >= (p.limitMin - 1) * 60_000 ? { label: "시간 한도로 멈춤", tone: "bad" } : { label: "취소됨", tone: "warn" };
    case "skipped":
      return { label: "건너뜀", tone: "wait" };
    default:
      return { label: r.conclusion ?? "?", tone: "warn" };
  }
}

function eventLabel(r: RunLite, p: Pipeline): string {
  if (r.event === "schedule") return "예약";
  if (r.event === "workflow_dispatch") return p.dispatchLabel;
  if (r.event === "push") return "푸시";
  return r.event;
}

/** GitHub 단계 이름 → 이 화면의 단계 이름 (못 찾으면 null = 나머지). */
function stepLabel(p: Pipeline, ghName: string): string | null {
  return p.steps.find((s) => s.gh.includes(ghName))?.label ?? null;
}

function stepMs(s: StepLite): number {
  return s.started && s.completed ? Math.max(0, ms(s.completed) - ms(s.started)) : 0;
}

type CardData = {
  p: Pipeline;
  runs: RunLite[] | null;
  error: string | null;
  latest: RunLite | null;
  latestDone: RunLite | null;
  /** 진행 중이거나 실패한 마지막 실행의 단계 — 지금 단계 · 실패한 단계 */
  latestSteps: StepLite[] | null;
  /** 마지막 성공 실행 + 그 단계 — 어디에 시간이 드나 */
  timingRun: RunLite | null;
  timingSteps: StepLite[] | null;
  /** 마지막 실행은 성공인데 24시간 안에 실패가 있었으면 (복구됨) */
  recentFail: RunLite | null;
  next: number | null;
  /** 예약 시각은 지났는데 GitHub 가 아직 안 띄운 예약 (밤 작업은 몇 시간씩 늦다) — 그 예약 시각 */
  pending: number | null;
  /** 최근 예약 실행이 예약보다 평균 얼마나 늦게 시작했나 (ms) */
  delay: { avg: number; n: number } | null;
  fetchedAt: string | null;
};

async function loadCard(p: Pipeline, now: number): Promise<CardData> {
  const base: CardData = {
    p, runs: null, error: null, latest: null, latestDone: null, latestSteps: null, timingRun: null, timingSteps: null,
    recentFail: null, next: nextOccurrence(p.crons, now), pending: null, delay: null, fetchedAt: null,
  };
  let runs: RunLite[];
  try {
    const r = await getRuns(p.file, p.runs);
    runs = r.runs;
    base.fetchedAt = r.fetchedAt;
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : String(err) };
  }
  const latest = runs[0] ?? null;
  const latestDone = runs.find((r) => r.status === "completed") ?? null;
  const timingRun = p.timing ? (runs.find((r) => r.status === "completed" && r.conclusion === "success") ?? null) : null;
  const recentFail =
    latest && latest.status === "completed" && latest.conclusion === "success"
      ? (runs.find((r) => isBad(r) && now - ms(r.started) < 24 * 3600_000) ?? null)
      : null;

  const needLatest = latest && (latest.status !== "completed" || isBad(latest));
  const [latestSteps, timingSteps] = await Promise.all([
    needLatest ? getSteps(latest).catch(() => null) : Promise.resolve(null),
    timingRun ? getSteps(timingRun).catch(() => null) : Promise.resolve(null),
  ]);

  let delay: CardData["delay"] = null;
  if (p.showDelay) {
    const lags = runs
      .filter((r) => r.event === "schedule")
      .slice(0, 6)
      .map((r) => {
        const planned = prevOccurrence(p.crons, ms(r.created));
        return planned == null ? null : ms(r.started) - planned;
      })
      .filter((v): v is number => v != null && v >= 0 && v < 20 * 3600_000);
    if (lags.length) delay = { avg: lags.reduce((a, b) => a + b, 0) / lags.length, n: lags.length };
  }

  // 마지막 예약 시각 뒤로 예약 실행이 아직 없으면 '대기' (20시간 넘게 안 뜨면 GitHub 가 건너뛴 것으로 보고 접는다).
  // 장중 30분마다 도는 작업은 이 Mac 이 바로 띄워서 따지지 않는다
  let pending: number | null = null;
  if (!p.tick) {
    const planned = prevOccurrence(p.crons, now);
    const launched = planned != null && runs.some((r) => r.event === "schedule" && ms(r.created) >= planned - 60_000);
    if (planned != null && !launched && now - planned < 20 * 3600_000) pending = planned;
  }
  return { ...base, runs, latest, latestDone, latestSteps, timingRun, timingSteps, recentFail, delay, pending };
}

type DataRow = { s: DataSource; at: string | null; error: boolean };

async function loadData(): Promise<DataRow[]> {
  const [core, etf, macro, market] = await Promise.all([
    getDashboardCore(), getEtf().catch(() => null), getMacro().catch(() => null), getMarketSummary(),
  ]);
  return Promise.all(
    DATA_SOURCES.map(async (s): Promise<DataRow> => {
      const f = s.from;
      if (f.kind === "branch") {
        try {
          return { s, at: await getBranchDate(f.branch), error: false };
        } catch {
          return { s, at: null, error: true };
        }
      }
      const at = { dashboard: core?.generated_at, etf: etf?.generated_at, macro: macro?.generated_at, market: market?.generated_at }[f.kind];
      return { s, at: at ?? null, error: !at };
    }),
  );
}


const BADGE: Record<Tone, string> = { ok: "badge--good", bad: "badge--bad", warn: "badge--warn", wait: "badge--mid" };

function accessText(a: ApiAccess): { v: string; s: string; tone: Tone } {
  const left = a.remaining != null && a.limit != null ? `남은 ${a.remaining.toLocaleString()} / ${a.limit.toLocaleString()}번` : "";
  switch (a.mode) {
    case "token":
      return { v: "토큰 사용 중", s: `한 시간 5,000번 한도 · ${left}`, tone: "ok" };
    case "none":
      return { v: "토큰 없음", s: `Vercel 에 GITHUB_TOKEN 이 없어요 · IP 하나에 한 시간 60번 · ${left}`, tone: "warn" };
    case "bad":
      return { v: "토큰 오류", s: `GITHUB_TOKEN 이 틀렸거나 만료됐어요 — 토큰 없이 읽는 중 · ${left}`, tone: "bad" };
    default:
      return { v: "GitHub 연결 안 됨", s: "GitHub 에 물어보지 못했어요", tone: "bad" };
  }
}

export default async function AdminPage() {
  const now = Date.now();
  const clock = makeClock(now);
  const today = clock.today;
  const [cards, data, access] = await Promise.all([
    Promise.all(PIPELINES.map((p) => loadCard(p, now))),
    loadData(),
    getApiAccess(),
  ]);

  // ── 요약 ──
  const counts = { ok: 0, bad: 0, wait: 0, none: 0 };
  const warnings: { tone: Tone; text: string }[] = [];
  for (const c of cards) {
    if (c.error) {
      counts.none++;
      warnings.push({ tone: "bad", text: `${c.p.name} 실행 기록을 못 받았어요 (${c.error})` });
      continue;
    }
    if (!c.latest) {
      counts.none++; // 첫 예약 전 — 주의는 아니다
      continue;
    }
    const st = runState(c.latest, c.p, now);
    if (st.tone === "ok") counts.ok++;
    else if (st.tone === "wait") counts.wait++;
    else counts.bad++;
    if (st.tone === "bad" || st.tone === "warn") {
      const failed = c.latestSteps?.find((s) => s.conclusion === "failure");
      const where = failed ? ` · ${stepLabel(c.p, failed.name) ?? failed.name} 단계` : "";
      warnings.push({ tone: st.tone, text: `${c.p.name} 마지막 실행 ${st.label}${where}` });
    }
    if (c.latestDone && c.latestDone.conclusion === "success") {
      const used = runDur(c.latestDone, now) / (c.p.limitMin * 60_000);
      if (used >= 0.8) {
        warnings.push({ tone: "warn", text: `${c.p.name} 시간 한도 ${Math.round(used * 100)}% (${dur(runDur(c.latestDone, now))} / ${dur(c.p.limitMin * 60_000)})` });
      }
    }
  }
  for (const d of data) {
    if (d.at && d.s.staleH != null && now - ms(d.at) > d.s.staleH * 3600_000) {
      warnings.push({ tone: "warn", text: `${d.s.label} 마지막 갱신 ${ago(ms(d.at), now)}` });
    }
  }
  if (access.mode !== "token") warnings.push({ tone: access.mode === "none" ? "warn" : "bad", text: accessText(access).v });

  // 아직 안 뜬 예약은 '예약 + 보통 늦는 시간'을 예상 시작으로 줄에 세운다
  const upcoming = cards
    .flatMap((c) => {
      if (c.pending != null) {
        const at = Math.max(now, c.pending + (c.delay?.avg ?? 0));
        return [{ name: c.p.name, at, text: `${c.p.name} 대기 · 예상 ${HM.format(at)}쯤` }];
      }
      return c.next != null ? [{ name: c.p.name, at: c.next, text: `${when(c.next, clock)} ${c.p.name}` }] : [];
    })
    .sort((a, b) => a.at - b.at);
  const acc = accessText(access);
  const fetched = cards.map((c) => c.fetchedAt).filter((v): v is string => !!v).sort()[0] ?? null;

  // ── 오늘 하루 ──
  const dayStart = torontoMidnight(today);
  const dayEnd = torontoMidnight(clock.tomorrow);
  const dayLen = dayEnd - dayStart;
  const pos = (t: number) => `${(((Math.min(Math.max(t, dayStart), dayEnd) - dayStart) / dayLen) * 100).toFixed(2)}%`;
  const nowPos = pos(now);

  const daily = cards.filter((c) => c.p.group === "daily");
  const monthly = cards.filter((c) => c.p.group === "monthly");

  return (
    <main className="container container--wide page adm">
      <AdminTabs current="pipeline" />
      <div className="page-title adm-title">
        <div>
          <h1>관리 · 파이프라인</h1>
          <p>
            자동으로 도는 작업이 언제 돌았고 무엇을 하는지 · 시간은 모두 토론토(ET) · 실행 기록은 5분마다 새로 받아요
            {fetched && ` (받은 시각 ${HM.format(ms(fetched))})`}
          </p>
        </div>
        <span className="adm-lock"><LockIcon />관리자만 · 내계좌 비밀번호</span>
      </div>

      <div className="adm-tiles">
        <div className="card adm-tile">
          <div className="adm-tile__k">마지막 실행</div>
          <div className="adm-tile__v">
            성공 {counts.ok} · 실패 {counts.bad}
            {counts.wait > 0 && ` · 진행 ${counts.wait}`}
            {counts.none > 0 && ` · 첫 실행 전 ${counts.none}`}
          </div>
          <div className="adm-tile__s">GitHub 작업 {cards.length}개 기준</div>
        </div>
        <div className={`card adm-tile${warnings.length ? " adm-tile--warn" : ""}`}>
          <div className="adm-tile__k">주의</div>
          <div className="adm-tile__v">{warnings.length ? `${warnings.length}개` : "없음"}</div>
          {warnings.length > 0 && (
            <ul className="adm-tile__list">
              {warnings.map((w) => <li key={w.text}>{w.text}</li>)}
            </ul>
          )}
        </div>
        <div className={`card adm-tile${acc.tone === "ok" ? "" : acc.tone === "bad" ? " adm-tile--bad" : " adm-tile--warn"}`}>
          <div className="adm-tile__k">GitHub 연결</div>
          <div className="adm-tile__v">{acc.v}</div>
          <div className="adm-tile__s">{acc.s}</div>
        </div>
        <div className="card adm-tile">
          <div className="adm-tile__k">다음 실행</div>
          <div className="adm-tile__v">{upcoming[0]?.text ?? "—"}</div>
          <div className="adm-tile__s">
            {upcoming.slice(1, 4).map((u) => u.text).join(" · ")}
          </div>
        </div>
      </div>

      <div className="adm-sec">
        <h2>오늘 하루</h2>
        <span>{Number(today.slice(5, 7))}월 {Number(today.slice(8))}일 0시~24시 · 매달 도는 작업은 아래에</span>
      </div>
      <section className="card adm-tl" aria-label="오늘 실행 시간표">
        <div className="adm-tl__row">
          <div />
          <div className="adm-hours num" aria-hidden="true">
            {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
              <span key={h} style={{ left: `${(h / 24) * 100}%` }} data-edge={h === 0 ? "l" : h === 24 ? "r" : undefined}
                data-minor={h % 6 ? "" : undefined}>{h}시</span>
            ))}
          </div>
        </div>
        {daily.filter((c) => c.p.timeline).map((c) => {
          const todays = (c.runs ?? []).filter((r) => ms(r.started) < dayEnd && runEnd(r, now) >= dayStart);
          const planned = occurrences(c.p.crons, dayStart, dayEnd);
          return (
            <div className="adm-tl__row" key={c.p.file}>
              <div className="adm-tl__name">{c.p.name}<small>{c.p.tick ? "장중 30분마다" : "매일 밤"}</small></div>
              <div className="adm-track">
                {!c.p.tick && planned.map((t) => (
                  <div key={t} className="adm-sched" style={{ left: pos(t) }}><span>예약 {HM.format(t)}</span></div>
                ))}
                {c.p.tick && planned.filter((t) => t > now).map((t) => (
                  <div key={`p${t}`} className="adm-tick adm-tick--plan" style={{ left: pos(t) }} />
                ))}
                {todays.map((r) => {
                  const st = runState(r, c.p, now);
                  const manual = r.event !== "schedule" && c.p.dispatchLabel === "수동";
                  const cls = st.tone === "bad" ? " adm-bar--fail" : st.tone === "wait" ? " adm-bar--live" : manual ? " adm-bar--manual" : "";
                  const title = `#${r.number} · ${eventLabel(r, c.p)} · ${HM.format(ms(r.started))}–${r.status === "completed" ? HM.format(ms(r.updated)) : "지금"} · ${st.label}`;
                  if (c.p.tick) {
                    return <div key={r.id} className={`adm-tick${st.tone === "bad" ? " adm-tick--fail" : ""}`} style={{ left: pos(ms(r.started)) }} title={title} />;
                  }
                  const left = Math.max(ms(r.started), dayStart);
                  const width = Math.max(((Math.min(runEnd(r, now), dayEnd) - left) / dayLen) * 100, 0.8);
                  const text = st.tone === "bad" ? `#${r.number} ${st.label}` : manual ? `#${r.number} 수동` : `${HM.format(ms(r.started))}–${r.status === "completed" ? HM.format(ms(r.updated)) : "지금"} · ${dur(runDur(r, now))}`;
                  return (
                    <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className={`adm-bar${cls}`}
                      style={{ left: pos(left), width: `${width.toFixed(2)}%` }} title={title}>
                      {width > 7 ? text : ""}
                    </a>
                  );
                })}
                <div className="adm-now" style={{ left: nowPos }} />
              </div>
            </div>
          );
        })}
        <div className="adm-tl__row adm-tl__row--now">
          <div />
          <div className="adm-nowlab num"><span style={{ left: nowPos }}>지금 {HM.format(now)}</span></div>
        </div>
        <div className="adm-legend">
          <span><i className="adm-lg adm-lg--done" />돌았음</span>
          <span><i className="adm-lg adm-lg--live" />진행 중</span>
          <span><i className="adm-lg adm-lg--plan" />예정</span>
          <span><i className="adm-lg adm-lg--manual" />수동 실행</span>
          <span><i className="adm-lg adm-lg--fail" />실패</span>
          <span><i className="adm-lg adm-lg--sched" />예약 시각</span>
        </div>
        {daily.some((c) => c.delay) && (
          <p className="adm-note adm-note--plain">
            밤 작업은 GitHub 가 예약 시각보다 몇 시간 늦게 띄워요 —{" "}
            {daily.filter((c) => c.delay).map((c) => `${c.p.name} 평균 ${dur(c.delay!.avg)} 늦게 (최근 예약 ${c.delay!.n}번)`).join(" · ")}.
          </p>
        )}
      </section>

      <div className="adm-sec"><h2>매일 · 장중</h2><span>GitHub 에서 돌아요</span></div>
      {daily.map((c) => <PipelineCard key={c.p.file} c={c} clock={clock} />)}

      <div className="adm-sec"><h2>매달</h2><span>GitHub 에서 · 밤 작업과 안 겹치게 낮에 돌아요</span></div>
      <div className="adm-grid3">
        {monthly.map((c) => <PipelineCard key={c.p.file} c={c} clock={clock} compact />)}
      </div>

      <p className="adm-note adm-note--plain">
        이 Mac 에서 도는 작업(Shadow Track · Account Watch 신호기)은 사이트가 볼 수 없어서 아직 여기 안 나와요.
      </p>

      <div className="adm-sec"><h2>결과 데이터</h2><span>사이트가 읽는 파일이 마지막으로 바뀐 때</span></div>
      <section className="card adm-tblcard">
        <div className="table-wrap">
          <table className="data-table adm-tbl">
            <thead>
              <tr><th scope="col">데이터</th><th scope="col">만드는 작업</th><th scope="col">마지막으로 바뀐 때</th><th scope="col">쓰는 곳</th></tr>
            </thead>
            <tbody>
              {data.map((d) => {
                const stale = d.at && d.s.staleH != null && now - ms(d.at) > d.s.staleH * 3600_000;
                return (
                  <tr key={d.s.key}>
                    <td className="num adm-strong">{d.s.label}</td>
                    <td>{d.s.by}</td>
                    <td className={`num${stale ? " adm-old" : ""}`}>
                      {d.at ? <>{when(ms(d.at), clock)} <span className="muted">· {ago(ms(d.at), now)}</span></> : d.error ? "못 읽음" : "—"}
                    </td>
                    <td>{d.s.use}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="adm-sec"><h2>지표별 계산 위치</h2><span>같은 지표를 두 작업이 각자 계산해요 · 계산 코드는 같아요 (11-04 코드 기준)</span></div>
      <section className="card adm-tblcard">
        <div className="table-wrap">
          <table className="data-table adm-tbl">
            <thead>
              <tr><th scope="col">지표</th><th scope="col">Run Screener</th><th scope="col">Universe Scan</th><th scope="col">가격 기준</th><th scope="col">매매에 쓰나</th></tr>
            </thead>
            <tbody>
              {INDICATOR_ROWS.map((r) => (
                <tr key={r.name}>
                  <td className="adm-strong">{r.name}</td>
                  <td>{r.screener}</td>
                  <td>{r.universe}</td>
                  <td>{r.price}</td>
                  <td>{r.trade ? <><span className="adm-use">씀</span>{r.trade}</> : <span className="muted">안 씀 · 보여 주기만</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="adm-note adm-note--plain">
          점수는 비교하는 종목 묶음이 달라서 두 작업 값이 조금 달라요. 패턴 · ISB · SQZ 는 종목 자기 가격만 보니까 같은 날이면 똑같아요.
          배당 조정 = 과거 가격에서 받은 배당만큼 뺀 값 (수익률 계산용), 차트 가격 = TradingView 기본 차트처럼 분할만 반영한 실제 거래 가격.
        </p>
      </section>
    </main>
  );
}

function PipelineCard({ c, clock, compact = false }: { c: CardData; clock: Clock; compact?: boolean }) {
  const { p, latest, latestDone, now } = { ...c, now: clock.now };
  const st = latest ? runState(latest, p, now) : null;
  const failedStep = c.latestSteps?.find((s) => s.conclusion === "failure") ?? null;
  const liveStep = latest && latest.status !== "completed" ? (c.latestSteps?.find((s) => s.status === "in_progress") ?? null) : null;

  // 단계별 시간 (마지막 성공 실행)
  const stepMin = new Map<string, number>();
  let other = 0;
  for (const s of c.timingSteps ?? []) {
    const label = stepLabel(p, s.name);
    if (label) stepMin.set(label, (stepMin.get(label) ?? 0) + stepMs(s));
    else other += stepMs(s);
  }
  const timingTotal = c.timingRun ? runDur(c.timingRun, now) : 0;
  const limit = p.limitMin * 60_000;
  const segs = [...stepMin.entries()].filter(([, v]) => v / limit >= 0.02).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const segSum = segs.reduce((a, [, v]) => a + v, 0);
  const rest = Math.max(0, timingTotal - segSum);
  const todays = (c.runs ?? []).filter((r) => YMD.format(ms(r.started)) === clock.today);

  return (
    <section className={`card adm-card${compact ? " adm-card--compact" : ""}`} aria-labelledby={`adm-${p.file}`}>
      <div className="adm-card__h">
        <h3 id={`adm-${p.file}`}>{p.name}</h3>
        {st ? <span className={`badge ${BADGE[st.tone]}`}>{compact ? st.label : `마지막 실행 ${st.label}`}</span>
          : c.error ? <span className="badge badge--bad">기록 못 받음</span>
          : <span className="badge badge--mid">첫 실행 전</span>}
        {c.recentFail && <span className="badge badge--bad">#{c.recentFail.number} {runState(c.recentFail, p, now).label} → 복구</span>}
        {latestDone && latestDone.conclusion === "success" && runDur(latestDone, now) / limit >= 0.8 && (
          <span className="badge badge--warn">한도 {Math.round((runDur(latestDone, now) / limit) * 100)}%</span>
        )}
        <span className="adm-where">{p.where}</span>
        <span className={`adm-where${p.impactStrong ? " adm-where--strong" : ""}`}>{p.impact}</span>
      </div>
      <p className="adm-lead">{p.lead}</p>

      {c.error && <p className="adm-note adm-note--bad">GitHub 에서 실행 기록을 못 받았어요 — {c.error}</p>}

      <dl className="adm-facts">
        <div><dt>{p.tick ? "일정" : "예약"}</dt><dd>{p.scheduleText}</dd></div>
        <div>
          <dt>마지막 실행</dt>
          <dd className="num">
            {latest ? (
              <>
                {when(ms(latest.started), clock)}
                {latest.status === "completed" && !p.tick && ` → ${HM.format(ms(latest.updated))}`}
                <small><a href={latest.url} target="_blank" rel="noreferrer">#{latest.number}</a> · {eventLabel(latest, p)}{latest.attempt > 1 ? ` · ${latest.attempt}번째 시도` : ""}</small>
              </>
            ) : "아직 없음"}
          </dd>
        </div>
        <div>
          <dt>걸린 시간</dt>
          <dd>
            {latest ? dur(runDur(latest, now)) : "—"}
            <small>{latest && latest.status !== "completed" ? "지금까지 · " : ""}한도 {dur(limit)}</small>
          </dd>
        </div>
        {p.tick && <div><dt>오늘</dt><dd>{todays.length}번</dd></div>}
        <div>
          <dt>다음 예약</dt>
          {c.pending != null ? (
            <dd className="num">
              {when(c.pending, clock)} 예약 · 대기
              <small>
                GitHub 가 아직 안 띄웠어요
                {c.delay && ` · 보통 ${dur(c.delay.avg)} 늦게 → ${HM.format(c.pending + c.delay.avg)}쯤`}
              </small>
            </dd>
          ) : (
            <dd className="num">
              {c.next ? when(c.next, clock) : "—"}
              {c.delay && <small>보통 {dur(c.delay.avg)} 늦게 시작</small>}
            </dd>
          )}
        </div>
      </dl>

      {liveStep && <p className="adm-note adm-note--plain">지금 &lsquo;{stepLabel(p, liveStep.name) ?? liveStep.name}&rsquo; 단계 ({liveStep.name})</p>}
      {failedStep && latest && isBad(latest) && (
        <p className="adm-note adm-note--bad">
          #{latest.number} 이 &lsquo;{stepLabel(p, failedStep.name) ?? failedStep.name}&rsquo; 단계에서 멈췄어요 ({failedStep.name}) ·{" "}
          <a href={latest.url} target="_blank" rel="noreferrer">GitHub 에서 로그 보기</a>
        </p>
      )}
      {c.recentFail && (
        <p className="adm-note adm-note--plain">
          {when(ms(c.recentFail.started), clock)} #{c.recentFail.number} 은 {runState(c.recentFail, p, now).label} — 그 뒤 #{latest?.number} 이 성공했어요 ·{" "}
          <a href={c.recentFail.url} target="_blank" rel="noreferrer">실패 로그</a>
        </p>
      )}

      {c.timingRun && timingTotal > 0 && (
        <div className="adm-budget">
          <div className="adm-budget__h">
            <span>어디에 시간이 드나 (#{c.timingRun.number})</span>
            <span><b>{dur(timingTotal)}</b> / {dur(limit)} 한도</span>
          </div>
          <div className="adm-budget__bar" role="img"
            aria-label={`${dur(limit)} 중 ${segs.map(([k, v]) => `${k} ${dur(v)}`).join(", ")}, 나머지 ${dur(rest)}`}>
            {segs.map(([k, v], i) => <div key={k} className={`adm-seg adm-seg--${i + 1}`} style={{ width: `${((v / limit) * 100).toFixed(1)}%` }} />)}
            {rest > 0 && <div className="adm-seg adm-seg--rest" style={{ width: `${((rest / limit) * 100).toFixed(1)}%` }} />}
          </div>
          <div className="adm-budget__legend">
            {segs.map(([k, v], i) => <span key={k}><i className={`adm-seg--${i + 1}`} />{k} {dur(v)}</span>)}
            {rest > 0 && <span><i className="adm-seg--rest" />나머지 {dur(rest)}</span>}
            <span><i className="adm-seg--free" />남은 여유 {dur(Math.max(0, limit - timingTotal))}</span>
          </div>
          {timingTotal / limit >= 0.8 && (
            <p className="adm-note adm-note--warn">
              {dur(limit)}을 넘기면 GitHub 가 작업을 중간에 멈춰요. 매매와 상태 저장은 앞쪽 단계라 괜찮지만, 뒤쪽의 차트 캡처 · 웹 데이터 · 사이트 새로고침이 잘려요.
            </p>
          )}
        </div>
      )}

      <div className={compact ? "adm-sub" : "adm-cols"}>
        <div>
          <h4>하는 일{compact ? "" : " (순서대로)"}</h4>
          <ol className="adm-steps">
            {p.steps.map((s) => {
              const m = stepMin.get(s.label);
              return (
                <li key={s.label}>
                  <b>{s.label}</b>{s.desc}
                  {m != null && m >= 60_000 && <span className="adm-steps__t num">{dur(m)}</span>}
                </li>
              );
            })}
          </ol>
        </div>
        <div>
          <h4>결과가 가는 곳</h4>
          <div className="adm-chips">
            {p.outputs.map((o) => <span key={o} className="chip">{o}</span>)}
          </div>
          {c.runs && c.runs.length > 0 && (
            <div className="adm-sub">
              <h4>{p.tick ? `오늘 (${todays.length}번)` : `최근 ${Math.min(6, c.runs.length)}번`}</h4>
              <ul className="adm-runs">
                {(p.tick ? [...todays].reverse() : c.runs.slice(0, 6)).map((r) => {
                  const rs = runState(r, p, now);
                  const manual = r.event !== "schedule" && p.dispatchLabel === "수동";
                  const cls = rs.tone === "bad" ? "adm-run--bad" : rs.tone === "wait" ? "adm-run--live" : manual ? "adm-run--man" : "";
                  const text = p.tick
                    ? HM.format(ms(r.started))
                    : `${YMD.format(ms(r.started)).slice(5)}${manual ? " 수동" : ""} ${rs.tone === "ok" ? hmm(runDur(r, now)) : rs.label}`;
                  return (
                    <li key={r.id} className={cls}>
                      <a href={r.url} target="_blank" rel="noreferrer" title={`#${r.number} · ${eventLabel(r, p)} · ${rs.label} · ${dur(runDur(r, now))}`}>{text}</a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
