import type { Metadata } from "next";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { guides } from "@/content/guides";
import { GuideTile } from "./GuideTile";
import s from "./guides.module.css";

const description = "Practical guides to splitting group trip costs: rentals by night, restaurant bills by item, bachelorette and ski trips, and settling up in one payment each.";

export const metadata: Metadata = {
  title: "Guides to splitting trip costs",
  description,
  alternates: { canonical: "/guides" },
  openGraph: { title: "Guides to splitting trip costs · Zebrasplit", description, url: "/guides" },
};

export default function GuidesPage() {
  return (
    <>
      <Nav />
      <main id="main">
        <section className="container inset">
          <div className={`reading ${s.head}`}>
            <span className="eyebrow">Guides</span>
            <h1 className="display display--legal">Split the trip, step by step</h1>
            <p className={s.intro}>Short, practical answers to the money questions every group trip runs into.</p>
          </div>
        </section>
        <section className="container inset">
          <div className={s.more}>
            {guides.map((g) => <GuideTile key={g.slug} guide={g} />)}
          </div>
        </section>
      </main>
      <Footer current="guides" />
    </>
  );
}
