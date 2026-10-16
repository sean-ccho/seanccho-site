import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { LangToggle } from "@/components/LangToggle";
import { profile } from "@/content/profile";
import { getT } from "@/lib/lang";

export default async function HomePage() {
  const { lang, t } = await getT();
  return (
    <>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link href="/" className="brand">
            <BrandMark />
            <span>{profile.name}</span>
          </Link>
          <nav aria-label={t.nav.mainMenu} className="site-nav">
            <Link href="/" aria-current="page">
              {t.nav.home}
            </Link>
            <Link href="/quant">{t.nav.quant}</Link>
          </nav>
          <LangToggle />
        </div>
      </header>

      <main className="container page">
        <section aria-labelledby="projects-title">
          <div className="page-title">
            <h1 id="projects-title">{t.home.projects}</h1>
          </div>
          <div className="project-grid" style={{ marginTop: 12 }}>
            {profile.projects.map((p) => (
              <Link key={p.href} href={p.href} className="card project-card">
                {p.tag && (
                  <span className="badge badge--good" style={{ alignSelf: "flex-start" }}>
                    {p.tag[lang]}
                  </span>
                )}
                <h3>{p.title[lang]}</h3>
                <p>{p.description[lang]}</p>
                <span className="project-card__go">{t.home.open}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
