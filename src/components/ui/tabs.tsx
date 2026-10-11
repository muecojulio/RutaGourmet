import {
  useCallback,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { useReducedMotion } from "@/lib/hooks";
import { useIndicator } from "@/components/ui/use-indicator";

/**
 * Accessible tab system: WAI-ARIA tabs pattern with a selection pill that
 * glides to the active tab, roving focus (arrow keys, Home/End), native
 * horizontal scrolling when tabs don't fit (active tab is centred, faded edges
 * hint at more content), and swipe between panels on touch screens — while
 * tabs remain the always-available alternative. The swipe itself lives in
 * `use-panel-swipe.ts`.
 */

export type TabDef = {
  id: string;
  label: string;
  shortLabel?: string;
  icon?: typeof import("lucide-react").Sparkles;
};

/** Tab defs are usually declared `as const` — accept readonly arrays. */
type TabsInput = readonly TabDef[];

const ACTIVATION_KEYS = ["ArrowLeft", "ArrowRight", "Home", "End"];

export function TabBar({
  tabs,
  value,
  onChange,
  ariaLabel,
  idBase,
  className,
  showOverflowHint = false,
}: {
  tabs: TabsInput;
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  /** Base id so each tab/panel pair gets matching aria ids. */
  idBase: string;
  className?: string;
  /** “Desliza” hint when both sides overflow (small lanes only). */
  showOverflowHint?: boolean;
}) {
  const { listRef, pillStyle } = useIndicator(value);
  const reducedMotion = useReducedMotion();

  /** Move selection and focus together (automatic activation). */
  const activate = useCallback(
    (id: string) => {
      onChange(id);
      listRef.current
        ?.querySelector<HTMLButtonElement>(`#${idBase}-tab-${id}`)
        ?.focus({ preventScroll: true });
    },
    [idBase, listRef, onChange],
  );

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!ACTIVATION_KEYS.includes(event.key)) return;
    event.preventDefault();
    const current = tabs.findIndex((tab) => tab.id === value);
    const last = tabs.length - 1;
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? last
          : event.key === "ArrowRight"
            ? current === last
              ? 0
              : current + 1
            : current === 0
              ? last
              : current - 1;
    activate(tabs[next].id);
  };

  // Keep the active tab visible when the lane scrolls horizontally.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`#${idBase}-tab-${value}`)?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [value, idBase, listRef, reducedMotion]);

  return (
    <div className={cn("relative min-w-0", className)}>
      <div
        ref={listRef}
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        className="lane no-scrollbar edge-fade relative rounded-full"
      >
        {/* The pill is a child of the scrollable lane so it rides along with
            the active tab even when the lane has been scrolled. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 z-0 h-10 -translate-y-1/2 rounded-full bg-primary shadow-[var(--shadow-glow)]"
          style={pillStyle}
        />
        {tabs.map((tab) => {
          const active = tab.id === value;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              id={`${idBase}-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={active}
              aria-controls={`${idBase}-panel-${tab.id}`}
              tabIndex={active ? 0 : -1}
              data-indicator={active ? "active" : undefined}
              onClick={() => onChange(tab.id)}
              className={cn(
                "press relative z-10 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium",
                active ? "text-primary-fg" : "text-muted hover:text-fg",
              )}
            >
              {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
              <span className="max-w-40 truncate">{tab.shortLabel ?? tab.label}</span>
            </button>
          );
        })}
      </div>
      {showOverflowHint ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-4 right-0 text-[10px] tracking-wide text-muted"
        >
          Desliza
        </span>
      ) : null}
    </div>
  );
}

/**
 * Panel with the matching aria wiring and a short slide+fade when it becomes
 * active. Stays mounted while hidden so list state (scroll, filters) survives
 * tab switches.
 */
export function TabPanel({
  idBase,
  tabId,
  active,
  labelledBy,
  className,
  children,
}: {
  idBase: string;
  tabId: string;
  active: boolean;
  /** Accessible name source — usually the panel's own visible heading id. */
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      id={`${idBase}-panel-${tabId}`}
      role="tabpanel"
      aria-labelledby={labelledBy}
      aria-hidden={!active}
      // Out of the tab order and out of assistive tech while hidden.
      inert={!active}
      hidden={!active}
      data-active={active}
      className={cn("min-h-0", active && "rise", className)}
    >
      {children}
    </div>
  );
}
