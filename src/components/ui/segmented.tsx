"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "./cn";

export interface SegmentedOption<V extends string> {
  value: V;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedProps<V extends string> {
  options: readonly SegmentedOption<V>[];
  value: V;
  onChange: (next: V) => void;
  /** Accessible name of the group (or pass `aria-labelledby`). */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * A single-choice control for two to five short options (UI language,
 * session length, voice speed): a `radiogroup` whose radios share one
 * tab stop, with Left/Right/Up/Down and Home/End moving the selection.
 * Use it when every option fits in a word or two and must be visible at
 * once. Not for more than five options or long labels (use a `Sheet` with
 * a list), not for on/off (use `Toggle`), and not for navigation between
 * screens (use the tab bar or links).
 */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  size = "md",
  className,
}: SegmentedProps<V>) {
  const groupRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = options.filter((o) => !o.disabled);
    const at = enabled.findIndex((o) => o.value === value);
    if (at === -1 || enabled.length === 0) return;
    let next = at;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (at + 1) % enabled.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (at - 1 + enabled.length) % enabled.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = enabled.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = enabled[next];
    onChange(target.value);
    const radios = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    radios?.forEach((radio) => {
      if (radio.dataset.value === target.value) radio.focus();
    });
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex w-full rounded-md border border-hairline bg-surface-sunken p-1",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            data-value={option.value}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-sm font-semibold transition-[background-color,color,box-shadow] duration-(--dur-fast) disabled:opacity-40",
              size === "sm" ? "min-h-8 px-2 text-caption" : "min-h-10 px-3 text-body-sm",
              selected ? "bg-surface text-accent shadow-flat" : "text-ink-muted hover:text-ink",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
