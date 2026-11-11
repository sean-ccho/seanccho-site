import { money, num, pct, tone } from "@/lib/format";
import { industry, sector, type Dict, type Lang } from "@/lib/i18n";
import type { AnalystView, IndVal, TickerInfo, ValKey, Valuation } from "@/lib/types";
import { ValuationCompare, type ValOpt } from "./ValuationCompare";

// 종목 상세 52주 범위 막대 · 밸류에이션 · 애널리스트 (2026-11-03, 2026-11-10 개편). 서버 컴포넌트 — 숫자는 Project_1 밤 실행.
// 머리의 한눈에 줄 · 기간 수익률은 components/StockHead.tsx 로 옮겼다.

/** 52주 범위 끝 가격 — 10달러 이상은 정수, 그 아래는 센트까지 ($0 · $1 로 뭉개지지 않게). 캐나다 상장은 C$. */
const r52End = (v: number, ticker: string) => money(v, ticker, v >= 10 ? 0 : undefined);

/** 52주 범위 막대 — 최저 · 최고 사이 지금 가격 자리. */
export function Range52({ ticker, info, price, t }: { ticker: string; info: TickerInfo; price: number | null; t: Dict }) {
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
 * 밸류에이션 — 6개 지표, 기본은 같은 세부 업종 중앙값과 나란히 + 업종 대비 막대 (표 · 고르기는 ValuationCompare).
 * groups(market.json ind_val, 2026-11-09)가 있으면 '비교 대상'으로 같은 섹터 전체 · 시장 전체 · 다른 업종을 고를 수 있다.
 * fallbackSector = 업종의 섹터를 ind_val 에서 못 찾을 때 종목 섹터.
 */
export function ValuationCard({ v, groups, fallbackSector, selfLabel, lang, t }: {
  v: Valuation;
  groups?: IndVal | null;
  fallbackSector?: string | null;
  selfLabel?: string; // 표의 '이 종목' 칸 이름 (티커)
  lang: Lang;
  t: Dict;
}) {
  return <ValuationCompare v={v} opts={valOptions(v, groups ?? null, fallbackSector ?? null, lang, t)} selfLabel={selfLabel} />;
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

/**
 * 애널리스트 — 목표주가 범위(최저 · 평균 · 최고 막대 위에 평균 · 지금 점) + 지금 가격이 범위 어디인지 · 평균까지 몇 % +
 * 이번 달 의견 분포. 금액은 그 종목 통화로 (캐나다 상장은 C$). 2026-11-10 시안 모양 (머리 오른쪽 인원 배지).
 */
export function AnalystCard({ a, price, t, ticker = "" }: { a: AnalystView; price: number | null; t: Dict; ticker?: string }) {
  const I = t.invest;
  const S = t.sp;
  const cur = (v: number | null | undefined) => money(v, ticker, 2);
  const vals = [a.low, a.high, a.mean, price].filter((x): x is number => x != null);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  // 점이 막대 끝에 잘리지 않게 3% ~ 97% 안에
  const at = (x: number | null) => (x == null || hi === lo ? null : 3 + ((x - lo) / (hi - lo)) * 94);
  const up = a.mean != null && price ? a.mean / price - 1 : null;
  const total = a.rec ? REC_ORDER.reduce((s, k) => s + a.rec![k], 0) : 0;
  const n = a.n ?? total;
  const where = price == null || a.low == null || a.high == null
    ? null : price < a.low ? S.anBelowLow : price > a.high ? S.anAboveHigh : S.anInRange;
  const band = at(a.low) != null && at(a.high) != null;
  return (
    <section className="card sd-card" aria-labelledby="an-title">
      <div className="sd-card__head">
        <h2 id="an-title">{I.anTitle}</h2>
        {n > 0 && <span className="sd-badge" title={I.anSub(n)}>{S.anCount(n)}</span>}
      </div>
      <div className="sd-an">
        <dl className="sd-an__legs">
          <div><dt>{I.anLow}</dt><dd className="num">{cur(a.low)}</dd></div>
          <div className="sd-an__mean"><dt>{I.anTarget} {I.anMean}</dt><dd className="num">{cur(a.mean)}</dd></div>
          <div><dt>{I.anHigh}</dt><dd className="num">{cur(a.high)}</dd></div>
        </dl>
        <div className="sd-an__track" aria-hidden="true">
          {band && <span className="sd-an__band" style={{ left: `${at(a.low)}%`, right: `${100 - at(a.high)!}%` }} />}
          {at(a.mean) != null && <span className="sd-an__dot sd-an__dot--mean" style={{ left: `${at(a.mean)}%` }} />}
          {at(price) != null && <span className="sd-an__dot sd-an__dot--now" style={{ left: `${at(price)}%` }} />}
        </div>
        <p className="sd-an__now">
          <span>
            <i className="sd-an__key" aria-hidden="true" />
            {I.anNow} <b className="num">{cur(price)}</b>
            {where && <span className="muted"> · {where}</span>}
          </span>
          {up != null && <span className={`sd-an__up num ${tone(up)}`}>{S.anToMean(pct(up))}</span>}
        </p>
      </div>
      {a.rec && total > 0 && (
        <div className="an-rec">
          <p className="small" style={{ margin: "0 0 6px" }}>
            <b>{a.rec_key ? I.recKey[a.rec_key] ?? a.rec_key : ""}</b>
            {a.rec_mean != null && <span className="muted"> · {S.anRecMean(num(a.rec_mean, 2))}</span>}
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
      <p className="tiny muted sd-note">{I.anNote}</p>
    </section>
  );
}
