"use server";

import { revalidatePath } from "next/cache";
import { addRow, parseInput, removeRow, sellRow, setDecision, setStop, updateRow, validDate, validTicker } from "@/lib/account";
import { DECISIONS, decisionCell, type Decision } from "@/lib/earnings";
import { authorized, done, sheetError, type ActionState } from "@/lib/actionUtils";
import { isCadListing, usd } from "@/lib/format";
import { getT } from "@/lib/lang";

export type { ActionState };

/**
 * 차트 매수 팝업이 열릴 때 — 이 브라우저가 관리자로 로그인돼 있는지 (구글 로그인, 2026-11-20).
 * 아니면 팝업이 '로그인' 버튼과 '다시 확인'을 안내한다.
 */
export async function canTrade(): Promise<boolean> {
  return authorized();
}

/** 추가(row 없음) 또는 수정(row + 원래 티커 expect). 차트 매수 팝업도 이걸로 추가한다. */
export async function saveRow(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getT();
  if (!(await authorized())) return done(false, t.account.errAuth);
  const parsed = parseInput(form, t);
  if ("error" in parsed) return done(false, parsed.error);
  const row = Number(form.get("row") || 0);
  try {
    if (row > 1) await updateRow(row, String(form.get("expect") ?? ""), parsed.input, String(form.get("key") ?? ""));
    else await addRow(parsed.input);
  } catch (err) {
    return done(false, sheetError(err, t));
  }
  revalidatePath("/quant/account");
  return done(true, t.account.saved);
}

export async function deleteRowAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getT();
  if (!(await authorized())) return done(false, t.account.errAuth);
  const row = Number(form.get("row") || 0);
  if (row < 2) return done(false, t.account.errChanged);
  try {
    await removeRow(row, String(form.get("expect") ?? ""), String(form.get("key") ?? ""));
  } catch (err) {
    return done(false, sheetError(err, t));
  }
  revalidatePath("/quant/account");
  return done(true, t.account.deleted);
}

/** 매도 기록 — 같은 줄을 매도 완료로 (일부만 팔면 판 수량은 새 줄, 원래 줄은 남은 수량). */
export async function sellAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getT();
  if (!(await authorized())) return done(false, t.account.errAuth);
  const row = Number(form.get("row") || 0);
  if (row < 2) return done(false, t.account.errChanged);
  try {
    const r = await sellRow(row, String(form.get("expect") ?? ""), form, t, String(form.get("key") ?? ""));
    if (r.error) return done(false, r.error);
  } catch (err) {
    return done(false, sheetError(err, t));
  }
  revalidatePath("/quant/account");
  return done(true, t.account.sold);
}

/**
 * 손절가 제안 버튼 (2026-11-26) — 손절가가 없는 보유 줄에 ATR×2 · −8% 값을 그대로 적는다 ('손절가' 칸만).
 * 장중 30분 계좌 감시 · 밤 메일이 바로 이 값으로 근접 · 아래 알림을 보낸다.
 */
export async function setStopAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getT();
  if (!(await authorized())) return done(false, t.account.errAuth);
  const row = Number(form.get("row") || 0);
  const ticker = String(form.get("expect") ?? "");
  const stop = Number(String(form.get("stop") ?? "").replace(/[$,]/g, ""));
  if (row < 2) return done(false, t.account.errChanged);
  if (!(Number.isFinite(stop) && stop > 0)) return done(false, t.account.errNumber(t.account.colStop));
  try {
    await setStop(row, ticker, stop, String(form.get("key") ?? ""));
  } catch (err) {
    return done(false, sheetError(err, t));
  }
  revalidatePath("/quant/account");
  const money = usd(stop, stop < 1 ? 4 : 2);
  return done(true, t.account.stopSaved(ticker.toUpperCase(), isCadListing(ticker) ? money.replace("$", "C$") : money));
}

/** 실적 대응 (2026-10-29) — 팔기·절반·그대로 · 그 실적일을 같은 종목 보유 줄들에. decision 이 비면 지운다. */
export async function decideAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getT();
  if (!(await authorized())) return done(false, t.account.errAuth);
  const ticker = String(form.get("ticker") ?? "").toUpperCase();
  const earn = String(form.get("earn") ?? "");
  const decision = String(form.get("decision") ?? "");
  const rows = String(form.get("rows") ?? "").split(",").map(Number).filter((n) => n > 1);
  if (!validTicker(ticker) || !validDate(earn) || !rows.length) return done(false, t.account.errChanged);
  if (decision && !(DECISIONS as readonly string[]).includes(decision)) return done(false, t.account.errChanged);
  try {
    await setDecision(rows.map((row) => ({ row, ticker })), decision ? decisionCell(decision as Decision, earn) : "");
  } catch (err) {
    return done(false, sheetError(err, t));
  }
  revalidatePath("/quant/account");
  return done(true, t.earn.saved);
}
