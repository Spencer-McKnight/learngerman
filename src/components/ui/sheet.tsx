"use client";

import { useEffect, useId, useRef, type MouseEvent, type ReactNode, type SyntheticEvent } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";
import { IconButton } from "./icon-button";

export interface SheetProps {
  open: boolean;
  /** Called for Escape, the close button, and a tap on the scrim. */
  onClose: () => void;
  title: ReactNode;
  /** Accessible name of the close button — from `useStrings()`. */
  closeLabel: string;
  children: ReactNode;
  /** Sticky actions at the bottom (thumb reach). */
  footer?: ReactNode;
  className?: string;
}

/**
 * A bottom sheet on the native `<dialog>`: modal, focus-trapped by the
 * browser, Escape closes, focus returns to the opener, the scrim is the
 * theme's `--scrim`. Use it for a short decision or a list that is too
 * long for `Segmented` — choosing a voice, confirming an exit, showing a
 * word's details. Keep it under one screen tall; it scrolls inside if
 * not. Not for multi-step flows or forms with many fields (give those a
 * route), not for toasts, and never open one on page load.
 */
export function Sheet({ open, onClose, title, closeLabel, children, footer, className }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const onCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    onClose();
  };
  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={onCancel}
      onClose={() => {
        if (open) onClose();
      }}
      onClick={onBackdropClick}
      className={cn(
        "m-0 mx-auto mt-auto mb-0 hidden max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-xl border-0 bg-surface p-0 text-ink shadow-floating open:flex animate-sheet-up",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-hairline py-3 pl-5 pr-2">
        <span aria-hidden className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-pill bg-hairline" />
        <h2 id={titleId} className="flex-1 font-display text-title font-semibold tracking-tight">
          {title}
        </h2>
        <IconButton label={closeLabel} onClick={onClose} autoFocus>
          <X />
        </IconButton>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      {footer && (
        <div className="border-t border-hairline px-5 pt-3 pb-[max(0.75rem,var(--safe-bottom))]">{footer}</div>
      )}
      {!footer && <div className="pb-safe" />}
    </dialog>
  );
}
