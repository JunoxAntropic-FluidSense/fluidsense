import { useSyncExternalStore } from "react";
import { useStore } from "../store/useStore";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

/**
 * framer-motion animates via inline transforms/WAAPI, so it ignores the
 * CSS-only `.reduce-motion` class toggle in AppShell (src/index.css). Any
 * motion-driven component must consult this instead to keep the
 * accessibility "reduce motion" setting effective.
 */
export function useReducedMotion() {
  const userPref = useStore((s) => s.currentUser.accessibility.reduceMotion);
  const osPref = useSyncExternalStore(subscribe, getSnapshot, () => false);
  return userPref || osPref;
}
