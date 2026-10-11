import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { useMediaQuery, useReducedMotion } from "@/lib/hooks";

/**
 * Snap carousel for comparing/exploring a set of cards on small screens.
 * - Native scroll + scroll-snap; the next card peeks in to suggest more.
 * - Dots double as accessible controls (buttons with labels + aria-current).
 * - Arrow buttons give pointer/keyboard users explicit steps.
 * - On large screens (`gridAt`) it becomes a grid — the carousel steps aside
 *   when it stops being useful and never causes page-level horizontal scroll.
 */
export function Carousel({
  label,
  gridAt = "(min-width: 1024px)",
  className,
  children,
}: {
  /** Accessible name for the carousel region. */
  label: string;
  /** Media query at which the carousel becomes a grid. */
  gridAt?: string;
  className?: string;
  children: ReactNode;
}) {
  const items = Children.toArray(children);
  const count = items.length;
  const laneRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [edges, setEdges] = useState({ prev: false, next: count > 1 });
  const reducedMotion = useReducedMotion();
  const isGrid = useMediaQuery(gridAt);

  const sync = useCallback(() => {
    const lane = laneRef.current;
    if (!lane || lane.clientWidth === 0) return;
    const step = lane.scrollWidth / count;
    setActive(Math.min(count - 1, Math.round(lane.scrollLeft / step)));
    const max = lane.scrollWidth - lane.clientWidth;
    setEdges({ prev: lane.scrollLeft > 4, next: lane.scrollLeft < max - 4 });
  }, [count]);

  useEffect(() => {
    sync();
    const lane = laneRef.current;
    if (!lane || isGrid) return;
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
  }, [sync, isGrid, count]);

  const goTo = useCallback(
    (index: number) => {
      const lane = laneRef.current;
      if (!lane) return;
      const step = lane.scrollWidth / count;
      lane.scrollTo({
        left: Math.max(0, Math.min(lane.scrollWidth, index * step)),
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    [count, reducedMotion],
  );

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carrusel"
      aria-label={label}
      className={cn("relative min-w-0", className)}
      data-no-swipe
    >
      <div
        ref={laneRef}
        className={cn(
          isGrid
            ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            : "lane no-scrollbar -mx-1 scroll-px-4 gap-3 px-1 py-1",
        )}
        style={isGrid ? undefined : { scrollSnapType: "x mandatory" }}
      >
        {items.map((item, index) => (
          <div
            key={index}
            className={isGrid ? "" : "w-[82%] max-w-80 shrink-0"}
            style={isGrid ? undefined : { scrollSnapAlign: index === 0 ? "start" : "center" }}
          >
            {item}
          </div>
        ))}
      </div>

      {!isGrid ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5" role="group" aria-label={`${label}: páginas`}>
            {items.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Ir al elemento ${index + 1} de ${count}`}
                aria-current={index === active || undefined}
                onClick={() => goTo(index)}
                className={cn(
                  "press grid size-6 place-items-center rounded-full",
                  index === active ? "text-primary" : "text-line hover:text-muted",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "rounded-full transition-all",
                    index === active ? "size-2 bg-primary" : "size-1.5 bg-current",
                  )}
                />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Anterior"
              disabled={!edges.prev}
              onClick={() => goTo(active - 1)}
              className="press grid size-9 place-items-center rounded-full border border-line bg-surface text-fg disabled:opacity-40"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Siguiente"
              disabled={!edges.next}
              onClick={() => goTo(active + 1)}
              className="press grid size-9 place-items-center rounded-full border border-line bg-surface text-fg disabled:opacity-40"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
