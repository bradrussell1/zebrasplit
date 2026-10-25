import type { Metadata } from "next";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Hero } from "@/components/home/Hero";
import { ProblemBand } from "@/components/home/ProblemBand";
import { HowItWorks } from "@/components/home/HowItWorks";
import { ReceiptScan } from "@/components/home/ReceiptScan";
import { HerdDemo } from "@/components/home/HerdDemo";
import { PayYourWay } from "@/components/home/PayYourWay";
import { MeetYourZebra } from "@/components/home/MeetYourZebra";
import { Features } from "@/components/home/Features";
import { FreeBand } from "@/components/home/FreeBand";
import { FaqPreview } from "@/components/home/FaqPreview";
import { FinalCta } from "@/components/home/FinalCta";
import { appStoreUrl, playStoreUrl } from "@/lib/env";
import { site } from "@/content/site";

export const metadata: Metadata = { title: { absolute: site.title }, description: site.description, alternates: { canonical: "/" } };

/** The homepage (design/reference/site/v2/HomeV2.dc.html), section order as on the board. */
export default function HomePage() {
  const urls = { appStore: appStoreUrl, playStore: playStoreUrl };
  return (
    <>
      <Nav current="home" />
      <main id="main">
        <Hero urls={urls} />
        <ProblemBand />
        <HowItWorks />
        <ReceiptScan />
        <HerdDemo />
        <PayYourWay />
        <MeetYourZebra />
        <Features />
        <FreeBand />
        <FaqPreview />
        <FinalCta urls={urls} />
      </main>
      <Footer />
    </>
  );
}
