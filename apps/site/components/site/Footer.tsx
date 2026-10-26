import Link from "next/link";
import { Wordmark } from "./Wordmark";
import l from "@/components/layout/layout.module.css";
import s from "./footer.module.css";

/** Wordmark and legal line on the text line; the row bleeds right so the last link's text ends on the surface line. */
export function Footer({ current }: { current?: "privacy" | "terms" | "feedback" }) {
  return (
    <footer className={s.footer}>
      <div className="container inset">
        <div className={`${s.inner} ${l.reachRight}`}>
          <div className={s.brand} data-align="text">
            <Wordmark size="footer" />
            <span className={s.legal}>© 2026 Zebrasplit. Venmo and PayPal are trademarks of PayPal, Inc. Cash App is a trademark of Block, Inc. Zebrasplit is not affiliated with them.</span>
          </div>
          <nav aria-label="Footer" className={s.links}>
            <Link href="/privacy" className={s.link} aria-current={current === "privacy" ? "page" : undefined}>Privacy</Link>
            <Link href="/terms" className={s.link} aria-current={current === "terms" ? "page" : undefined}>Terms</Link>
            <Link href="/faq" className={s.link}>Support</Link>
            <Link href="/feedback" className={s.link} aria-current={current === "feedback" ? "page" : undefined} data-align-right="surface">Feedback</Link>
            {/* Press kit returns as a real link once a kit exists; a greyed placeholder read as broken.
                Admin is reached by URL (/admin): the approved design shows no footer link for it. */}
          </nav>
        </div>
      </div>
    </footer>
  );
}
