/** dashboard.json 을 못 읽었을 때. */
export function NoData() {
  return (
    <main className="container page">
      <section className="card empty">
        <h1 style={{ fontSize: 20 }}>아직 데이터를 불러오지 못했어요</h1>
        <p style={{ margin: "8px 0 0" }}>
          Project_1 의 매일 실행이 <code>dashboard-data</code> 브랜치에 <code>dashboard.json</code> 을 올리면
          30분 안에 이 화면이 채워집니다.
        </p>
      </section>
    </main>
  );
}
