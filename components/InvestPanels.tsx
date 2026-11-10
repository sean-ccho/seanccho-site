import { spyBack } from "@/lib/bench";
import { money, num, pct, tone } from "@/lib/format";
import { industry, sector, type Dict, type Lang } from "@/lib/i18n";
import { cmpText, compareVal, headlinePe } from "@/lib/market";
import type { AnalystView, Benchmark, IndVal, TickerInfo, ValKey, Valuation } from "@/lib/types";
import { Hint } from "./Hint";
import { LiveDot } from "./LiveMark";
import { ValuationCompare, type ValOpt } from "./ValuationCompare";

// 종목 상세 '한눈에' · 기간 수익률 · 밸류에이션 · 애널리스트 (2026-11-03). 서버 컴포넌트 — 숫자는 Project_1 밤 실행.

/** 52주 범위 끝 가격 — 10달러 이상은 정수, 그 아래는 센트까지 ($0 · $1 로 뭉개지지 않게). 캐나다 상장은 C$. */
const r52End = (v: number, ticker: string) => money(v, ticker, v >= 10 ? 0 : undefined);

/** 52주 범위 막대 — 최저 · 최고 사이 지금 가격 자리. */
function Range52({ ticker, info, price, t }: { ticker: string; info: TickerInfo; price: number | null; t: Dict }) {
  const r = info.range_52w;
  let pos = info.position_52w ?? null;
  if (r && price != null && r.high > r.low) pos = (price - r.low) / (r.high - r.low);
  if (pos == null) return <>—</>;
  pos = Math.min(1, Math.max(0, pos));
  return (
    <span className="r52" title={t.invest.range52Help}>
      {r && <span className="num r52__end">{r52End(r.low, ticker)}</span>}
      <span className="r52__track" aria-label={pct(pos, 0, false)}>
        <i style={{ left: `${pos * 100}%` }} />
      </span>
      {r && <span className="num r52__end">{r52End(r.high, ticker)}</span>}
    </span>
  );
}

/**
 * 종목 머리 아래 '한눈에' 한 줄 — 52주 범위 · PER(업종 대비) · 목표주가 · 애널리스트 의견 · 다음 실적.
 * earnings = 지금 페이지가 이미 만든 '다음 실적' 칸 (같은 글자 · 색).
 */
export function StockGlance({ ticker, info, price, valuation, analyst, earnings, t }: {
  ticker: string;
  info: TickerInfo;
  price: number | null;
  valuation: Valuation | null | undefined;
  analyst: AnalystView | null | undefined;
  earnings: { v: React.ReactNode; cls?: string } | null;
  t: Dict;
}) {
  const I = t.invest;
  const pe = valuation ? headlinePe(valuation) : null;
  const peCmp = pe ? compareVal(pe.self, pe.ind) : null;
  const up = analyst?.mean != null && price ? analyst.mean / price - 1 : null;
  const rec = analyst?.rec;
  return (
    <dl className="kv-strip kv-strip--glance">
      <div className="kv-wide">
        <dt>{I.range52}</dt>
        <dd><Range52 ticker={ticker} info={info} price={price} t={t} /></dd>
      </div>
      {pe && (
        <div>
          <Hint as="dt" text={I.valHelp[pe.key]}>{I.valNames[pe.key]}</Hint>
          <dd>
            <span className="num">{pe.self != null && pe.self > 0 ? num(pe.self, 1) : I.valLoss}</span>
            {pe.ind != null && peCmp && (
              <span className="kv-sub">{I.vsInd(num(pe.ind, 1))} · {cmpText(peCmp, t)}</span>
            )}
          </dd>
        </div>
      )}
      {analyst?.mean != null && (
        <div>
          <dt>{I.target}</dt>
          <dd>
            <span className="num">{money(analyst.mean, ticker, 2)}</span>{" "}
            <span className={`num small ${tone(up)}`}>{pct(up)}</span>
            {analyst.n != null && <span className="kv-sub">{I.analysts(analyst.n)}</span>}
          </dd>
        </div>
      )}
      {analyst?.rec_key && (
        <div>
          <dt>{I.rating}</dt>
          <dd>
            {I.recKey[analyst.rec_key] ?? analyst.rec_key}
            {rec && (
              <span className="kv-sub">
                {I.recNames.buy} {rec.strong_buy + rec.buy} · {I.recNames.hold} {rec.hold} · {I.recNames.sell} {rec.sell + rec.strong_sell}
              </span>
            )}
          </dd>
        </div>
      )}
      {earnings && (
        <div>
          <dt>{t.common.nextEarnings}</dt>
          <dd className={earnings.cls}>{earnings.v}</dd>
        </div>
      )}
    </dl>
  );
}

