"use client";

import { Dot } from "./Icon";
import { useT } from "./LangProvider";
import { fmtDate } from "@/lib/format";
import type { SecFlag } from "@/lib/types";

const BADGE = { red: "badge--bad", orange: "badge--warn", yellow: "badge--mid" } as const;

/** 후보·차트 카드용 — 빨강·주황만 작은 배지로. 없으면 아무것도 안 그린다. */
export function SecFlagChips({ flags }: { flags: SecFlag[] | undefined }) {
  const { lang, t } = useT();
  const shown = (flags ?? []).filter((f) => f.severity !== "yellow");
  if (!shown.length) return null;
  return (
    <>
      {shown.map((f) => (
        <span key={f.code} className={`badge ${BADGE[f.severity]}`} title={`${f.form} · ${f.date}`}>
          <Dot tone={f.severity} />{t.sec.codes[f.code] ?? f.label} {fmtDate(f.date, lang)}
        </span>
      ))}
    </>
  );
}
