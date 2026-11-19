// 내계좌 줄 지문 (2026-11-18) — 브라우저(AccountView 폼의 숨은 칸)와 서버(lib/account checkRow)가 같이 쓴다.
// 서버 전용 lib/account(시트 인증)를 브라우저 묶음에 끌어들이지 않으려고 따로 둔다.

/**
 * 티커 · 매수일 · 매수가 · 수량 · 매도일. 수정 · 삭제 · 매도 직전에 화면이 본 줄과 같은지 확인한다 — 티커만 보면
 * 같은 종목 줄이 여럿일 때(부분 매도로 생긴다) 시트에서 줄이 밀리면 다른 거래를 덮어쓰거나 지웠다.
 */
export function rowKey(r: { input: { ticker: string; buyDate: string; buyPrice: string; shares: string; sellDate: string } }): string {
  const i = r.input;
  return [i.ticker.toUpperCase(), i.buyDate, i.buyPrice, i.shares, i.sellDate].join("|");
}

/** 관심종목 줄 지문 — 티커 · 목표가 · 조건 · 추가일 (readWatchlist 가 맞춘 값, 2026-11-18). 같은 종목을 목표가 둘로 적어 둔 경우 등. */
export function watchKey(i: { ticker: string; target: string; cond: string; added: string }): string {
  return [i.ticker.toUpperCase(), i.target, i.cond, i.added].join("|");
}
