import { fmtDate, money } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import type { BlogWatch } from "@/lib/valueModel";

const L = {
  ko: {
    first: "리서치 새 노트 확인 — 매주 한 번 밤 실행이 리서치 목록을 본다 (아직 첫 확인 전).",
    firstSub: " 문서 기록(1~8절)은 노트 44개 · 11월 5일 기준.",
    when: (checked: string, next: string, n: number, asOf: string) =>
      `— 확인 ${checked} · 매주 한 번 (다음 ${next}) · 문서 기록(1~8절)은 노트 ${n}개 · ${asOf} 기준`,
    err: (d: string) => `확인 실패 (${d} 시도) — 다음 밤에 다시 본다.`,
    quiet: "리서치: 새 노트 없음 · 커버리지 그대로",
    aria: "리서치 새 소식",
    head: (n: number) => `리서치 새 소식 ${n}건 — 아직 정리 안 됨`,
    body1: "커버리지 변화는 다음 밤부터 분석가 보드의 리서치 목록에 저절로 들어간다. 새 노트 · 고친 노트는 문서 기록(1~8절)에 아직 없다 — 정리는 Claude 에게 ‘새 노트 정리해줘’ (종목 노트면 그 종목도 리서치 목록에 더한다).",
    newPosts: (n: number) => `새 노트 ${n}개`,
    edited: (n: number) => `정리한 뒤 고친 노트 ${n}개`,
    covChanged: "커버리지 바뀜",
    added: "추가",
    noRating: "의견 없음",
    target: "목표가",
    removed: "빠짐",
    ourTarget: "우리 목록 목표가",
    rating: "의견",
  },
  en: {
    first: "Checking for new research notes — a weekly overnight run looks at the research list (first check not yet done).",
    firstSub: " The documented record (sections 1–8) covers 44 notes as of Nov 5.",
    when: (checked: string, next: string, n: number, asOf: string) =>
      `— checked ${checked} · weekly (next ${next}) · documented record (sections 1–8) covers ${n} notes · as of ${asOf}`,
    err: (d: string) => `Check failed (attempted ${d}) — will retry next night.`,
    quiet: "Research: no new notes · coverage unchanged",
    aria: "New research updates",
    head: (n: number) => `${n} new research update${n === 1 ? "" : "s"} — not yet processed`,
    body1: "Coverage changes flow into the analyst board's research list automatically from the next night. New and edited notes are not yet in the documented record (sections 1–8) — ask Claude to “process the new notes” (for a ticker note, that ticker is added to the research list too).",
    newPosts: (n: number) => `${n} new note${n === 1 ? "" : "s"}`,
    edited: (n: number) => `${n} note${n === 1 ? "" : "s"} edited after processing`,
    covChanged: "Coverage changed",
    added: "Added",
    noRating: "no rating",
    target: "Target",
    removed: "Removed",
    ourTarget: "target in our list",
    rating: "Rating",
  },
};

/**
 * 예측 모델 맨 위 — 리서치 새 노트 · 커버리지 변경 (2026-11-11).
 * 문서 기록 탭(1~8절)은 고정 정리라, 매주 한 번 밤 실행(Project_1)이 리서치 목록을 보고 정리 안 된 새 노트 · 정리한 뒤
 * 고친 노트 · 커버리지 차이를 남긴다. 소식이 없으면 한 줄, 있으면 상자. 정리는 사람이(Claude 에게).
 * 2026-11-16 (사용자: 출처는 누구한테도 알리지 않는다) — 노트 제목 · 원문 링크는 보이지 않고 날짜 · 개수 · 종목만.
 */
export function BlogWatchNotice({ watch, lang }: { watch: BlogWatch | null; lang: Lang }) {
  const l = L[lang];
  const d = (iso: string | null | undefined) => fmtDate(iso, lang);
  if (!watch) {
    return (
      <p className="vm-watch">
        {l.first}
        <span className="muted">{l.firstSub}</span>
      </p>
    );
  }
  const diff = watch.coverage_diff;
  const covN = diff ? diff.added.length + diff.removed.length + diff.target.length + diff.rating.length : 0;
  const news = watch.new_posts.length + watch.edited_posts.length + covN;
  const when = (
    <span className="muted">
      {" "}
      {l.when(d(watch.checked), d(watch.next), watch.analyzed_posts, d(watch.coverage_as_of))}
    </span>
  );
  const errors = watch.errors.length > 0 && (
    <p className="vm-watch__err">
      {l.err(d(watch.attempted))}
    </p>
  );
  if (news === 0) {
    return (
      <div className="vm-watch">
        <p>
          {l.quiet}
          {when}
        </p>
        {errors}
      </div>
    );
  }
  const dates = (posts: { lastmod: string }[]) => posts.map((p) => d(p.lastmod)).join(" · ");
  return (
    <section className="vm-watch vm-watch--news" aria-label={l.aria}>
      <h2>{l.head(news)}</h2>
      <p className="small">
        {l.body1}
        {when}
      </p>
      {watch.new_posts.length > 0 && <h3>{l.newPosts(watch.new_posts.length)} <span className="muted small">{dates(watch.new_posts)}</span></h3>}
      {watch.edited_posts.length > 0 && (
        <h3>{l.edited(watch.edited_posts.length)} <span className="muted small">{dates(watch.edited_posts)}</span></h3>
      )}
      {diff && covN > 0 && (
        <>
          <h3>{l.covChanged}</h3>
          <ul>
            {diff.added.map((c) => (
              <li key={`a-${c.ticker}`}>
                {l.added} <b>{c.ticker}</b> · {c.rating ?? l.noRating} · {l.target} {money(c.target, c.ticker)}
              </li>
            ))}
            {diff.removed.map((c) => (
              <li key={`r-${c.ticker}`}>
                {l.removed} <b>{c.ticker}</b> ({l.ourTarget} {money(c.target, c.ticker)})
              </li>
            ))}
            {diff.target.map((c) => (
              <li key={`t-${c.ticker}`}>
                {l.target} <b>{c.ticker}</b> {money(c.ours, c.ticker)} → {money(c.now, c.ticker)}
              </li>
            ))}
            {diff.rating.map((c) => (
              <li key={`g-${c.ticker}`}>
                {l.rating} <b>{c.ticker}</b> {c.before} → {c.now}
              </li>
            ))}
          </ul>
        </>
      )}
      {errors}
    </section>
  );
}
