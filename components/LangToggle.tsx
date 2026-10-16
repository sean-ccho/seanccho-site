"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useT } from "./LangProvider";
import { LANG_COOKIE } from "@/lib/i18n";

/** 한국어 ↔ English — 쿠키에 1년 저장하고 서버에서 다시 그린다. */
export function LangToggle() {
  const { lang, t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = lang === "ko" ? "en" : "ko";

  const flip = () => {
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  };

  return (
    <button type="button" className="btn lang-toggle" onClick={flip} aria-label={t.nav.switchAria}
      lang={next} disabled={pending}>
      {t.nav.switchTo}
    </button>
  );
}
