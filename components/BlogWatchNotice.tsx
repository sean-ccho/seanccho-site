import { fmtDate, money } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import type { BlogPost, BlogWatch } from "@/lib/valueModel";

/**
 * 예측 모델 맨 위 — 저자 블로그 새 글 · 커버리지 변경 (2026-11-11).
 * 문서 기록 탭(1~8절)은 고정 글이라, 매주 한 번 밤 실행(Project_1 web_export/blog_watch.py)이 저자 사이트맵 · 커버리지 페이지를 보고
 * 정리 안 된 새 글 · 정리한 뒤 고친 글 · 커버리지 차이를 남긴다. 소식이 없으면 한 줄, 있으면 상자. 정리는 사람이(Claude 에게).
 */
export function BlogWatchNotice({ watch, lang }: { watch: BlogWatch | null; lang: Lang }) {
  const d = (iso: string | null | undefined) => fmtDate(iso, lang);
  if (!watch) {
    return (
      <p className="vm-watch">
        저자 블로그 새 글 확인 — 매주 한 번 밤 실행이 사이트맵 · 커버리지 페이지를 본다 (아직 첫 확인 전).
        <span className="muted"> 문서 기록(1~8절)은 글 44개 · 11월 5일 기준.</span>
      </p>
    );
  }
  const diff = watch.coverage_diff;
  const covN = diff ? diff.added.length + diff.removed.length + diff.target.length + diff.rating.length : 0;
  const news = watch.new_posts.length + watch.edited_posts.length + covN;
  const when = (
    <span className="muted">
      {" "}
      — 확인 {d(watch.checked)} · 매주 한 번 (다음 {d(watch.next)}) · 문서 기록(1~8절)은 글 {watch.analyzed_posts}개 ·{" "}
      {d(watch.coverage_as_of)} 기준
    </span>
  );
  const errors = watch.errors.length > 0 && (
    <p className="vm-watch__err">
      확인 실패 ({d(watch.attempted)} 시도) — {watch.errors.join(" · ")}. 다음 밤에 다시 본다.
    </p>
  );
  if (news === 0) {
    return (
      <div className="vm-watch">
        <p>
          저자 블로그: 새 글 없음 · 커버리지 그대로
          {when}
        </p>
        {errors}
      </div>
    );
  }
  const list = (posts: BlogPost[]) => (
    <ul>
      {posts.map((p) => (
        <li key={p.slug}>
          <span className="vm-watch__date">{d(p.lastmod)}</span>
          <a href={p.url} target="_blank" rel="noopener noreferrer">
            {p.title} ↗
          </a>
        </li>
      ))}
    </ul>
  );
  return (
    <section className="vm-watch vm-watch--news" aria-label="저자 블로그 새 소식">
      <h2>저자 블로그 새 소식 {news}건 — 아직 정리 안 됨</h2>
      <p className="small">
        커버리지 변화는 다음 밤부터 &lsquo;세 분석가&rsquo;의 저자 목록에 저절로 들어간다. 새 글 · 고친 글은 문서 기록(1~8절)에
        아직 없다 — 정리는 Claude 에게 &lsquo;새 글 정리해줘&rsquo; (리서치 글이면 그 종목도 저자 목록에 더한다).
        {when}
      </p>
      {watch.new_posts.length > 0 && (
        <>
          <h3>새 글 {watch.new_posts.length}개</h3>
          {list(watch.new_posts)}
        </>
      )}
      {watch.edited_posts.length > 0 && (
        <>
          <h3>정리한 뒤 고친 글 {watch.edited_posts.length}개</h3>
          {list(watch.edited_posts)}
        </>
      )}
      {diff && covN > 0 && (
        <>
          <h3>
            커버리지 바뀜{" "}
            <a href={watch.coverage_url} target="_blank" rel="noopener noreferrer" className="small">
              저자 페이지 ↗
            </a>
          </h3>
          <ul>
            {diff.added.map((c) => (
              <li key={`a-${c.ticker}`}>
                추가 <b>{c.ticker}</b> · {c.rating ?? "의견 없음"} · 목표가 {money(c.target, c.ticker)}
              </li>
            ))}
            {diff.removed.map((c) => (
              <li key={`r-${c.ticker}`}>
                빠짐 <b>{c.ticker}</b> (우리 목록 목표가 {money(c.target, c.ticker)})
              </li>
            ))}
            {diff.target.map((c) => (
              <li key={`t-${c.ticker}`}>
                목표가 <b>{c.ticker}</b> {money(c.ours, c.ticker)} → {money(c.now, c.ticker)}
              </li>
            ))}
            {diff.rating.map((c) => (
              <li key={`g-${c.ticker}`}>
                의견 <b>{c.ticker}</b> {c.before} → {c.now}
              </li>
            ))}
          </ul>
        </>
      )}
      {errors}
    </section>
  );
}
