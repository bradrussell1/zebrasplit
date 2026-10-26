import Link from "next/link";
import { Wordmark } from "./Wordmark";
import s from "./footer.module.css";

export function Footer({ current }: { current?: "privacy" | "terms" | "feedback" }) {
  return (
    <footer className={s.footer}>
      <div className={`container inset ${s.inner}`}>
        <div className={s.brand} data-align="text">
          <Wordmark size="footer" />
          <span className={s.legal}>© 2026 Zebrasplit. Venmo and PayPal are trademarks of PayPal, Inc. Cash App is a trademark of Block, Inc. Zebrasplit is not affiliated with them.</span>
        </div>
        <nav aria-label="Footer" className={s.links}>
          <Link href="/privacy" className={s.link} aria-current={current === "privacy" ? "page" : undefined}>Privacy</Link>
          <Link href="/terms" className={s.link} aria-current={current === "terms" ? "page" : undefined}>Terms</Link>
          <Link href="/faq" className={s.link}>Support</Link>
          <Link href="/feedback" className={s.link} aria-current={current === "feedback" ? "page" : undefined}>Feedback</Link>
          {/* Press kit returns as a real link once a kit exists; a greyed placeholder read as broken.
              Admin is reached by URL (/admin): the approved design shows no footer link for it. */}
        </nav>
      </div>
    </footer>
  );
}
