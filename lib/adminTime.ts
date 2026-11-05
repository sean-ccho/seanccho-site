/** 관리 화면 공통 시간 표시 (토론토) — 파이프라인 · 방문자 탭. */

export const TZ = "America/Toronto";
export const HM = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export const YMD = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
export const ms = (iso: string) => new Date(iso).getTime();

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export type Clock = { now: number; today: string; yesterday: string; tomorrow: string };

export function makeClock(now: number): Clock {
  const today = YMD.format(now);
  return { now, today, yesterday: addDays(today, -1), tomorrow: addDays(today, 1) };
}

/** '오늘 01:58' · '어제 19:30' · '내일 19:45' · '11-03 16:09' (토론토). */
export function when(t: number, c: Clock): string {
  const d = YMD.format(t);
  const hm = HM.format(t);
  if (d === c.today) return `오늘 ${hm}`;
  if (d === c.yesterday) return `어제 ${hm}`;
  if (d === c.tomorrow) return `내일 ${hm}`;
  return `${d.slice(5)} ${hm}`;
}

export function ago(t: number, now: number): string {
  const min = Math.max(0, Math.floor((now - t) / 60_000));
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  return h < 48 ? `${h}시간 전` : `${Math.floor(h / 24)}일 전`;
}
