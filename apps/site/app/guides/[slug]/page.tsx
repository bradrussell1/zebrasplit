import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Accordion } from "@/components/ui/Accordion";
import { Card } from "@/components/ui/Card";
import { StoreBadges } from "@/components/site/StoreBadges";
import { faqById, faqPlainAnswer, type FaqItem } from "@/content/faq";
import { guideBySlug, guides } from "@/content/guides";
import { appStoreUrl, playStoreUrl, siteUrl } from "@/lib/env";
import { site } from "@/content/site";
import { GuideTile } from "../GuideTile";
import s from "../guides.module.css";

export const dynamicParams = false;
export function generateStaticParams() { return guides.map((g) => ({ slug: g.slug })); }

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const g = guideBySlug(slug);
  if (!g) return {};
  const path = `/guides/${g.slug}`;
  return {
    title: { absolute: g.title },
    description: g.description,
    alternates: { canonical: path },
    openGraph: { type: "article", title: g.title, description: g.description, url: path, siteName: site.name, modifiedTime: g.updated },
    twitter: { card: "summary_large_image", title: g.title, description: g.description },
  };
}

const longDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

export default async function GuidePage({ params }: Params) {
  const { slug } = await params;
  const g = guideBySlug(slug);
  if (!g) notFound();
  const url = `${siteUrl}/guides/${g.slug}`;
  const faqs = g.faqIds.map((id) => faqById(id)).filter((f): f is FaqItem => Boolean(f));
  const related = g.related.map((r) => guideBySlug(r)).filter((r) => r !== undefined);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: g.h1,
        description: g.description,
        dateModified: g.updated,
        datePublished: g.updated,
        mainEntityOfPage: url,
        image: `${siteUrl}/opengraph-image`,
        author: { "@type": "Organization", name: site.name, url: siteUrl },
        publisher: { "@type": "Organization", name: site.name, url: siteUrl, logo: { "@type": "ImageObject", url: `${siteUrl}/icons/512` } },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
          { "@type": "ListItem", position: 2, name: "Guides", item: `${siteUrl}/guides` },
          { "@type": "ListItem", position: 3, name: g.h1, item: url },
        ],
      },
      ...(faqs.length
        ? [{ "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: faqPlainAnswer(f) } })) }]
        : []),
    ],
  };

  return (
    <>
      <Nav />
      <main id="main">
        <article>
          <section className="container inset">
            <div className={`reading ${s.head}`}>
              <nav aria-label="Breadcrumb" className={s.crumbs}>
                <Link href="/guides">Guides</Link><span aria-hidden="true">/</span><span>{g.kind}</span>
              </nav>
              <h1 className="display display--legal">{g.h1}</h1>
              <p className={s.intro}>{g.intro}</p>
              <p className={s.updated}>Updated {longDate(g.updated)}</p>
            </div>
          </section>
          <section className="container inset">
            <div className={`reading ${s.content}`}>
              {g.sections.map((sec) => (
                <section key={sec.heading} className={s.block}>
                  <h2 className={s.h2}>{sec.heading}</h2>
                  {sec.paragraphs?.map((p) => <p key={p}>{p}</p>)}
                  {sec.steps ? <ol>{sec.steps.map((x) => <li key={x}>{x}</li>)}</ol> : null}
                  {sec.list ? <ul>{sec.list.map((x) => <li key={x}>{x}</li>)}</ul> : null}
                </section>
              ))}
              {faqs.length ? (
                <section className={s.block}>
                  <h2 className={s.h2}>Common questions</h2>
                  <Accordion items={faqs} mode="multiple" />
                </section>
              ) : null}
            </div>
          </section>
        </article>
        <section className="section" style={{ paddingTop: 72 }}>
          <Card variant="ink" className={`container ${s.get}`} style={{ paddingInline: "clamp(32px, 5vw, 56px)" }}>
            <div className={s.getCopy}>
              <h2 className="display display--feature">Split your next trip in Zebrasplit</h2>
              <p className={s.getSub}>Free, with no expense limits. Settle up once in Venmo, Cash App or PayPal.</p>
            </div>
            <StoreBadges urls={{ appStore: appStoreUrl, playStore: playStoreUrl }} location={`guide_${g.slug}`} onInk only="ios" size="lg" />
          </Card>
        </section>
        {related.length ? (
          <section className="container inset" style={{ paddingTop: 72 }}>
            <div className={s.content}>
              <h2 className={s.h2}>More guides</h2>
              <div className={s.more}>{related.map((r) => <GuideTile key={r.slug} guide={r} />)}</div>
            </div>
          </section>
        ) : null}
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
