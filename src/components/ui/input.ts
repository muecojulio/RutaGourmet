import { cn } from "@/lib/cn";

/** Shared input treatment: visible focus halo, comfortable height. */
export const inputClass = cn(
  "w-full rounded-2xl border border-line bg-bg px-3.5 text-sm text-fg outline-none transition-shadow placeholder:text-muted/70",
  "h-11 focus-visible:border-primary/60 focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_18%,transparent)]",
);
