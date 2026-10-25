import { Accordion } from "@/components/ui/Accordion";
import { Button } from "@/components/ui/Button";
import { homepageFaq } from "@/content/faq";
import s from "./home.module.css";

/** Five questions from content/faq.ts (the same entries /faq shows), first one open. */
export function FaqPreview() {
  const items = homepageFaq();
  return (
    <section id="faq" className="section" aria-labelledby="faq-title">
      <div className={s.faqPreview}>
        <h2 id="faq-title" className="display">FAQ</h2>
        <Accordion items={items} defaultOpen={items[0]?.id ?? null} mode="single" />
        <Button variant="ink" size="md" href="/faq" className={s.seeAll}>See all FAQs</Button>
      </div>
    </section>
  );
}
