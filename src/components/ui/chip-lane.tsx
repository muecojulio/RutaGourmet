import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

/**
 * Horizontal chip lane: native scroll + momentum + moderate snap (the browser
 * owns the gesture), visually hidden scrollbar, and overflow hints that appear
 * only while content actually overflows on that side — updated as the user
 * scrolls.
 */

export function ChipLane({
  label,
  className,
  children,
}: {
  /** Accessible group name, e.g. “Filtros”. */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const laneRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const sync = useCallback(() => {
    const lane = laneRef.current;
    if (!lane) return;
    const max = lane.scrollWidth - lane.clientWidth;
    setEdges({
      left: lane.scrollLeft > 4,
      right: lane.scrollLeft < max - 4,
    });
  }, []);

  useEffect(() => {
    sync();
    const lane = laneRef.current;
    if (!lane) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(sync);
    };
    lane.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(lane);
    return () => {
      lane.removeEventListener("scroll", onScroll);
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [sync]);

  return (
    <div
      role="group"
      aria-label={label}
      data-no-swipe
      className={cn("relative min-w-0", className)}
    >
      <div
        ref={laneRef}
        className="lane no-scrollbar gap-2"
        style={{
          maskImage:
            edges.left || edges.right
              ? `linear-gradient(to right, transparent 0, black ${edges.left ? 20 : 0}px, black calc(100% - ${edges.right ? 20 : 0}px), transparent 100%)`
              : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * A chip inside a lane. `selected` gets an accessible treatment (pressed state
 * + filled style + check), never color alone. A click that follows a drag
 * along the lane is ignored, so scrolling never activates a chip.
 */
export function Chip({
  selected = false,
  onClick,
  className,
  children,
  ...props
}: {
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "className" | "children">) {
  const downPos = useRef<{ x: number; y: number } | null>(null);

  const wasDrag = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const start = downPos.current;
    downPos.current = null;
    if (!start) return false;
    const moved = Math.abs(event.clientX - start.x) > 8 || Math.abs(event.clientY - start.y) > 8;
    return moved;
  };

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={(event) => {
        if (wasDrag(event)) return; // scroll gesture, not a tap
        onClick?.();
      }}
      onPointerDown={(event) => {
        downPos.current = { x: event.clientX, y: event.clientY };
      }}
      className={cn(
        "press inline-flex h-11 shrink-0 snap-start items-center gap-1.5 rounded-full px-4 text-sm font-medium",
        selected
          ? "bg-primary text-primary-fg shadow-[var(--shadow-glow)]"
          : "border border-line bg-surface text-muted hover:border-primary/40 hover:text-fg",
        className,
      )}
      {...props}
    >
      {children}
      {selected ? <span aria-hidden="true" className="size-1.5 rounded-full bg-current" /> : null}
    </button>
  );
}

/** Non-interactive stat chip (info, not a control). */
export function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "primary" | "good" | "saffron";
}) {
  return (
    <span
      className={cn(
        "inline-flex h-9 shrink-0 snap-start items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs",
        tone === "primary" && "border-primary/30 text-primary",
        tone === "good" && "border-good/30 text-good",
        tone === "saffron" && "border-saffron/30 text-saffron",
      )}
    >
      <strong className="font-semibold">{value}</strong>
      <span className="text-muted">{label}</span>
    </span>
  );
}
