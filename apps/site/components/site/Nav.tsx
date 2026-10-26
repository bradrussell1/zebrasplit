import Link from "next/link";
import { Zebra } from "@/components/zebra";
import { Wordmark } from "./Wordmark";
import l from "@/components/layout/layout.module.css";
import s from "./nav.module.css";

/**
 * Logo → /, Features → /#features, Your zebra → /#zebra, FAQ → /faq, volt "Get the app" → /#get.
 * The logo starts on the text line; the row bleeds right so the pill ends on the surface line.
 * Links wrap on phones; no hamburger.
 */
export function Nav({ current }: { current?: "home" | "faq" }) {
  return (
    <header className={s.header}>
      <nav aria-label="Main" className="container inset">
        <div className={`${s.nav} ${l.reachRight}`}>
          <Link href="/" className={s.logo} aria-label="Zebrasplit home" data-align="text">
            <span className={s.disc} aria-hidden="true"><Zebra variant="bust" mood="happy" size={38} decorative /></span>
            <Wordmark />
          </Link>
          <div className={s.links}>
            <Link href="/#features" className={s.link}>Features</Link>
            <Link href="/#zebra" className={s.link}>Your zebra</Link>
            <Link href="/faq" className={s.link} aria-current={current === "faq" ? "page" : undefined}>FAQ</Link>
            <Link href="/#get" className={`${s.cta} pillFocus`} data-align-right="surface">Get the app</Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