/**
 * 기간 수익률 — 하루 · 1주 · 1달 · 3달 · 1년, 칸마다 같은 기간 SPY. asOf = 종목 숫자의 기준일.
 * 장중(2026-11-09, info.live)에는 하루 칸만 오늘 장중 값 (SPY 도 오늘 — dashboard benchmark 끝에 장중 SPY), 나머지는 밤 값.
 */
export function ReturnsStrip({ info, bench, asOf, t }: {
  info: TickerInfo;
  bench: Benchmark | null | undefined;
  asOf: string | null;
  t: Dict;
}) {
  const P = t.invest.periods;
  const live = info.live ?? null;
  // 후보 · 보유 종목은 펄스가 지표도 다시 계산해서(live_heat 가 있음) 5일 수익률도 장중 값
  const live5 = !!live && Array.isArray(info.live_heat);
  const rows: { k: string; v: number | null | undefined; n: number; live?: boolean }[] = [
    { k: P.d1, v: info.ret_1d, n: 1, live: !!live },
    { k: P.w1, v: info.ret_5d, n: 5, live: live5 },
    { k: P.m1, v: info.ret_20d, n: 20 },
    { k: P.m3, v: info.ret_63d, n: 63 },
    { k: P.y1, v: info.ret_252d, n: 252 },
  ];
  if (rows.every((r) => r.v == null)) return null;
  return (
    <dl className="kv-strip kv-strip--ret" aria-label={t.invest.returns}>
      {rows.map((r) => {
        const s = spyBack(bench, r.n, r.live && live ? live.day : asOf);
        return (
          <div key={r.k}>
            <dt>{r.k}{r.live && <LiveDot mark={live} t={t} />}</dt>
            <dd>
              <span className={`num ${tone(r.v)}`}>{pct(r.v)}</span>
              <span className="kv-sub num">{t.invest.vsSpy(pct(s))}</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * 밸류에이션 — 6개 지표, 기본은 같은 세부 업종 중앙값과 나란히 + 업종 대비 막대 (표 · 고르기는 ValuationCompare).
 * groups(market.json ind_val, 2026-11-09)가 있으면 '비교 대상'으로 같은 섹터 전체 · 시장 전체 · 다른 업종을 고를 수 있다.
 * fallbackSector = 업종의 섹터를 ind_val 에서 못 찾을 때 종목 섹터.
 */
export function ValuationCard({ v, groups, fallbackSector, lang, t }: {
  v: Valuation;
  groups?: IndVal | null;
  fallbackSector?: string | null;
  lang: Lang;
  t: Dict;
}) {
  return <ValuationCompare v={v} opts={valOptions(v, groups ?? null, fallbackSector ?? null, lang, t)} />;
}

const VAL_KEYS: ValKey[] = ["pe", "fpe", "peg", "ps", "pb", "ev_ebitda"];
/** 중앙값 묶음에서 지표 6개만 (n · sector 는 브라우저에 안 보낸다). */
const meds = (m: Partial<Record<ValKey, number | null>>): ValOpt["med"] =>
  Object.fromEntries(VAL_KEYS.map((k) => [k, m[k] ?? null]));

function valOptions(v: Valuation, g: IndVal | null, fallbackSector: string | null, lang: Lang, t: Dict): ValOpt[] {
  const I = t.invest;
  const indName = industry(lang, v.industry);
  const basic = I.valGrpBasic;
  const opts: ValOpt[] = [
    { key: "own", label: I.valOptOwn(indName, v.n_peers), group: basic, sub: I.valSub(indName, v.n_peers), name: null, med: v.ind },
  ];
  if (!g) return opts;
  const mySector = (v.industry ? g.industries[v.industry]?.sector : null) ?? fallbackSector;
  const sec = mySector ? g.sectors[mySector] : null;
  if (mySector && sec) {
    const name = sector(lang, mySector);
    opts.push({ key: `sec:${mySector}`, label: I.valOptSector(name, sec.n), group: basic, sub: I.valSubSector(name, sec.n),
      name: I.valSectorName(name), med: meds(sec) });
  }
  if (g.all) {
    opts.push({ key: "all", label: I.valOptAll(g.all.n), group: basic, sub: I.valSubAll(g.all.n), name: I.valAllName, med: meds(g.all) });
  }
  // 다른 업종 — 같은 섹터 업종 먼저, 그다음 섹터 이름 순 · 섹터 안은 업종 이름 순 (그 언어로)
  const bySector = new Map<string, { key: string; name: string; n: number; med: ValOpt["med"] }[]>();
  for (const [ind, m] of Object.entries(g.industries)) {
    if (ind === v.industry) continue;
    const s = m.sector ?? "Unknown";
    const list = bySector.get(s) ?? [];
    list.push({ key: ind, name: industry(lang, ind), n: m.n, med: meds(m) });
    bySector.set(s, list);
  }
  const coll = new Intl.Collator(lang === "ko" ? "ko" : "en");
  const sectors = [...bySector.keys()].sort((a, b) =>
    a === mySector ? -1 : b === mySector ? 1 : coll.compare(sector(lang, a), sector(lang, b)));
  for (const s of sectors) {
    const group = I.valGrpSector(sector(lang, s));
    for (const x of bySector.get(s)!.sort((a, b) => coll.compare(a.name, b.name))) {
      opts.push({ key: `ind:${x.key}`, label: I.valOptInd(x.name, x.n), group, sub: I.valSubOther(x.name, x.n), name: x.name,
        med: x.med });
    }
  }
  return opts;
}

type RecKey = keyof NonNullable<AnalystView["rec"]>;
const REC_ORDER: RecKey[] = ["strong_buy", "buy", "hold", "sell", "strong_sell"];

/** 애널리스트 — 목표주가 범위(최저 · 평균 · 최고 · 지금) + 이번 달 의견 분포. 금액은 그 종목 통화로 (캐나다 상장은 C$). */
export function AnalystCard({ a, price, t, ticker = "" }: { a: AnalystView; price: number | null; t: Dict; ticker?: string }) {
  const I = t.invest;
  const cur = (v: number | null | undefined) => money(v, ticker, 2);
  const vals = [a.low, a.high, a.mean, price].filter((x): x is number => x != null);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const at = (x: number | null) => (x == null || hi === lo ? null : ((x - lo) / (hi - lo)) * 100);
  const up = a.mean != null && price ? a.mean / price - 1 : null;
  const total = a.rec ? REC_ORDER.reduce((s, k) => s + a.rec![k], 0) : 0;
  return (
    <section className="card" aria-labelledby="an-title">
      <div className="section-head">
        <h2 id="an-title">{I.anTitle}</h2>
        <p>{I.anSub(a.n ?? total)}</p>
      </div>
      <div className="an-target">
        <p className="an-target__head">
          <span className="muted small">{I.anTarget} ({I.anMean})</span>{" "}
          <b className="num">{cur(a.mean)}</b>{" "}
          <span className={`num ${tone(up)}`}>{up != null ? I.anUpside(pct(up)) : ""}</span>
        </p>
        <div className="an-range" aria-hidden="true">
          <span className="an-range__band" style={{ left: `${at(a.low) ?? 0}%`, right: `${100 - (at(a.high) ?? 100)}%` }} />
          {at(a.mean) != null && <span className="an-range__mean" style={{ left: `${at(a.mean)}%` }} />}
          {at(price) != null && <span className="an-range__now" style={{ left: `${at(price)}%` }}><em>{I.anNow}</em></span>}
        </div>
        <dl className="an-legs">
          <div><dt>{I.anLow}</dt><dd className="num">{cur(a.low)}</dd></div>
          <div><dt>{I.anNow}</dt><dd className="num">{cur(price)}</dd></div>
          <div><dt>{I.anMean}</dt><dd className="num">{cur(a.mean)}</dd></div>
          <div><dt>{I.anHigh}</dt><dd className="num">{cur(a.high)}</dd></div>
        </dl>
      </div>
      {a.rec && total > 0 && (
        <div className="an-rec">
          <p className="small" style={{ margin: "0 0 6px" }}>
            <b>{a.rec_key ? I.recKey[a.rec_key] ?? a.rec_key : ""}</b>
          </p>
          <div className="an-rec__bar" role="img"
            aria-label={REC_ORDER.map((k) => `${I.recNames[k]} ${a.rec![k]}`).join(", ")}>
            {REC_ORDER.filter((k) => a.rec![k] > 0).map((k) => (
              <i key={k} className={`rec-${k}`} style={{ flexGrow: a.rec![k] }} title={`${I.recNames[k]} ${a.rec![k]}`} />
            ))}
          </div>
          <ul className="an-rec__legend">
            {REC_ORDER.map((k) => (
              <li key={k}>
                <i className={`rec-${k}`} aria-hidden="true" />
                {I.recNames[k]} <b className="num">{a.rec![k]}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="tiny muted" style={{ margin: "10px 0 0" }}>{I.anNote}</p>
    </section>
  );
}
