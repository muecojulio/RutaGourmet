import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { useClickAway, useReducedMotion } from "@/lib/hooks";
import { matchesQuery } from "@/lib/text";

/**
 * Searchable combobox following the WAI-ARIA combobox pattern:
 *
 * - `role="combobox"` + `aria-expanded` + `aria-controls` + `aria-activedescendant`,
 *   options as `role="option"` with `aria-selected`.
 * - Filtering ignores case and diacritics ("jalapeño" finds "Jalapeño").
 * - ArrowUp/ArrowDown move the active option (kept scrolled into view),
 *   Home/End jump, Enter confirms, Escape closes. Focus stays on the input.
 * - A polite live region announces result counts; “sin coincidencias” gets a
 *   visible message.
 * - Closes on outside click with predictable focus; the chevron is a
 *   comfortable touch control to open/close.
 * - Long lists scroll inside a capped listbox without dragging the page.
 */

export type ComboboxOption = {
  id: string;
  label: string;
  /** Secondary line (address, category…). */
  hint?: string;
  /** Small decorative node (emoji, icon). */
  adornment?: ReactNode;
};

export function Combobox({
  label,
  options,
  placeholder,
  emptyMessage = "Sin coincidencias",
  groupLabel = "Opciones disponibles",
  onConfirm,
  className,
  inputClassName,
}: {
  /** Visible field label — placeholders never name a field. */
  label: string;
  options: ComboboxOption[];
  placeholder?: string;
  emptyMessage?: string;
  groupLabel?: string;
  onConfirm: (option: ComboboxOption) => void;
  className?: string;
  inputClassName?: string;
}) {
  const uid = useId();
  const reducedMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);
  const rootRef = useClickAway<HTMLDivElement>(() => {
    setOpen(false);
    setActiveIndex(-1);
  });

  const filtered = useMemo(
    () =>
      query.trim()
        ? options.filter((option) => matchesQuery(`${option.label} ${option.hint ?? ""}`, query))
        : options,
    [options, query],
  );

  const openList = () => {
    setOpen(true);
    setActiveIndex(filtered.length > 0 ? 0 : -1);
  };

  const confirm = (index: number) => {
    const option = filtered[index];
    if (!option) return;
    onConfirm(option);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        if (!open) return openList();
        setActiveIndex((index) => (index + 1) % Math.max(1, filtered.length));
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        if (!open) return openList();
        setActiveIndex((index) => (index <= 0 ? filtered.length - 1 : index - 1));
        break;
      }
      case "Home": {
        if (!open) return;
        event.preventDefault();
        setActiveIndex(filtered.length > 0 ? 0 : -1);
        break;
      }
      case "End": {
        if (!open) return;
        event.preventDefault();
        setActiveIndex(filtered.length - 1);
        break;
      }
      case "Enter": {
        if (!open) return;
        event.preventDefault();
        confirm(activeIndex >= 0 ? activeIndex : 0);
        break;
      }
      case "Escape": {
        if (!open) return;
        event.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
        break;
      }
    }
  };

  // Keep the active option visible while navigating a long list.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const node = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    node?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
  }, [open, activeIndex, reducedMotion]);

  const activeOption =
    open && activeIndex >= 0 && activeIndex < filtered.length ? filtered[activeIndex] : undefined;
  const activeId = activeOption ? `${uid}-opt-${activeOption.id}` : undefined;

  return (
    <div ref={rootRef} data-no-swipe className={cn("relative", className)}>
      <label htmlFor={`${uid}-input`} className="mb-1.5 block text-xs font-medium text-muted">
        {label}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          id={`${uid}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${uid}-list`}
          aria-activedescendant={open ? activeId : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (!open) openList();
          }}
          className={cn(
            "h-11 w-full rounded-2xl border border-line bg-bg pr-12 pl-10 text-sm text-fg outline-none transition-shadow placeholder:text-muted/70 focus-visible:border-primary/60 focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_18%,transparent)]",
            inputClassName,
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => (open ? setOpen(false) : openList())}
          className="press absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-xl text-muted"
        >
          <ChevronDown
            className={cn("size-4 transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      </div>

      {open ? (
        <div className="pop-in relative z-20 mt-1.5 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)]">
          <p aria-live="polite" className="sr-only">
            {filtered.length === 0
              ? `${emptyMessage} para ${query}`
              : `${filtered.length} ${filtered.length === 1 ? "coincidencia" : "coincidencias"}`}
          </p>
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">
              {emptyMessage}: «{query.trim()}»
            </p>
          ) : (
            <ul
              ref={listRef}
              id={`${uid}-list`}
              role="listbox"
              aria-label={groupLabel}
              className="max-h-64 overflow-y-auto overscroll-contain p-1.5"
              // The list scrolls on its own; a wheel/touch there must not
              // bubble up and scroll the page behind it.
              onWheel={(event) => event.stopPropagation()}
            >
              {filtered.map((option, index) => {
                const isActive = index === activeIndex;
                return (
                  <li
                    key={option.id}
                    id={`${uid}-opt-${option.id}`}
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => confirm(index)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm",
                      isActive ? "bg-primary/15 text-fg" : "text-fg",
                    )}
                  >
                    {option.adornment ? (
                      <span
                        aria-hidden="true"
                        className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-base"
                      >
                        {option.adornment}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{option.label}</span>
                      {option.hint ? (
                        <span className="block truncate text-xs text-muted">{option.hint}</span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
