"use server";

import { revalidatePath } from "next/cache";
import { addRow, parseInput, removeRow, sellRow, setDecision, updateRow, validDate, validTicker } from "@/lib/account";
import { DECISIONS, decisionCell, type Decision } from "@/lib/earnings";
import { authorized, done, sheetError, type ActionState } from "@/lib/actionUtils";
import { getT } from "@/lib/lang";

export type { ActionState };

/**
 * 차트 매수 팝업이 열릴 때 — 이 브라우저가 내계좌 비밀번호로 로그인돼 있는지.
 * 차트 페이지는 공개라 로그인 창을 안 띄운다. 브라우저는 /quant/account 에서 한 번 로그인하면 같은 /quant/ 아래 요청에
 * 그 비밀번호를 같이 보낸다 (아니면 팝업이 '내계좌 열기'를 안내한다).
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
    if (row > 1) await updateRow(row, String(form.get("expect") ?? ""), parsed.input);
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
    await removeRow(row, String(form.get("expect") ?? ""));
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
    const r = await sellRow(row, String(form.get("expect") ?? ""), form, t);
    if (r.error) return done(false, r.error);
  } catch (err) {
    return done(false, sheetError(err, t));
  }
  revalidatePath("/quant/account");
  return done(true, t.account.sold);
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
