import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { useClickAway, useMediaQuery, useReducedMotion } from "@/lib/hooks";
import { classifyAxis, shouldCommitSwipe } from "@/lib/gestures";

/**
 * Swipe a card left to reveal contextual actions.
 *
 * Guarantees:
 * - Vertical page scroll is never cancelled: the card moves only when the
 *   gesture is clearly horizontal (~1.2× rule, `classifyAxis`).
 * - Gestures that start on buttons, links, fields, switches or anything with
 *   `data-no-swipe` belong to those controls, not to the card.
 * - Displacement is capped at the action panel width; open/close settles by
 *   travel (half the panel) or a quick flick.
 * - A click right after a drag is swallowed, so releasing a swipe never
 *   activates the card or a button under the finger.
 * - Hidden actions are `inert` + `aria-hidden`: never in the focus order, never
 *   announced as available while out of sight.
 * - Swipe is never the only path: a visible “···” button opens/closes the same
 *   actions, and on desktop the actions render inline directly.
 */

export type SwipeAction = {
  id: string;
  label: string;
  icon: ReactNode;
  tone?: "primary" | "danger" | "good";
  onClick: () => void;
};

/** Width of one revealed action — a comfortable 64 px touch target. */
const ACTION_WIDTH = 64;
/** Extra room past the actions so the last one is fully visible. */
const PANEL_PADDING = 8;

export function SwipeCard({
  actions,
  children,
  className,
  cardClassName,
  desktopInline = true,
  "aria-label": ariaLabel,
}: {
  actions: SwipeAction[];
  /** Card body; leave top-right padding for the “···” handle. */
  children: ReactNode;
  className?: string;
  cardClassName?: string;
  /** Render actions inline on desktop instead of behind a swipe. */
  desktopInline?: boolean;
  "aria-label"?: string;
}) {
  const isDesktop = useMediaQuery(desktopInline ? "(min-width: 1024px)" : "(min-width: 9999px)");
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [dragPx, setDragPx] = useState(0);
  const [dragging, setDragging] = useState(false);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useClickAway<HTMLDivElement>(() => setOpen(false));
  const gesture = useRef<{
    pointerId: number;
    x: number;
    y: number;
    t: number;
    axis: "idle" | "horizontal" | "vertical";
    moved: boolean;
  } | null>(null);
  /** A horizontal gesture happened: the next click on the card must die. */
  const suppressClick = useRef(false);

  const maxReveal = Math.min(2, actions.length) * ACTION_WIDTH + PANEL_PADDING;

  const onPointerDown = (event: ReactPointerEvent) => {
    if (isDesktop || event.pointerType === "mouse") return;
    const target = event.target as Element;
    if (
      target.closest(
        "button, a, input, textarea, select, label, summary, [role='switch'], [role='button'], [data-no-swipe]",
      )
    ) {
      return;
    }
    gesture.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      t: event.timeStamp,
      axis: "idle",
      moved: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    const state = gesture.current;
    if (!state || event.pointerId !== state.pointerId) return;
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (state.axis === "idle") {
      const verdict = classifyAxis(dx, dy, 10);
      if (verdict === "vertical") {
        gesture.current = null;
        setDragging(false);
        setDragPx(0);
        return;
      }
      if (verdict === "horizontal") {
        state.axis = "horizontal";
        setDragging(true);
        suppressClick.current = true;
      }
    }
    if (state.axis === "horizontal") {
      state.moved = true;
      event.preventDefault();
      // Only leftward reveal; pull-back past the closed edge resists.
      const offset = Math.max(-maxReveal, Math.min(0, (open ? -maxReveal : 0) + dx));
      setDragPx(offset);
    }
  };

  const finish = (event: ReactPointerEvent) => {
    const state = gesture.current;
    gesture.current = null;
    setDragging(false);
    if (!state || event.pointerId !== state.pointerId || state.axis !== "horizontal") return;
    const dx = event.clientX - state.x;
    const speed = dx / Math.max(1, event.timeStamp - state.t);
    const current = open ? -maxReveal : 0;
    const next = current + dx;
    const committed = shouldCommitSwipe(-dx, -speed, maxReveal / 2);
    const shouldOpen = committed ? next < current : next < -maxReveal / 2;
    setOpen(shouldOpen);
    setDragPx(shouldOpen ? -maxReveal : 0);
    // The click after a completed swipe dies on its own: suppressClick stays
    // true for this event turn and clears right after.
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  };

  // Escape closes the reveal — keyboard parity for the “···” toggle.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const onClickCapture = useCallback((event: ReactMouseEvent) => {
    if (!suppressClick.current) return;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const offset = dragging ? dragPx : open ? -maxReveal : 0;

  const actionButtons = (inline: boolean) =>
    actions.map((action) => (
      <button
        key={action.id}
        type="button"
        onClick={() => {
          action.onClick();
          setOpen(false);
        }}
        className={cn(
          "press grid touch-manipulation place-items-center gap-0.5 text-[10px] font-semibold",
          inline ? "h-10 rounded-full px-3.5" : "h-full w-full rounded-2xl",
          action.tone === "danger"
            ? "bg-danger/15 text-danger"
            : action.tone === "good"
              ? "bg-good/15 text-good"
              : "bg-primary/15 text-primary",
        )}
      >
        {action.icon}
        <span className="max-w-full truncate px-0.5">{action.label}</span>
      </button>
    ));

  if (isDesktop) {
    return (
      <div ref={containerRef} data-no-swipe className={className}>
        <div
          className={cn(
            "card-hover relative overflow-hidden rounded-3xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]",
            cardClassName,
          )}
        >
          {children}
          {actions.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Acciones del lugar">
              {actionButtons(true)}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-no-swipe
      className={cn("relative overflow-hidden rounded-3xl", className)}
      aria-label={ariaLabel}
    >
      {/* Revealed actions live *under* the card, right-aligned. */}
      {actions.length > 0 ? (
        <div
          aria-hidden={!open}
          inert={!open}
          className="absolute inset-y-2 right-2 flex items-stretch gap-1.5 rounded-3xl bg-surface-2/70 p-1"
          style={{ width: maxReveal }}
        >
          {actionButtons(false)}
        </div>
      ) : null}

      <div
        ref={cardRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onClickCapture={onClickCapture}
        style={{
          transform: `translateX(${offset}px)`,
          transition:
            dragging || reducedMotion ? "none" : "transform 220ms cubic-bezier(0.2, 0.7, 0.3, 1)",
        }}
        className={cn(
          "card-hover relative z-10 overflow-hidden rounded-3xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]",
          dragging ? "cursor-grabbing" : "",
          cardClassName,
        )}
      >
        {children}
        {actions.length > 0 ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? "Cerrar acciones" : "Ver acciones del lugar"}
            onClick={() => setOpen((value) => !value)}
            className="press absolute top-2.5 right-2.5 z-20 grid size-9 place-items-center rounded-full border border-line bg-bg/80 text-muted backdrop-blur hover:text-fg"
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
