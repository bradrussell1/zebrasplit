import { useEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * A number that changes once every time the app comes back to the foreground, and at
 * no other time.
 *
 * A dazzle can have any number of members but only twelve zebras are ever drawn, so
 * which eleven stand beside you has to be re-rolled regularly or the same people are
 * always the ones nobody sees (A10b). Re-rolling on every render would reshuffle the
 * field under the reader's thumb; re-rolling on a timer would do it mid-glance. The
 * moment the app is picked up is the one time nobody is looking.
 */
export function useForegroundSeed(): number {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  useEffect(() => {
    let was = AppState.currentState;
    const sub = AppState.addEventListener("change", (next) => {
      if (was.match(/inactive|background/) && next === "active") {
        setSeed(Math.floor(Math.random() * 0x7fffffff));
      }
      was = next;
    });
    return () => sub.remove();
  }, []);
  return seed;
}
