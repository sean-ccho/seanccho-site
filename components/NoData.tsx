import { getT } from "@/lib/lang";

/** dashboard.json 을 못 읽었을 때. */
export async function NoData() {
  const { lang, t } = await getT();
  return (
    <main className="container page">
      <section className="card empty">
        <h1 style={{ fontSize: 20 }}>{t.noData.title}</h1>
        <p style={{ margin: "8px 0 0" }}>
          {lang === "en" ? (
            <>
              This fills in as soon as Project_1&apos;s daily run pushes <code>dashboard.json</code> to the{" "}
              <code>dashboard-data</code> branch (within an hour even if the refresh ping fails).
            </>
          ) : (
            <>
              Project_1 의 매일 실행이 <code>dashboard-data</code> 브랜치에 <code>dashboard.json</code> 을 올리고
              끝나면 바로 이 화면이 채워집니다 (갱신 알림이 실패해도 1시간 안에).
            </>
          )}
        </p>
      </section>
    </main>
  );
}
