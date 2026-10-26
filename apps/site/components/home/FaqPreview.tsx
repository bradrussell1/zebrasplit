import { Accordion } from "@/components/ui/Accordion";
import { Button } from "@/components/ui/Button";
import { homepageFaq } from "@/content/faq";
import l from "@/components/layout/layout.module.css";
import s from "./home.module.css";

/** Five questions from content/faq.ts (the same entries /faq shows), first one open. Left-aligned on the text line, 820px wide. */
export function FaqPreview() {
  const items = homepageFaq();
  return (
    <section id="faq" className={`${l.section} section`} aria-labelledby="faq-title">
      <div className={`${l.container} ${l.inset} ${s.faqPreview}`}>
        <h2 id="faq-title" className="display" data-align="text">FAQ</h2>
        {/* the accordion cards pull out by the card padding so each question's text sits on the text line (2.4) */}
        <div className={`${l.cardGrid} ${s.faqList}`}>
          <Accordion items={items} defaultOpen={items[0]?.id ?? null} mode="single" alignFirst />
        </div>
        <Button variant="ink" size="md" href="/faq" className={s.seeAll}>See all FAQs</Button>
      </div>
    </section>
  );
}
