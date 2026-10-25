"use client";
import { useEffect, useState, type RefObject } from "react";

/**
 * The one Reduce Motion check for the site (DESIGN_SYSTEM.md §9). Looping animations
 * (blink, bob, swish, z's) stop when this is true; dance and confetti become a 250 ms
 * fade or an instant state change. Starts false on the server and settles after hydration.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/**
 * True while the element is on screen (IntersectionObserver). Herds pause their loops when
 * false, so twelve zebras below the fold cost nothing. Starts true so the server render and
 * the first paint match; browsers without the observer stay true.
 */
export function useOnScreen(ref: RefObject<Element | null>, rootMargin = "80px"): boolean {
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => setOnScreen(entries.some((e) => e.isIntersecting)), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return onScreen;
}
