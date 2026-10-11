import { useId, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import * as SwitchPrimitive from "@radix-ui/react-switch";

/**
 * Field wrapper: a real <label> (placeholders never name a field), optional
 * hint and error, both wired with aria-describedby. The focus treatment lives
 * on the control itself.
 */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
  className?: string;
}) {
  const uid = useId();
  const describedBy = [hint ? `${uid}-hint` : null, error ? `${uid}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={`${uid}-control`} className="mb-1.5 block text-xs font-medium text-muted">
        {label}
      </label>
      {children({
        id: `${uid}-control`,
        describedBy: describedBy || undefined,
        invalid: Boolean(error),
      })}
      {hint && !error ? (
        <p id={`${uid}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${uid}-error`}
          className="mt-1 flex items-center gap-1 text-xs text-danger"
          role="alert"
        >
          <AlertTriangle className="size-3.5" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Labeled switch row: Radix gives the `role="switch"` + `aria-checked`
 * semantics; the thumb glides with a short spring-ish curve. State never
 * depends on the animation — color, position and the label's own text carry it.
 */
export function SwitchRow({
  label,
  hint,
  checked,
  onToggle,
  className,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-2.5", className)}>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      </div>
      <SwitchPrimitive.Root
        checked={checked}
        onCheckedChange={() => onToggle()}
        aria-label={label}
        className={cn(
          "press relative h-8 w-[52px] shrink-0 rounded-full border transition-colors",
          checked ? "border-primary/60 bg-primary" : "border-line bg-surface-2",
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "block size-6 translate-x-0.5 rounded-full bg-surface shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.2,0.7,0.3,1.15)]",
            checked && "translate-x-[22px] bg-primary-fg",
          )}
        />
      </SwitchPrimitive.Root>
    </div>
  );
}
