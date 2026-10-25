import Link from "next/link";
import { Wordmark } from "./Wordmark";
import s from "./footer.module.css";

export function Footer({ current }: { current?: "privacy" | "terms" | "feedback" }) {
  return (
    <footer className={s.footer}>
      <div className={`container ${s.inner}`}>
        <div className={s.brand}>
          <Wordmark size="footer" />
          <span className={s.legal}>© 2026 Zebrasplit. Venmo and PayPal are trademarks of PayPal, Inc. Cash App is a trademark of Block, Inc. Zebrasplit is not affiliated with them.</span>
        </div>
        <nav aria-label="Footer" className={s.links}>
          <Link href="/privacy" className={s.link} aria-current={current === "privacy" ? "page" : undefined}>Privacy</Link>
          <Link href="/terms" className={s.link} aria-current={current === "terms" ? "page" : undefined}>Terms</Link>
          <Link href="/faq" className={s.link}>Support</Link>
          <Link href="/feedback" className={s.link} aria-current={current === "feedback" ? "page" : undefined}>Feedback</Link>
          {/* Press kit: placeholder until the kit exists (see report). */}
          <span className={`${s.link} ${s.placeholder}`} aria-disabled="true">Press kit<span className="srOnly"> (coming soon)</span></span>
          {/* Admin is a normal link: the portal is behind a Supabase session and every
              read is gated on public.is_admin(), so hiding it would buy nothing. */}
          <Link href="/admin" className={`${s.link} ${s.quiet}`}>Admin</Link>
        </nav>
      </div>
    </footer>
  );
}
