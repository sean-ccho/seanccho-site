import Link from "next/link";
import { fmtDate, stockHref } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n";
import { daysUntil, impactLevel, type MacroEvent } from "@/lib/macro";
import { shortCompany } from "@/lib/market";
import type { MegaEarning } from "@/lib/types";
import { Hint } from "./Hint";
import type { TodayMarket } from "./MarketSwitch";

/**
 * 주요 일정 (2026-11-06) — Project_1 data/event_calendar.py 가 macro.json 에 싣는 events.
 *  · EventLines   '이번 주 일정' 날짜 칸 위쪽 (MarketToday.EarningsCalendar 가 그날 일정을 넘긴다)
 *  · NextBadges   '이번 주 일정' 카드 머리 — 보이는 5일 뒤 첫 ★★★ 일정 · 첫 대형주 실적 (2026-11-10)
 *  · BigEventList 같은 카드 맨 아래 '다가오는 큰 일정' (펼침) — 3달 안 ★★★ + 대형주 실적(시장 전환을 따른다), 더 펼치면 1년 (★★ · 휴장)
 * ★ = 주목도(관심), 배지 = 그날 지수가 실제로 평소보다 얼마나 움직였나 — 둘을 섞지 않는다.
 */

const BIG_DAYS = 92;
const YEAR_DAYS = 366;

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 날짜 글자 — 올해가 아니면 연도를 붙인다. */
function dayLabel(iso: string, lang: Lang, today: string): string {
  const base = fmtDate(iso, lang, true);
  return iso.slice(0, 4) === today.slice(0, 4) ? base : lang === "en" ? `${base}, ${iso.slice(0, 4)}` : `${iso.slice(0, 4)}년 ${base}`;
}

/** 날짜별로 (이번 주 칸). */
export function eventsByDate(events: MacroEvent[] | undefined): Map<string, MacroEvent[]> {
  const out = new Map<string, MacroEvent[]>();
  for (const e of events ?? []) {
    const list = out.get(e.date);
    if (list) list.push(e);
    else out.set(e.date, [e]);
  }
  return out;
}

function eventName(e: MacroEvent, lang: Lang): string {
  return lang === "en" ? e.en : e.ko;
}

function eventNote(e: MacroEvent, lang: Lang): string {
  return lang === "en" ? e.note_en : e.note_ko;
}

/** '왜 중요한가' 말풍선 — 정식 이름 · 메모 · 설명. */
function whyText(e: MacroEvent, lang: Lang, t: Dict): string {
  return [eventName(e, lang), eventNote(e, lang), t.events.why[e.key]].filter(Boolean).join(" — ");
}

function Stars({ n, t }: { n: number; t: Dict }) {
  return (
    <span className={`ev-tier ev-tier--${n}`} title={t.events.tier(n)} aria-label={t.events.tier(n)}>
      {"★".repeat(n)}
    </span>
  );
}

function Country({ c, t }: { c: "US" | "CA"; t: Dict }) {
  return (
    <span className={`ev-cc ev-cc--${c.toLowerCase()}`} title={t.events.countryName[c]}>
      {t.events.country[c]}
    </span>
  );
}

/** '평소 대비 변동' 표시 — 크면 배수, 아니면 말로. 말풍선에 횟수 · 평균. */
export function ImpactTag({ e, t }: { e: MacroEvent; t: Dict }) {
  const imp = e.impact;
  if (!imp) return null;
  const E = t.events;
  const level = impactLevel(imp.x);
  const label = level === "big" ? E.big(imp.x.toFixed(1)) : level === "same" ? E.same : E.small;
  const index = e.country === "CA" ? "XIC" : "SPY";
  const help = E.impactHelp(index, imp.n, imp.since, `${(imp.avg * 100).toFixed(2)}%`, `${(imp.base * 100).toFixed(2)}%`);
  return (
    <Hint text={help} className={`ev-imp ev-imp--${level}`}>
      {label}
    </Hint>
  );
}

