"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useT } from "./LangProvider";
import { LANG_COOKIE, type Lang } from "@/lib/i18n";

const LANGS: { value: Lang; label: string; name: string }[] = [
  { value: "ko", label: "KO", name: "한국어" },
  { value: "en", label: "EN", name: "English" },
];

/** KO | EN — 쿠키에 1년 저장하고 서버에서 다시 그린다. */
export function LangToggle() {
  const { lang, t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();

  const pick = (next: Lang) => {
    if (next === lang) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  };

  return (
    <div className="tseg lang-toggle" role="group" aria-label={t.nav.switchAria}>
      {LANGS.map((l) => (
        <button key={l.value} type="button" lang={l.value} aria-pressed={lang === l.value} aria-label={l.name}
          disabled={pending} onClick={() => pick(l.value)}>
          {l.label}
        </button>
      ))}
    </div>
  );
}
