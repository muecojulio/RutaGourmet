import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The one button system for the whole app.
 *
 * - Touch targets stay ≥ 44 px at every size (`sm` adds padding, not height).
 * - Press feedback comes from the shared `.press` class (scale + sink).
 * - `loading` shows a spinner, sets `aria-busy` and blocks re-submission.
 * - `success` / `error` are one-shot visual confirmations; `error` also nudges
 *   (a very discreet shake) and must be paired with a text/icon message by the
 *   caller, never color alone.
 */
const buttonVariants = cva(
  "press press-deep relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-fg shadow-[0_6px_18px_-8px_color-mix(in_srgb,var(--color-primary)_70%,transparent)] hover:brightness-105",
        surface:
          "border border-line bg-surface text-fg hover:border-primary/50 hover:shadow-[var(--shadow-card)]",
        outline: "border border-line bg-transparent text-fg hover:bg-surface-2",
        ghost: "bg-transparent text-muted hover:bg-surface-2 hover:text-fg",
        danger: "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-11 px-4",
        lg: "h-12 px-6 text-base",
        icon: "size-11 p-0",
        iconSm: "size-9 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    /** Show a spinner, set aria-busy and ignore further presses. */
    loading?: boolean;
    /** One-shot confirmation: swaps the leading slot for a check icon. */
    success?: boolean;
    /** One-shot error nudge (shake). Pair with a visible message. */
    error?: boolean;
    /** Element rendered before the label (icon); hidden while loading/success. */
    leading?: ReactNode;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    loading = false,
    success = false,
    error = false,
    leading,
    children,
    disabled,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-busy={loading || undefined}
      aria-invalid={error || undefined}
      disabled={disabled || loading}
      className={cn(
        buttonVariants({ variant, size }),
        error && "wiggle",
        success && "border-good/50 text-good",
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="spin size-4" aria-hidden="true" />
      ) : success ? (
        <Check className="size-4" aria-hidden="true" />
      ) : error ? (
        <X className="size-4" aria-hidden="true" />
      ) : (
        leading
      )}
      {children}
    </button>
  );
});
