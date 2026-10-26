import type { Metadata } from "next";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { FeedbackForm } from "./FeedbackForm";
import s from "./feedback.module.css";

export const metadata: Metadata = {
  title: "Feedback",
  description: "Tell us what broke, what's missing, or what you'd change about Zebrasplit.",
  alternates: { canonical: "/feedback" },
};

export default function FeedbackPage() {
  return (
    <>
      <Nav />
      <main id="main">
        <section className="container inset">
          <div className={s.head}>
            <span className="eyebrow">Feedback</span>
            <h1 className="display display--page">Tell us what&apos;s wrong.</h1>
            <p className="body">
              Something broke, something&apos;s missing, something would be better another way — all of it is
              useful. A real person reads every one of these.
            </p>
          </div>
        </section>
        <section className="container inset">
          <FeedbackForm />
        </section>
      </main>
      <Footer />
    </>
  );
}