/** 이번 주 날짜 칸 위쪽 일정 상자 — ★ · 짧은 이름(말풍선 = 정식 이름 · 메모 · 설명) · 나라 · 시각, 밑에 평소 대비 변동. */
export function EventLines({ events, lang, t }: { events: MacroEvent[]; lang: Lang; t: Dict }) {
  if (!events.length) return null;
  return (
    <ul className="ecal-ev">
      {events.map((e) => (
        <li key={`${e.key}-${e.date}-${e.ko}`} className={`ecal-ev__row ecal-ev--${e.kind} ecal-ev--t${e.tier}`}>
          <span className="ecal-ev__top">
            <Stars n={e.tier} t={t} />
            <Hint text={whyText(e, lang, t)} className="ecal-ev__name">
              {t.events.short[e.key] ?? eventName(e, lang)}
            </Hint>
            <span className="ecal-ev__meta">
              <Country c={e.country} t={t} />
              {e.time && <span className="num tiny muted">{e.time}</span>}
            </span>
          </span>
          {/* 그날 지수가 평소보다 얼마나 움직였나 (2026-11-10 이번 주 칸에도) — 휴장 · 정치 일정처럼 자료가 없으면 줄 없음 */}
          {e.impact && (
            <span className="ecal-ev__imp">
              <ImpactTag e={e} t={t} />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

type Row = { date: string; ev?: MacroEvent; earn?: MegaEarning; mk?: TodayMarket };

/** 3달 ★★★ 일정 + 대형주 실적(시장마다) 줄 → 날짜 순. 같은 날은 일정 먼저. */
function mainRows(events: MacroEvent[], mega: Partial<Record<TodayMarket, MegaEarning[]>>, today: string): Row[] {
  const end = addDays(today, BIG_DAYS);
  const rows: Row[] = events.filter((e) => e.tier >= 3 && e.date >= today && e.date <= end).map((e) => ({ date: e.date, ev: e }));
  for (const mk of ["us", "ca"] as const) {
    for (const m of mega[mk] ?? []) if (m.date >= today && m.date <= end) rows.push({ date: m.date, earn: m, mk });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || Number(!!a.earn) - Number(!!b.earn));
}

/** 펼친 목록 — 1년 안 나머지 (★★ 이상 또는 휴장 · 조기 폐장) + 먼 선거. 옵션 만기 · PPI 같은 ★ 는 뺀다. */
function restRows(events: MacroEvent[], today: string): MacroEvent[] {
  const soon = addDays(today, BIG_DAYS);
  const year = addDays(today, YEAR_DAYS);
  return events.filter((e) => {
    if (e.date < today) return false;
    if (e.tier >= 3 && e.date <= soon) return false; // 위 목록에 있음
    if (e.kind === "policy") return true; // 선거 · 예산 기한은 먼 것도
    return e.date <= year && (e.tier >= 2 || e.kind === "holiday");
  });
}

function EventRow({ e, today, lang, t }: { e: MacroEvent; today: string; lang: Lang; t: Dict }) {
  const d = daysUntil(e.date, today);
  const note = eventNote(e, lang);
  return (
    <li className={`bigev__row bigev--${e.kind}`}>
      <span className="bigev__date">
        <b>{dayLabel(e.date, lang, today)}</b>
        <span className="tiny muted">{d === 0 ? t.invest.today : `D-${d}`}</span>
      </span>
      <span className="bigev__body">
        <span className="bigev__title">
          <Stars n={e.tier} t={t} />
          <Country c={e.country} t={t} />
          <Hint text={t.events.why[e.key] ?? null}>{eventName(e, lang)}</Hint>
          {e.time && <span className="num tiny muted">{t.events.timeEt(e.time)}</span>}
        </span>
        {note && <span className="tiny muted bigev__note">{note}</span>}
      </span>
      <span className="bigev__imp">
        <ImpactTag e={e} t={t} />
      </span>
    </li>
  );
}

function EarnRow({ m, mk, today, lang, t }: { m: MegaEarning; mk: TodayMarket; today: string; lang: Lang; t: Dict }) {
  const d = daysUntil(m.date, today);
  return (
    <li className="bigev__row bigev--earn" data-show={mk}>
      <span className="bigev__date">
        <b>{dayLabel(m.date, lang, today)}</b>
        <span className="tiny muted">{d === 0 ? t.invest.today : `D-${d}`}</span>
      </span>
      <span className="bigev__body">
        <span className="bigev__title">
          <span className="ev-earn">{t.events.earn}</span>
          <Link className="tick" href={stockHref(m.t)}>{m.t}</Link>
          <span>{shortCompany(m.name)}</span>
          {m.timing && <span className={`ecal-tm ecal-tm--${m.timing}`}>{t.invest.timing[m.timing]}</span>}
        </span>
      </span>
      <span className="bigev__imp" />
    </li>
  );
}

/** 이번 주 카드 머리 배지 한 개 — '11/17 NVDA 실적 · D-7'. */
type Badge = { date: string; label: string; kind: "ev" | "earn" };

/** 'YYYY-MM-DD' → '11/17' (두 언어 같은 꼴 — 배지가 좁다). */
function md(iso: string): string {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
}

/**
 * '이번 주 일정' 카드 머리 (2026-11-10) — 날짜 칸으로 보이는 마지막 날(after) 뒤 3달 안 첫 ★★★ 일정과 첫 대형주 실적, 가까운 순.
 * 칸 안에 이미 보이는 일정은 겹쳐 쓰지 않는다. 대형주 실적은 시장마다 달라서 부르는 쪽이 그 시장 것만 넘긴다.
 */
export function NextBadges({ events, mega, after, today, lang, t }: {
  events: MacroEvent[];
  mega: MegaEarning[];
  after: string;
  today: string;
  lang: Lang;
  t: Dict;
}) {
  const end = addDays(today, BIG_DAYS);
  const ev = events.find((e) => e.tier >= 3 && e.date > after && e.date <= end);
  const earn = mega.find((m) => m.date > after && m.date <= end);
  const items: Badge[] = [];
  if (ev) items.push({ date: ev.date, label: t.events.short[ev.key] ?? eventName(ev, lang), kind: "ev" });
  if (earn) items.push({ date: earn.date, label: t.brief.earnBadge(earn.t), kind: "earn" });
  items.sort((a, b) => a.date.localeCompare(b.date));
  return (
    <>
      {items.map((b) => (
        <span key={`${b.kind}-${b.date}`} className={`brief-badge brief-badge--${b.kind}`}>
          {md(b.date)} {b.label} · <b className="num">{t.macro.dday(daysUntil(b.date, today))}</b>
        </span>
      ))}
    </>
  );
}

/**
 * '이번 주 일정' 카드 맨 아래 '다가오는 큰 일정' 목록 (2026-11-06 따로 칸 → 2026-11-10 카드 안 펼침).
 * 3달 안 ★★★ 일정 + 대형주 실적(시장마다 data-show — 카드의 미국 · 캐나다 전환을 따른다), 더 펼치면 1년 (★★ · 휴장 · 먼 선거).
 */
export function BigEventList({ events, mega, today, lang, t }: {
  events: MacroEvent[];
  mega: Partial<Record<TodayMarket, MegaEarning[]>>;
  today: string;
  lang: Lang;
  t: Dict;
}) {
  const rows = mainRows(events, mega, today);
  const rest = restRows(events, today);
  const E = t.events;
  return (
    <>
      <ol className="bigev__list">
        {rows.map((r) =>
          r.ev ? (
            <EventRow key={`e-${r.ev.key}-${r.date}-${r.ev.ko}`} e={r.ev} today={today} lang={lang} t={t} />
          ) : (
            <EarnRow key={`m-${r.mk}-${r.earn!.t}`} m={r.earn!} mk={r.mk!} today={today} lang={lang} t={t} />
          ),
        )}
      </ol>
      {rest.length > 0 && (
        <details className="bigev__more">
          <summary>{E.all(rest.length)}</summary>
          <ol className="bigev__list">
            {rest.map((e) => (
              <EventRow key={`r-${e.key}-${e.date}-${e.ko}`} e={e} today={today} lang={lang} t={t} />
            ))}
          </ol>
        </details>
      )}
      <p className="tiny muted" style={{ margin: "6px 0 0" }}>{E.note}</p>
    </>
  );
}
