"use server";

import { revalidatePath } from "next/cache";
import { authorized, done, sheetError, type ActionState } from "@/lib/actionUtils";
import { addJournal, parseJournalInput, removeJournal, updateJournal } from "@/lib/journal";
import { getT } from "@/lib/lang";

/** 매매 기록 추가(row 없음) 또는 수정(row + 원래 티커 expect). */
export async function saveJournal(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getT();
  if (!(await authorized())) return done(false, t.account.errAuth);
  const parsed = parseJournalInput(form, t);
  if ("error" in parsed) return done(false, parsed.error);
  const row = Number(form.get("row") || 0);
  try {
    if (row > 1) await updateJournal(row, String(form.get("expect") ?? ""), parsed.input);
    else await addJournal(parsed.input);
  } catch (err) {
    return done(false, sheetError(err, t));
  }
  revalidatePath("/quant/journal");
  return done(true, t.account.saved);
}

export async function deleteJournal(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getT();
  if (!(await authorized())) return done(false, t.account.errAuth);
  const row = Number(form.get("row") || 0);
  if (row < 2) return done(false, t.account.errChanged);
  try {
    await removeJournal(row, String(form.get("expect") ?? ""));
  } catch (err) {
    return done(false, sheetError(err, t));
  }
  revalidatePath("/quant/journal");
  return done(true, t.account.deleted);
}
