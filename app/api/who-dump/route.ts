import { readVisitors, robotHints, type VisitEvent } from "@/lib/visits";

export const dynamic = "force-dynamic";

/**
 * 임시 (2026-11-25 저녁) — 방문자 탭에 찍힌 미국(뉴욕) 방문이 누군지 지난 24시간치를 묶어서 Vercel 로그에만 남긴다.
 * 응답은 늘 본문 없음(204) — 누가 불러도 아무것도 안 보인다. 저장된 기록엔 원래 IP 가 없다. 확인 끝나면 이 파일을 지운다.
 */
export async function GET(): Promise<Response> {
  const now = Date.now();
  const { events, error, mode } = await readVisitors(now, 5000);
  const us = events.filter((e) => e.cc === "US" && e.t >= now - 24 * 3_600_000);
  const groups = new Map<string, VisitEvent[]>();
  for (const e of us) {
    const k = [e.rg, e.ci, e.d, e.b].join("|");
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  console.log("[who-dump]", JSON.stringify({ mode, error, total: events.length, us24h: us.length, groups: groups.size }));
  const uniq = (xs: (string | undefined)[], n: number) => [...new Set(xs.map((x) => x ?? ""))].slice(0, n);
  for (const [k, list] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    const firsts = list.filter((e) => e.f);
    console.log(
      "[who-dump]",
      JSON.stringify({
        k,
        n: list.length,
        people: new Set(list.map((e) => e.v)).size,
        visits: new Set(list.map((e) => e.s)).size,
        from: new Date(Math.min(...list.map((e) => e.t))).toISOString(),
        to: new Date(Math.max(...list.map((e) => e.t))).toISOString(),
        r: uniq(list.map((e) => e.r), 5),
        paths: uniq(list.map((e) => e.p), 12),
        ua: uniq(firsts.map((e) => e.ua?.slice(0, 220)), 3),
        z: uniq(firsts.map((e) => e.z), 3),
        iz: uniq(firsts.map((e) => e.iz), 3),
        w: uniq(firsts.map((e) => e.w), 4),
        l: uniq(list.map((e) => e.l), 3),
        hints: uniq(firsts.flatMap((e) => robotHints(e)), 4),
      }),
    );
  }
  return new Response(null, { status: 204 });
}
