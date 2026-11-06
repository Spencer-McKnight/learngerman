"use client";

import { useId, type ReactNode } from "react";
import { cn } from "./cn";

export interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Visible label, rendered beside the switch and wired as its name. */
  label?: ReactNode;
  /** Secondary line under the label. */
  description?: ReactNode;
  /** When there is no visible `label`, the accessible name. */
  "aria-label"?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * An on/off switch (`role="switch"`) for a setting that takes effect
 * immediately: sound, das-amber, reduced celebrations. The whole row is
 * the hit area (≥ 44 px). Use it only for binary settings that apply at
 * once — not for choices that need a save button (use a checkbox in a
 * `Field` form), not for more than two options (`Segmented`), and not as
 * a filter chip.
 */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  "aria-label": ariaLabel,
  disabled = false,
  className,
}: ToggleProps) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={label ? `${id}-label` : undefined}
      aria-label={label ? undefined : ariaLabel}
      aria-describedby={description ? `${id}-desc` : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex min-h-11 w-full items-center justify-between gap-4 rounded-md px-1 text-left disabled:opacity-50",
        className,
      )}
    >
      {(label || description) && (
        <span className="flex min-w-0 flex-col">
          {label && (
            <span id={`${id}-label`} className="text-body font-medium text-ink">
              {label}
            </span>
          )}
          {description && (
            <span id={`${id}-desc`} className="text-body-sm text-ink-muted">
              {description}
            </span>
          )}
        </span>
      )}
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-pill border transition-[background-color,border-color]",
          checked ? "border-accent bg-accent" : "border-hairline bg-surface-sunken",
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 size-5 rounded-pill bg-surface shadow-raised transition-transform ease-standard",
            checked ? "translate-x-5 bg-accent-ink" : "translate-x-0",
          )}
        />
      </span>
    </button>
  );
}
