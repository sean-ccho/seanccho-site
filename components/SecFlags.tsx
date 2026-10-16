"use client";

import { useT } from "./LangProvider";
import { fmtDate } from "@/lib/format";
import type { SecFlag } from "@/lib/types";

const ICON = { red: "🔴", orange: "🟠", yellow: "🟡" } as const;
const BADGE = { red: "badge--bad", orange: "badge--warn", yellow: "badge--mid" } as const;

/** 후보·차트 카드용 — 🔴·🟠 만 작은 배지로. 없으면 아무것도 안 그린다. */
export function SecFlagChips({ flags }: { flags: SecFlag[] | undefined }) {
  const { lang, t } = useT();
  const shown = (flags ?? []).filter((f) => f.severity !== "yellow");
  if (!shown.length) return null;
  return (
    <>
      {shown.map((f) => (
        <span key={f.code} className={`badge ${BADGE[f.severity]}`} title={`${f.form} · ${f.date}`}>
          {ICON[f.severity]} {t.sec.codes[f.code] ?? f.label} {fmtDate(f.date, lang)}
        </span>
      ))}
    </>
  );
}

/** 종목 상세 — 경고마다 한 줄 (심각도·이름·날짜·양식·건수·원문 링크). */
export function SecFlagList({ flags }: { flags: SecFlag[] }) {
  const { lang, t } = useT();
  if (!flags.length) return <p className="muted" style={{ margin: "8px 0 0" }}>{t.sec.none}</p>;
  return (
    <ul className="sec-list">
      {flags.map((f) => (
        <li key={f.code}>
          <span className={`badge ${BADGE[f.severity]}`}>{ICON[f.severity]} {t.sec.codes[f.code] ?? f.label}</span>
          <span className="small">{fmtDate(f.date, lang)}</span>
          <span className="small muted">{f.form}{f.count > 1 ? ` · ${t.sec.count(f.count)}` : ""}</span>
          {f.url && (
            <a className="link-strong small" href={f.url} target="_blank" rel="noopener noreferrer">{t.sec.open}</a>
          )}
        </li>
      ))}
    </ul>
  );
}
