import { Dot } from "./Icon";
import { indicatorTexts } from "./MacroSection";
import { fmtDate, todayToronto } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n";
import { daysUntil, getMacro, type MacroKey, type MacroStatus } from "@/lib/macro";

const STATUS_DOT: Record<MacroStatus, "green" | "orange" | "red"> = { good: "green", watch: "orange", bad: "red" };

/**
 * 오늘 탭 맨 위 '지금 경기 상태' 띠 (2026-11-03) — 지표 6개(이름 · 값 · 판정)와 다음 금리 결정을 한 줄로, 자세한 칸은 같은 페이지 아래.
 * 전에는 경기 상태가 뉴스 40개 밑(폰에서 5,000px 넘게 아래)이라 안 보였다.
 * 내 계좌 · PT-1 숫자는 여기 두지 않는다 — 계좌 정보는 내계좌 탭에만 (공개 화면과 나눠 둔다).
 */
export async function TodayGlance({ lang, t }: { lang: Lang; t: Dict }) {
  const macro = await getMacro();
  if (!macro?.indicators.length) return null;
  const G = t.glance;
  const M = t.macro;
  const today = todayToronto();
  // FOMC · BoC 다음 결정 (오늘 이후만)
  const next = [
    { bank: M.fomc, date: macro.rates.fomc?.next?.date },
    { bank: M.boc, date: macro.rates.boc?.next?.date },
  ].filter((x): x is { bank: string; date: string } => !!x.date && daysUntil(x.date, today) >= 0);

  return (
    <section className="glance" aria-labelledby="glance-title">
      <div className="section-head">
        <h2 id="glance-title">{M.title}</h2>
        <p>
          {G.asOf(fmtDate(macro.as_of, lang))}
          {next.length > 0 &&
            ` · ${G.next} ${next.map((x) => `${x.bank} ${fmtDate(x.date, lang)} ${M.dday(daysUntil(x.date, today))}`).join(" · ")}`}
          {" · "}
          <a className="glance__more" href="#macro-title">{G.more} ↓</a>
        </p>
      </div>
      <dl className="kv-strip">
        {macro.indicators.map((i) => {
          const tx = indicatorTexts(i, t);
          return (
            <div key={i.key}>
              <dt>{M.short[i.key]}</dt>
              <dd>
                <span className="num">{tx.value}</span>
                <span className={`glance-status glance-status--${i.status}`}>
                  <Dot tone={STATUS_DOT[i.status]} />
                  {tx.status}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

/** 띠를 받는 동안 같은 자리를 잡아 두는 칸 (아래 뉴스가 밀리지 않게). */
export function TodayGlanceSkeleton({ t }: { t: Dict }) {
  const M = t.macro;
  return (
    <section className="glance" aria-labelledby="glance-title" aria-busy="true">
      <div className="section-head">
        <h2 id="glance-title">{M.title}</h2>
        <p />
      </div>
      <dl className="kv-strip">
        {(Object.keys(M.short) as MacroKey[]).map((k) => (
          <div key={k}>
            <dt>{M.short[k]}</dt>
            <dd className="muted">—</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
