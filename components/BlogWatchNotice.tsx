import { fmtDate, money } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import type { BlogWatch } from "@/lib/valueModel";

/**
 * 예측 모델 맨 위 — 리서치 새 노트 · 커버리지 변경 (2026-11-11).
 * 문서 기록 탭(1~8절)은 고정 정리라, 매주 한 번 밤 실행(Project_1)이 리서치 목록을 보고 정리 안 된 새 노트 · 정리한 뒤
 * 고친 노트 · 커버리지 차이를 남긴다. 소식이 없으면 한 줄, 있으면 상자. 정리는 사람이(Claude 에게).
 * 2026-11-16 (사용자: 출처는 누구한테도 알리지 않는다) — 노트 제목 · 원문 링크는 보이지 않고 날짜 · 개수 · 종목만.
 */
export function BlogWatchNotice({ watch, lang }: { watch: BlogWatch | null; lang: Lang }) {
  const d = (iso: string | null | undefined) => fmtDate(iso, lang);
  if (!watch) {
    return (
      <p className="vm-watch">
        리서치 새 노트 확인 — 매주 한 번 밤 실행이 리서치 목록을 본다 (아직 첫 확인 전).
        <span className="muted"> 문서 기록(1~8절)은 노트 44개 · 11월 5일 기준.</span>
      </p>
    );
  }
  const diff = watch.coverage_diff;
  const covN = diff ? diff.added.length + diff.removed.length + diff.target.length + diff.rating.length : 0;
  const news = watch.new_posts.length + watch.edited_posts.length + covN;
  const when = (
    <span className="muted">
      {" "}
      — 확인 {d(watch.checked)} · 매주 한 번 (다음 {d(watch.next)}) · 문서 기록(1~8절)은 노트 {watch.analyzed_posts}개 ·{" "}
      {d(watch.coverage_as_of)} 기준
    </span>
  );
  const errors = watch.errors.length > 0 && (
    <p className="vm-watch__err">
      확인 실패 ({d(watch.attempted)} 시도) — 다음 밤에 다시 본다.
    </p>
  );
  if (news === 0) {
    return (
      <div className="vm-watch">
        <p>
          리서치: 새 노트 없음 · 커버리지 그대로
          {when}
        </p>
        {errors}
      </div>
    );
  }
  const dates = (posts: { lastmod: string }[]) => posts.map((p) => d(p.lastmod)).join(" · ");
  return (
    <section className="vm-watch vm-watch--news" aria-label="리서치 새 소식">
      <h2>리서치 새 소식 {news}건 — 아직 정리 안 됨</h2>
      <p className="small">
        커버리지 변화는 다음 밤부터 분석가 보드의 리서치 목록에 저절로 들어간다. 새 노트 · 고친 노트는 문서 기록(1~8절)에
        아직 없다 — 정리는 Claude 에게 &lsquo;새 노트 정리해줘&rsquo; (종목 노트면 그 종목도 리서치 목록에 더한다).
        {when}
      </p>
      {watch.new_posts.length > 0 && <h3>새 노트 {watch.new_posts.length}개 <span className="muted small">{dates(watch.new_posts)}</span></h3>}
      {watch.edited_posts.length > 0 && (
        <h3>정리한 뒤 고친 노트 {watch.edited_posts.length}개 <span className="muted small">{dates(watch.edited_posts)}</span></h3>
      )}
      {diff && covN > 0 && (
        <>
          <h3>커버리지 바뀜</h3>
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
