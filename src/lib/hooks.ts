import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Shared client hooks.
 *
 * `useMediaQuery` and `useClickAway` are adapted (TypeScript, SSR-safe) from
 * two MIT-licensed public repositories, per the project convention of copying
 * proven utilities from public GitHub instead of reinventing them:
 * - useMediaQuery  ← https://github.com/juliencrn/usehooks-ts (MIT)
 * - useClickAway   ← https://github.com/uidotdev/usehooks (MIT)
 */

const IS_SERVER = typeof window === "undefined";

/** Track a CSS media query with the Match Media API (SSR-safe). */
export function useMediaQuery(query: string, defaultValue = false): boolean {
  const getMatches = useCallback(
    () => (IS_SERVER ? defaultValue : window.matchMedia(query).matches),
    [query, defaultValue],
  );

  const [matches, setMatches] = useState(getMatches);

  useLayoutEffect(() => {
    const list = window.matchMedia(query);
    const handleChange = () => setMatches(list.matches);
    handleChange();
    list.addEventListener("change", handleChange);
    return () => list.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

/** True when the user asked the OS for reduced motion. */
export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/** Call `cb` when a pointer event lands outside the returned ref's element. */
export function useClickAway<T extends HTMLElement>(cb: (event: PointerEvent) => void) {
  const ref = useRef<T | null>(null);
  const cbRef = useRef(cb);

  useLayoutEffect(() => {
    cbRef.current = cb;
  });

  useEffect(() => {
    const handler = (event: PointerEvent) => {
      const element = ref.current;
      if (element && !element.contains(event.target as Node)) cbRef.current(event);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, []);

  return ref;
}
