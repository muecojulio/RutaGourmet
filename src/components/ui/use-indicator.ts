import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/hooks";

/**
 * Measures the active item and returns a pill (left/width) that glides to it.
 * Shared by the tab bar and the segmented control so the animated selection
 * indicator behaves identically everywhere.
 *
 * `activeKey` (the current selection) re-runs the measurement: attribute moves
 * don't resize anything, so the ResizeObserver alone would never fire on
 * selection change.
 */
export function useIndicator(activeKey?: string) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [pill, setPill] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });
  const reducedMotion = useReducedMotion();

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const active =
      list.querySelector<HTMLElement>('[data-indicator="active"]') ??
      list.querySelector<HTMLElement>("[aria-checked='true']") ??
      list.querySelector<HTMLElement>("[aria-selected='true']");
    if (!active) return;
    setPill((prev) => {
      const next = { left: active.offsetLeft, width: active.offsetWidth, ready: true };
      if (prev.ready && prev.left === next.left && prev.width === next.width) return prev;
      return next;
    });
  }, []);

  // Re-measure when the active item changes and whenever the bar resizes
  // (font swap, viewport rotation, sidebar width).
  useEffect(() => {
    measure();
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    for (const child of Array.from(list.children)) observer.observe(child as Element);
    return () => observer.disconnect();
  }, [measure, activeKey]);

  return {
    listRef,
    measure,
    pillStyle: {
      transform: `translateX(${pill.left}px)`,
      width: pill.width,
      opacity: pill.ready ? 1 : 0,
      transition: reducedMotion
        ? "none"
        : "transform 220ms cubic-bezier(0.2, 0.7, 0.3, 1), width 220ms cubic-bezier(0.2, 0.7, 0.3, 1), opacity 150ms ease",
    } as const,
  };
}
