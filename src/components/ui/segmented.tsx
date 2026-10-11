import { useCallback, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useIndicator } from "@/components/ui/use-indicator";

/**
 * Segmented control (radio group) with the same gliding-thumb micro-interaction
 * as the tab bar. Full radio semantics: roving tabindex, ArrowLeft/Right,
 * Home/End, `aria-checked` on the options.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  /** Accessible name, e.g. “Modo de viaje”. */
  label: string;
  options: Array<{ id: T; label: string; icon?: ReactNode }>;
  value: T;
  onChange: (id: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const { listRef, pillStyle } = useIndicator(value);

  const activate = useCallback(
    (id: T) => {
      onChange(id);
      listRef.current
        ?.querySelector<HTMLButtonElement>(`[data-seg-id="${id}"]`)
        ?.focus({ preventScroll: true });
    },
    [listRef, onChange],
  );

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = options.findIndex((option) => option.id === value);
    const last = options.length - 1;
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
    activate(options[next].id);
  };

  return (
    <div
      ref={listRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "relative grid auto-cols-fr grid-flow-col rounded-full border border-line bg-surface-2 p-1",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1 bottom-1 left-0 z-0 rounded-full bg-surface shadow-[var(--shadow-card)]"
        style={pillStyle}
      />
      {options.map((option) => {
        const on = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-seg-id={option.id}
            data-indicator={on ? "active" : undefined}
            onClick={() => onChange(option.id)}
            className={cn(
              "press relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full font-medium",
              size === "sm" ? "h-9 px-2 text-xs" : "h-10 px-3 text-sm",
              on ? "text-primary" : "text-muted hover:text-fg",
            )}
          >
            {option.icon}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
