import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Accordion panel with an animated open/close (the grid-rows trick: animating
 * `0fr → 1fr` needs no measured pixels, so the motion never jumps when the
 * content reflows). The trigger exposes `aria-expanded` + `aria-controls`; the
 * region is `aria-hidden` + `inert` while closed so its controls leave the
 * focus order and are never announced as available.
 */
export function Collapse({
  title,
  subtitle,
  icon,
  defaultOpen = false,
  tone = "default",
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  tone?: "default" | "primary";
  children: ReactNode;
  className?: string;
}) {
  const uid = useId();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border border-line bg-surface",
        tone === "primary" && "border-primary/25",
        className,
      )}
    >
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${uid}-region`}
          onClick={() => setOpen((value) => !value)}
          className="press flex w-full items-start gap-3 p-4 text-left"
        >
          {icon ? (
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl",
                tone === "primary" ? "bg-primary/12 text-primary" : "bg-surface-2 text-accent",
              )}
            >
              {icon}
            </span>
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-fg">{title}</span>
            {subtitle ? <span className="mt-0.5 block text-xs text-muted">{subtitle}</span> : null}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "mt-1 size-4 shrink-0 text-muted transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>
      </h3>
      <div
        id={`${uid}-region`}
        aria-hidden={!open}
        inert={!open}
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pt-0 pb-4 text-sm text-muted">{children}</div>
        </div>
      </div>
    </section>
  );
}
