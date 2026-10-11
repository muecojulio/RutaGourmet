import { useCallback, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/hooks";
import { classifyAxis, shouldCommitSwipe, swipeDirection } from "@/lib/gestures";

/** Elements a panel-swipe must never steal a gesture from. */
const SWIPE_BLOCKED_SELECTOR = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "label",
  "summary",
  "[role='button']",
  "[role='switch']",
  "[role='tablist']",
  "[role='combobox']",
  "[role='listbox']",
  "[data-no-swipe]",
].join(", ");

/**
 * Horizontal swipe on a tab panel container switches sections.
 *
 * - Axis lock: the gesture only becomes a swipe when horizontal travel beats
 *   vertical by ~1.2× (see `classifyAxis`), so vertical page scroll stays
 *   native — the browser keeps control of vertical drags.
 * - Gestures starting on buttons, links, fields, switches or anything marked
 *   `data-no-swipe` are never hijacked.
 * - Commit needs real travel (≥56 px) or a quick flick; reduced motion jumps
 *   straight to the target section without the visual drag.
 */
export function usePanelSwipe(options: {
  value: string;
  ids: string[];
  onChange: (id: string) => void;
  enabled?: boolean;
}) {
  const { value, ids, onChange, enabled = true } = options;
  const reducedMotion = useReducedMotion();
  const gesture = useRef<{
    pointerId: number;
    x: number;
    y: number;
    t: number;
    axis: "idle" | "horizontal" | "vertical";
  } | null>(null);
  const [dragPx, setDragPx] = useState(0);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!enabled || event.pointerType === "mouse") return;
      const target = event.target as Element;
      if (target.closest(SWIPE_BLOCKED_SELECTOR)) return;
      gesture.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        t: event.timeStamp,
        axis: "idle",
      };
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const state = gesture.current;
      if (!state || event.pointerId !== state.pointerId) return;
      const dx = event.clientX - state.x;
      const dy = event.clientY - state.y;
      if (state.axis === "idle") {
        const verdict = classifyAxis(dx, dy, 12);
        if (verdict === "vertical") {
          gesture.current = null;
          setDragPx(0);
          return;
        }
        if (verdict === "horizontal") state.axis = "horizontal";
      }
      if (state.axis === "horizontal") {
        event.preventDefault();
        // Resistance past the ends: the lane feels elastic, not infinite.
        const index = ids.indexOf(value);
        const atStart = index <= 0 && dx > 0;
        const atEnd = index >= ids.length - 1 && dx < 0;
        setDragPx(atStart || atEnd ? dx * 0.25 : Math.max(-96, Math.min(96, dx)));
      }
    },
    [ids, value],
  );

  const finish = useCallback(
    (event: React.PointerEvent) => {
      const state = gesture.current;
      gesture.current = null;
      setDragPx(0);
      if (!state || event.pointerId !== state.pointerId || state.axis !== "horizontal") return;
      const dx = event.clientX - state.x;
      const speed = dx / Math.max(1, event.timeStamp - state.t);
      if (!shouldCommitSwipe(dx, speed, 56)) return;
      const index = ids.indexOf(value);
      const direction = swipeDirection(dx, speed);
      const next = index + direction;
      if (next >= 0 && next < ids.length) onChange(ids[next]);
    },
    [ids, onChange, value],
  );

  // The panel never visually drags under reduced motion; the switch just
  // happens when the gesture commits.
  const dragStyle: React.CSSProperties =
    !reducedMotion && dragPx !== 0
      ? {
          transform: `translateX(${dragPx * 0.4}px)`,
          transition: "transform 60ms linear",
        }
      : {};

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish },
    dragStyle,
  };
}
