import { readVisitors, robotHints, type VisitEvent } from "@/lib/visits";

export const dynamic = "force-dynamic";

/**
 * 임시 (2026-11-26 저녁) — 방문자 탭의 로봇 같은 방문이 언제 · 어떤 순서로 · 어디를 읽어 가는지 거꾸로 따라가 보려고,
 * 저장된 방문 기록 전부(최근 5,000건)를 방문 단위로 묶어서 Vercel 로그에만 남긴다. 응답은 늘 본문 없음(204) — 누가 불러도
 * 아무것도 안 보인다. 저장된 기록엔 원래 IP 가 없다. 확인 끝나면 이 파일을 지운다.
 */
const ET = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const when = (t: number) => ET.format(t).replace(",", "");
const short = (p: string) => p.replace(/^\/quant\/stock\//, "s:").replace(/^\/quant\/?/, "q/");

export async function GET(): Promise<Response> {
  const { events, error, mode } = await readVisitors(Date.now(), 5000);
  const asc = [...events].reverse();
  const sessions = new Map<string, VisitEvent[]>();
  for (const e of asc) sessions.set(e.s, [...(sessions.get(e.s) ?? []), e]);

  const uaIds = new Map<string, number>();
  const uaOf = (ua?: string) => {
    if (!ua) return -1;
    if (!uaIds.has(ua)) uaIds.set(ua, uaIds.size);
    return uaIds.get(ua) ?? -1;
  };

  const rows: string[] = [];
  for (const list of sessions.values()) {
    const a = list[0];
    const first = list.find((e) => e.f) ?? a;
    const t0 = a.t;
    const paths = list.slice(0, 10).map((e) => `${short(e.p)}@${Math.round((e.t - t0) / 1000)}`);
    rows.push(
      [
        when(t0),
        a.v.slice(0, 6),
        list.length,
        `${a.cc}/${a.rg}/${a.ci}`,
        `${a.d}/${a.b}`,
        first.w ?? "",
        first.z ?? "",
        first.iz ?? "",
        a.l,
        first.r || "-",
        first.u || "-",
        first.n ? "new" : `g${first.g ?? "?"}`,
        `ua${uaOf(first.ua)}`,
        `h${robotHints(first).length}`,
        paths.join(" ") + (list.length > 10 ? ` +${list.length - 10}` : ""),
      ].join("|"),
    );
  }

  console.log(
    "[who-dump]",
    JSON.stringify({
      mode,
      error,
      events: events.length,
      sessions: sessions.size,
      people: new Set(events.map((e) => e.v)).size,
      oldest: asc[0] ? when(asc[0].t) : null,
      newest: asc.at(-1) ? when(asc.at(-1)!.t) : null,
    }),
  );
  // 방문 하나 = 한 줄 (로그 화면이 긴 줄을 잘라서)
  rows.forEach((r, i) => console.log(`[who-dump] S${String(i).padStart(2, "0")} ${r}`));
  for (const [ua, id] of uaIds) console.log(`[who-dump] UA${id} ${ua.slice(0, 400)}`);
  return new Response(null, { status: 204 });
}
