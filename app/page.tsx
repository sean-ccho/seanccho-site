import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { profile } from "@/content/profile";

export default function HomePage() {
  return (
    <>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link href="/" className="brand">
            <BrandMark />
            <span>{profile.name}</span>
          </Link>
          <nav aria-label="주요 메뉴" className="site-nav">
            <Link href="/" aria-current="page">
              홈
            </Link>
            <Link href="/quant">퀀트 대시보드</Link>
          </nav>
        </div>
      </header>

      <main className="container page">
        <section className="hero">
          <h1>{profile.name}</h1>
          <p>{profile.intro}</p>
          {profile.links.length > 0 && (
            <div className="links">
              {profile.links.map((l) => (
                <a key={l.href} className="btn" href={l.href} target="_blank" rel="noopener noreferrer">
                  {l.label} ↗
                </a>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="projects-title">
          <div className="section-head">
            <h2 id="projects-title">프로젝트</h2>
          </div>
          <div className="project-grid" style={{ marginTop: 12 }}>
            {profile.projects.map((p) => (
              <Link key={p.href} href={p.href} className="card project-card">
                {p.tag && (
                  <span className="badge badge--good" style={{ alignSelf: "flex-start" }}>
                    {p.tag}
                  </span>
                )}
                <h3>{p.title}</h3>
                <p>{p.description}</p>
                <span className="project-card__go">열기 →</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
