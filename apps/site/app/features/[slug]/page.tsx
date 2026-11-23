import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Accordion } from "@/components/ui/Accordion";
import { Card } from "@/components/ui/Card";
import { StoreBadges } from "@/components/site/StoreBadges";
import { ReceiptMock } from "@/components/home/ReceiptScan";
import { PayCard } from "@/components/home/PayCard";
import { CurrencyMock, NightsMock } from "@/components/features/mocks";
import { FeatureTile } from "@/components/features/FeatureTile";
import { GuideTile } from "@/app/guides/GuideTile";
import { faqById, faqPlainAnswer, type FaqItem } from "@/content/faq";
import { featureBySlug, features, type Feature } from "@/content/features";
import { guideBySlug } from "@/content/guides";
import { appStoreUrl, playStoreUrl, siteUrl } from "@/lib/env";
import { site } from "@/content/site";
import l from "@/components/layout/layout.module.css";
import h from "@/components/home/home.module.css";
import g from "@/app/guides/guides.module.css";
import s from "@/components/features/features.module.css";

export const dynamicParams = false;
export function generateStaticParams() { return features.map((f) => ({ slug: f.slug })); }

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const f = featureBySlug(slug);
  if (!f) return {};
  const path = `/features/${f.slug}`;
  return {
    title: { absolute: `${f.title} · ${site.name}` },
    description: f.description,
    alternates: { canonical: path },
    openGraph: { type: "website", title: f.title, description: f.description, url: path, siteName: site.name },
    twitter: { card: "summary_large_image", title: f.title, description: f.description },
  };
}

const PAY_APPS = ["Venmo", "Cash App", "PayPal"] as const;

function Visual({ feature }: { feature: Feature }) {
  switch (feature.visual) {
    case "receipt": return <ReceiptMock />;
    case "nights": return <NightsMock />;
    case "pay": return <PayCard apps={PAY_APPS} />;
    case "currency": return <CurrencyMock />;
  }
}

export default async function FeaturePage({ params }: Params) {
  const { slug } = await params;
  const f = featureBySlug(slug);
  if (!f) notFound();
  const url = `${siteUrl}/features/${f.slug}`;
  const urls = { appStore: appStoreUrl, playStore: playStoreUrl };
  const ink = f.band === "ink";
  const faqs = f.faqIds.map((id) => faqById(id)).filter((q): q is FaqItem => Boolean(q));
  const related = f.guides.map((r) => guideBySlug(r)).filter((r) => r !== undefined);
  const others = features.filter((o) => o.slug !== f.slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: f.title,
        headline: f.h1,
        description: f.description,
        dateModified: f.updated,
        isPartOf: { "@id": `${siteUrl}/#site` },
        about: { "@type": "MobileApplication", name: site.name, operatingSystem: "iOS", applicationCategory: "FinanceApplication", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, ...(appStoreUrl ? { installUrl: appStoreUrl } : {}) },
        publisher: { "@type": "Organization", name: site.name, url: siteUrl, logo: { "@type": "ImageObject", url: `${siteUrl}/icons/512` } },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
          { "@type": "ListItem", position: 2, name: f.nav, item: url },
        ],
      },
      ...(faqs.length
        ? [{ "@type": "FAQPage", mainEntity: faqs.map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: faqPlainAnswer(q) } })) }]
        : []),
    ],
  };

  return (
    <>
      <Nav feature={f.slug} />
      <main id="main">
        <article>
          <section className={s.hero}>
            <div className={l.container}>
              <div className={`${l.band} ${ink ? h.bandInk : h.bandWhite} ${l.split}`}>
                <div className={s.heroCopy}>
                  <span className={`eyebrow ${ink ? s.eyebrowOnInk : ""}`}>Features · {f.nav}</span>
                  <h1 className="display display--feature">{f.h1}</h1>
                  <p className={`${s.intro} ${ink ? s.introOnInk : ""}`}>{f.intro}</p>
                  <div className={s.badges}><StoreBadges urls={urls} location={`feature_${f.slug}_hero`} onInk={ink} only="ios" /></div>
                </div>
                <Visual feature={f} />
              </div>
            </div>
          </section>
          <section className={`container inset ${s.body}`}>
            <div className={`reading ${g.content}`}>
              {f.sections.map((sec) => (
                <section key={sec.heading} className={g.block}>
                  <h2 className={g.h2}>{sec.heading}</h2>
                  {sec.paragraphs?.map((p) => <p key={p}>{p}</p>)}
                  {sec.steps ? <ol>{sec.steps.map((x) => <li key={x}>{x}</li>)}</ol> : null}
                  {sec.list ? <ul>{sec.list.map((x) => <li key={x}>{x}</li>)}</ul> : null}
                </section>
              ))}
              {faqs.length ? (
                <section className={g.block}>
                  <h2 className={g.h2}>Common questions</h2>
                  <Accordion items={faqs} mode="multiple" />
                </section>
              ) : null}
            </div>
          </section>
        </article>
        <section className="section" style={{ paddingTop: 72 }}>
          <Card variant="ink" className={`container ${g.get}`} style={{ paddingInline: "clamp(32px, 5vw, 56px)" }}>
            <div className={g.getCopy}>
              <h2 className="display display--feature">Split your next trip in Zebrasplit</h2>
              <p className={g.getSub}>Free, with no expense limits. Settle up once in Venmo, Cash App or PayPal.</p>
            </div>
            <StoreBadges urls={urls} location={`feature_${f.slug}`} onInk only="ios" size="lg" />
          </Card>
        </section>
        {related.length ? (
          <section className={`container inset ${s.tiles}`}>
            <div className={g.content}>
              <h2 className={g.h2}>Guides that use it</h2>
              <div className={g.more}>{related.map((r) => <GuideTile key={r.slug} guide={r} />)}</div>
            </div>
          </section>
        ) : null}
        <section className={`container inset ${s.tiles}`}>
          <div className={g.content}>
            <h2 className={g.h2}>More features</h2>
            <div className={g.more}>{others.map((o) => <FeatureTile key={o.slug} feature={o} />)}</div>
          </div>
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
