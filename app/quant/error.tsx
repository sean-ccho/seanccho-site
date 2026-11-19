"use client";

import { useEffect } from "react";

/**
 * 퀀트 화면 오류 경계 (2026-11-18) — 예전엔 app/ 아래 error.tsx 가 없어서, 자료 모양이 바뀌어 한 칸이 throw 하면
 * (예: 새 경기 지표 키) 페이지 전체가 Next 기본 오류 화면이 됐다. 머리 메뉴는 그대로 두고 이 칸만 바꿔 다시 시도하게 한다.
 * 문구는 한국어 · 영어 둘 다 (오류 중엔 언어 설정을 못 읽을 수 있다).
 */
export default function QuantError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[quant] page error", error);
  }, [error]);
  return (
    <main className="container page">
      <section className="card empty" role="alert">
        <h2 style={{ marginTop: 0 }}>이 화면을 그리다 오류가 났어요 · Something went wrong</h2>
        <p className="muted">
          자료 파일 모양이 바뀌었거나 잠깐 못 받았을 수 있어요. 다른 탭은 그대로 볼 수 있어요.
          {error.digest ? ` (오류 번호 ${error.digest})` : ""}
        </p>
        <button type="button" className="btn btn--primary" onClick={() => reset()}>다시 시도 · Retry</button>
      </section>
    </main>
  );
}
