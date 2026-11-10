"use client";

import { Hint } from "./Hint";
import { Icon, type IconName } from "./Icon";
import { useT } from "./LangProvider";
import type { StockListCtl } from "./StockControls";
import type { QuickKey } from "@/lib/stockList";

const ICON: Record<QuickKey, IconName> = {
  golden: "trend",
  fire: "bolt",
  quality: "shield",
  insider: "users",
  volume: "bars",
  high52: "peak",
  bottom: "rebound",
};

function Check() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12 L10 17 L19 7" />
    </svg>
  );
}

/**
 * 빠른 보기 (2026-11-10, 시안 2의 '원클릭 전략' 자리) — 자주 쓰는 필터 묶음을 카드로. 여러 장을 같이 고른다 (누르면 더하고 다시 누르면 뺀다).
 * 모두 만족(기본)이면 카드가 그 조건을 고급 필터 칸에 그대로 걸어서 고급 필터에 눌린 버튼으로 보이고, 고급 필터에서 같은 버튼을 눌러도
 * 카드가 켜진다. 하나라도면 따로 묶여서 고급 필터에 점선 버튼으로 보인다 (StockControls).
 * 여러 장이면 머리 오른쪽에서 '모두 만족'(좁히기) · '하나라도'(넓히기), '전부 고르기 · 전부 풀기'.
 * 이름은 '급등 임박' 같은 약속이 아니라 조건 그대로 — 골든크로스 · SQZ · 내부자 조건은 백테스트에서 시장보다 낫지 않았다.
 * 카드 숫자: 모두 만족이면 이 카드를 더했을 때 남는 수(고른 카드는 지금 결과), 하나라도면 이 카드 하나만의 수 — 위 막대 · 고급 필터 안에서.
 * 자료가 없는 묶음(52주 신고가 — 장중 · 전체분석만 등)은 빠진다. 끝에 '내 조합' (고급 필터 꼬리의 '이 조합 저장').
 */
export function QuickViews({ ctl }: { ctl: StockListCtl }) {
  const { t } = useT();
  const S = t.scr;
  if (!ctl.quick.length && !ctl.mine.length) return null;
  const mode = ctl.filters.quickMode;
  const all = ctl.quick.length > 0 && ctl.quick.every((v) => v.on);
  return (
    <section className="qv" aria-labelledby="qv-title">
      <div className="qv__head">
        <h2 id="qv-title" className="qv__title">{S.quickTitle}</h2>
        <Hint text={S.quickNoteHelp} className="qv__note">{S.quickNote}</Hint>
        {ctl.quick.length > 1 && (
          <div className="qv__ctl">
            <span className="qv__ctl-label">{S.quickModeLabel}</span>
            <div className="tseg tseg--mini" role="group" aria-label={S.quickModeLabel}>
              {(["and", "or"] as const).map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} title={S.quickModeHelp[m]} onClick={() => ctl.setQuickMode(m)}>
                  {S.quickMode[m]}
                </button>
              ))}
            </div>
            <button type="button" className="qv__all" onClick={() => ctl.setQuickAll(!all)}>
              {all ? S.quickNone : S.quickAll}
            </button>
          </div>
        )}
      </div>
      <div className="qv__row">
        {ctl.quick.map((v) => {
          const Q = S.quick[v.key];
          return (
            <button key={v.key} type="button" className={`qv-card qv-card--${v.key}`} aria-pressed={v.on}
              aria-label={S.quickAria(Q.title, v.n, v.on)} data-zero={v.n === 0 && !v.on ? "" : undefined}
              onClick={() => ctl.toggleQuick(v)}>
              <span className="qv-card__top">
                <span className="qv-card__icon"><Icon name={ICON[v.key]} size={17} /></span>
                <span className="qv-card__n num">{v.on && <Check />}{S.quickN(v.n)}</span>
              </span>
              <span className="qv-card__title">{Q.title}</span>
              <span className="qv-card__desc">{Q.desc}</span>
            </button>
          );
        })}
        {ctl.mine.map((m) => (
          <div key={m.id} className="qv-card qv-card--mine" data-on={m.on || undefined}>
            <button type="button" className="qv-card__hit" aria-pressed={m.on} aria-label={S.quickAria(m.name, m.n, m.on)}
              onClick={() => ctl.applyMine(m)}>
              <span className="qv-card__top">
                <span className="qv-card__icon"><Icon name="bookmark" size={17} /></span>
                <span className="qv-card__n num">{m.on && <Check />}{S.quickN(m.n)}</span>
              </span>
              <span className="qv-card__title">{S.mine}</span>
              <span className="qv-card__desc">{m.name}</span>
            </button>
            <button type="button" className="qv-card__del" aria-label={S.mineDelete(m.name)} title={S.mineDelete(m.name)}
              onClick={() => ctl.deleteMine(m.id)}>
              <Icon name="x" size={13} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
