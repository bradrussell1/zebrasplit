"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import s from "./nav.module.css";

export type FeatureLink = { slug: string; label: string; blurb: string };

/**
 * "Features" in the nav is not a link: it is a disclosure button that shows the feature pages.
 * A mouse opens it by hovering and closes it by leaving; a tap or Enter/Space toggles it (touch
 * has no hover); Escape, a click elsewhere, or focus moving away closes it. Clicking while the
 * pointer is already hovering leaves it open instead of flickering shut.
 */
export function FeaturesMenu({ items, current }: { items: FeatureLink[]; current?: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const hovering = useRef(false);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      if (wrap.current?.contains(document.activeElement)) button.current?.focus();
    };
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [open]);

  return (
    <div
      ref={wrap}
      className={s.menuWrap}
      onPointerEnter={(e) => { if (e.pointerType === "mouse") { hovering.current = true; setOpen(true); } }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") { hovering.current = false; setOpen(false); } }}
      onBlur={(e) => { if (!wrap.current?.contains(e.relatedTarget as Node | null)) setOpen(false); }}
    >
      <button
        ref={button}
        type="button"
        className={`${s.link} ${s.menuButton}`}
        aria-expanded={open}
        aria-controls={id}
        data-current={current ? "" : undefined}
        onClick={() => setOpen((o) => (hovering.current ? true : !o))}
      >
        Features
        <svg className={s.chevron} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" /></svg>
      </button>
      <div id={id} className={s.menu} hidden={!open}>
        <ul className={s.menuList}>
          {items.map((f) => (
            <li key={f.slug}>
              <Link href={`/features/${f.slug}`} className={s.menuItem} aria-current={current === f.slug ? "page" : undefined} onClick={() => setOpen(false)}>
                <span className={s.menuLabel}>{f.label}</span>
                <span className={s.menuBlurb}>{f.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
