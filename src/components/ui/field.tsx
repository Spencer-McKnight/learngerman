"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

interface FieldBase {
  label: ReactNode;
  /** Guidance under the control; always visible. */
  hint?: ReactNode;
  /** Validation message; when set, the control is `aria-invalid` and the
   *  message is announced via `aria-describedby`. */
  error?: ReactNode;
  id?: string;
  className?: string;
  /** Large German text entry (the drills): DIN-ish size, no autocorrect. */
  size?: "md" | "lg";
}

export type FieldProps = FieldBase &
  (
    | ({ multiline?: false } & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className" | "size">)
    | ({ multiline: true } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className">)
  );

const CONTROL =
  "w-full rounded-md border border-hairline bg-surface px-3.5 text-ink placeholder:text-ink-faint transition-[border-color,box-shadow] duration-(--dur-fast) hover:border-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50 aria-invalid:border-error aria-invalid:focus:ring-error/20";

/**
 * A labelled text control: label above, input or textarea (`multiline`),
 * hint and error below, all wired with `htmlFor`/`aria-describedby` so a
 * screen reader hears the label, the hint and the error with the field.
 * Pass `lang="de"` and `autoCapitalize="none"` for German answer entry.
 * Not for search boxes without a visible label (use an `aria-label` on a
 * plain input), not for checkboxes or selects, and never hide the label
 * visually unless the context makes it obvious (then still pass it).
 */
export function Field(props: FieldProps) {
  const generated = useId();
  const { label, hint, error, id = generated, className, size = "md" } = props;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const controlClass = cn(CONTROL, size === "lg" ? "min-h-13 text-title" : "min-h-11 text-body");

  let control: ReactNode;
  if (props.multiline) {
    const { multiline, label: _l, hint: _h, error: _e, id: _i, className: _c, size: _s, ...rest } = props;
    void multiline;
    void _l;
    void _h;
    void _e;
    void _i;
    void _c;
    void _s;
    control = (
      <textarea
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        rows={3}
        className={cn(controlClass, "py-2.5 leading-relaxed")}
        {...rest}
      />
    );
  } else {
    const { multiline, label: _l, hint: _h, error: _e, id: _i, className: _c, size: _s, ...rest } = props;
    void multiline;
    void _l;
    void _h;
    void _e;
    void _i;
    void _c;
    void _s;
    control = (
      <input
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={controlClass}
        {...rest}
      />
    );
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-body-sm font-semibold text-ink">
        {label}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="text-caption text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-caption font-medium text-error">
          {error}
        </p>
      )}
    </div>
  );
}
