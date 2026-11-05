/**
 * 관리 탭 — 작업 예약(cron)에서 '다음 예약' · '오늘 예약' · '예약보다 얼마나 늦게 시작했나'를 계산한다 (2026-11-04).
 * GitHub 예약은 UTC 기준 cron, 이 Mac 의 신호(Account Watch)는 토론토 시계 기준이라 시간대를 같이 받는다.
 * 지원하는 꼴: '*', 숫자, 'a,b', 'a-b', '*\/n', 'a-b/n' (분 · 시 · 일 · 월 · 요일, 요일 0 = 일요일).
 */

export type Cron = { expr: string; tz: "UTC" | "America/Toronto" };

type Parsed = { min: Set<number>; hour: Set<number>; dom: Set<number>; mon: Set<number>; dow: Set<number>; domAny: boolean; dowAny: boolean };

function field(src: string, lo: number, hi: number): Set<number> {
  const out = new Set<number>();
  for (const part of src.split(",")) {
    const [range, stepStr] = part.split("/");
    const step = stepStr ? Number(stepStr) : 1;
    let a = lo;
    let b = hi;
    if (range !== "*") {
      const [x, y] = range.split("-").map(Number);
      a = x;
      b = y ?? (stepStr ? hi : x);
    }
    for (let v = a; v <= b; v += step) out.add(v === 7 && hi === 6 ? 0 : v);
  }
  return out;
}

const parsedCache = new Map<string, Parsed>();
function parse(expr: string): Parsed {
  let p = parsedCache.get(expr);
  if (!p) {
    const [mi, h, dom, mon, dow] = expr.trim().split(/\s+/);
    p = {
      min: field(mi, 0, 59), hour: field(h, 0, 23), dom: field(dom, 1, 31), mon: field(mon, 1, 12), dow: field(dow, 0, 6),
      domAny: dom === "*", dowAny: dow === "*",
    };
    parsedCache.set(expr, p);
  }
  return p;
}

/** 그 순간 토론토가 UTC 보다 몇 분 늦나 (EST 300 · EDT 240). */
function torontoOffsetMin(ms: number): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", timeZoneName: "shortOffset" }).formatToParts(ms);
  const m = /GMT([+-]\d+)(?::(\d+))?/.exec(parts.find((x) => x.type === "timeZoneName")?.value ?? "");
  if (!m) return 300;
  const h = Number(m[1]);
  return -(h * 60 + Math.sign(h || 1) * Number(m[2] ?? 0));
}

/** 그 시간대의 벽시계 시각 → UTC ms. */
function wallToUtc(tz: Cron["tz"], y: number, mo: number, d: number, h: number, mi: number): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  if (tz === "UTC") return guess;
  return guess + torontoOffsetMin(guess + 5 * 3600_000) * 60_000;
}

/** [from, to) 안의 예약 시각들 (UTC ms, 오름차순). 기간은 길어야 몇십 일. */
export function occurrences(crons: readonly Cron[], from: number, to: number): number[] {
  const out: number[] = [];
  for (const c of crons) {
    const p = parse(c.expr);
    // 그 시간대 달력 날짜로 하루씩 (서머타임 바뀌는 날도 날짜가 겹치거나 빠지지 않게 날짜 숫자로 센다 · 앞뒤 여유)
    const start = new Date(c.tz === "UTC" ? from : from - torontoOffsetMin(from) * 60_000);
    const days = Math.ceil((to - from) / 86400_000) + 2;
    for (let i = -2; i <= days; i++) {
      const dt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i));
      const y = dt.getUTCFullYear();
      const mo = dt.getUTCMonth() + 1;
      const d = dt.getUTCDate();
      const wd = dt.getUTCDay();
      if (!p.mon.has(mo)) continue;
      const domOk = p.dom.has(d);
      const dowOk = p.dow.has(wd);
      // 표준 cron: 일 · 요일이 둘 다 정해져 있으면 둘 중 하나만 맞아도 된다
      const dayOk = p.domAny && p.dowAny ? true : p.domAny ? dowOk : p.dowAny ? domOk : domOk || dowOk;
      if (!dayOk) continue;
      for (const h of p.hour) for (const mi of p.min) {
        const t = wallToUtc(c.tz, y, mo, d, h, mi);
        if (t >= from && t < to) out.push(t);
      }
    }
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/** 지금 뒤 첫 예약 (40일 안에 없으면 null). */
export function nextOccurrence(crons: readonly Cron[], now: number): number | null {
  return occurrences(crons, now, now + 40 * 86400_000)[0] ?? null;
}

/** t 이전 마지막 예약 (40일 안에 없으면 null) — 예약 실행이 얼마나 늦게 떴나 잴 때. */
export function prevOccurrence(crons: readonly Cron[], t: number): number | null {
  const list = occurrences(crons, t - 40 * 86400_000, t + 1);
  return list.length ? list[list.length - 1] : null;
}

/** 토론토 기준 그 날짜('YYYY-MM-DD') 0시의 UTC ms. */
export function torontoMidnight(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return wallToUtc("America/Toronto", y, m, d, 0, 0);
}
