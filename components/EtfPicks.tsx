"use client";

import { useT } from "./LangProvider";
import { etfMoney } from "./EtfDetail";
import type { EtfItem, EtfPicks as Picks } from "@/lib/etf";
import { pct, tone } from "@/lib/format";

/**
 * ETF 탭 맨 위 — 고르기 어려울 때. ① 역할별 기본 1개 (같은 것 중 보수 최저 — 근거 있는 기준)
 * ② 요즘 강한 ETF 5개 (6달 수익 순 — 검증 안 된 참고). 누르면 아래 표에서 그 ETF 를 펼친다.
 */
export function EtfPicks({ picks, byTicker, onOpen }: {
  picks: Picks; byTicker: Map<string, EtfItem>; onOpen: (t: string) => void;
}) {
  const { lang, t } = useT();
  const P = t.etf.picks;
  const mom = picks.momentum.map((tk) => byTicker.get(tk)).filter((r): r is EtfItem => !!r);
  return (
    <section className="card etf-picks" aria-label={P.aria}>
      <h2 className="etf-picks__h">{P.rolesTitle}</h2>
      <p className="tiny muted etf-picks__note">{P.rolesNote}</p>
      <div className="etf-roles">
        {picks.roles.map((role) => {
          const r = byTicker.get(role.pick);
          if (!r) return null;
          const alts = role.alts.map((tk) => byTicker.get(tk)).filter((x): x is EtfItem => !!x);
          return (
            <button key={role.key} type="button" className="etf-role" onClick={() => onOpen(r.ticker)} title={P.open}>
              <span className="etf-role__what">{lang === "en" ? role.en : role.ko}</span>
              <span className="etf-role__pick">
                <span className="tick">{r.ticker}</span>
                <span className="num">{pct(r.expense, 2, false)}</span>
              </span>
              <span className="etf-role__name">{r.name ?? ""}</span>
              <span className="tiny muted">
                {t.etf.colAum} {etfMoney(r.aum, r.currency)}
                {alts.length > 0 && ` · ${P.alts} ${alts.map((a) => `${a.ticker} ${pct(a.expense, 2, false)}`).join(" · ")}`}
              </span>
            </button>
          );
        })}
      </div>

      {mom.length > 0 && (
        <>
          <h2 className="etf-picks__h" style={{ marginTop: 16 }}>{P.momTitle}</h2>
          <p className="tiny muted etf-picks__note">{P.momNote}</p>
          <ol className="etf-mom">
            {mom.map((r) => (
              <li key={r.ticker}>
                <button type="button" className="etf-mom__row" onClick={() => onOpen(r.ticker)} title={P.open}>
                  <span className="tick">{r.ticker}</span>
                  <span className="etf-mom__name muted">{r.name ?? ""}</span>
                  <span className={`num ${tone(r.ret.m6)}`}>{t.etf.ret.m6} {pct(r.ret.m6)}</span>
                  <span className={`num ${tone(r.ret.y1)}`}>{t.etf.ret.y1} {pct(r.ret.y1)}</span>
                  <span className={`num ${tone(r.mdd_1y)}`}>{t.etf.colMdd} {pct(r.mdd_1y)}</span>
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
