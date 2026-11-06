"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { cn } from "./cn";
import { IconButton } from "./icon-button";

export type ToastTone = "neutral" | "success" | "error";

export interface ToastOptions {
  message: ReactNode;
  tone?: ToastTone;
  /** Auto-dismiss after this many ms; 0 keeps it until dismissed. Default 4000. */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

export interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastApi {
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

interface ToastStore extends ToastApi {
  items: ToastItem[];
}

const noop: ToastStore = { items: [], toast: () => -1, dismiss: () => {} };
const ToastContext = createContext<ToastStore>(noop);

/**
 * Holds the toast queue. Mount once near the root (inside `I18nProvider`)
 * together with one `<Toaster/>`.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((item) => item.id !== id));
  }, []);
  const toast = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    setItems((list) => [...list.slice(-2), { ...options, id }]);
    return id;
  }, []);

  const value = useMemo(() => ({ items, toast, dismiss }), [items, toast, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

/**
 * `const { toast, dismiss } = useToast()`; `toast({ message, tone })`.
 * Outside a provider it is a no-op, so primitives can call it safely.
 */
export function useToast(): ToastApi {
  const { toast, dismiss } = useContext(ToastContext);
  return useMemo(() => ({ toast, dismiss }), [toast, dismiss]);
}

const TONES: Record<ToastTone, string> = {
  neutral: "border-hairline bg-surface-raised text-ink",
  success: "border-success/30 bg-surface-raised text-ink",
  error: "border-error/40 bg-surface-raised text-ink",
};

/**
 * The polite live region that renders queued toasts above the tab bar:
 * short, calm confirmations ("Gespeichert", "Offline — wird später
 * gesendet") that need no answer. At most three are visible; each
 * auto-dismisses. Use toasts for outcomes the learner did not ask to see
 * in detail. Not for errors that block the task (show them inline, in a
 * `Field` error or a `Sheet`), not for praise, and never for milestones —
 * those get the overlay. `dismissLabel` comes from `useStrings()`.
 */
export function Toaster({ dismissLabel, className }: { dismissLabel: string; className?: string }) {
  const { items, dismiss } = useContext(ToastContext);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className={cn(
        "pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-gutter",
        "bottom-[calc(var(--tab-bar-height)+var(--safe-bottom)+0.75rem)]",
        className,
      )}
    >
      {items.map((item) => (
        <ToastView key={item.id} item={item} dismissLabel={dismissLabel} onDismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastView({
  item,
  dismissLabel,
  onDismiss,
}: {
  item: ToastItem;
  dismissLabel: string;
  onDismiss: (id: number) => void;
}) {
  const duration = item.duration ?? 4000;
  useEffect(() => {
    if (duration <= 0) return;
    const timer = window.setTimeout(() => onDismiss(item.id), duration);
    return () => window.clearTimeout(timer);
  }, [duration, item.id, onDismiss]);

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-md border py-1.5 pl-4 pr-1.5 text-body-sm shadow-floating animate-toast-in",
        TONES[item.tone ?? "neutral"],
      )}
    >
      {item.tone && item.tone !== "neutral" && (
        <span
          aria-hidden
          className={cn("size-2 shrink-0 rounded-pill", item.tone === "success" ? "bg-success" : "bg-error")}
        />
      )}
      <span className="flex-1 py-1.5">{item.message}</span>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            onDismiss(item.id);
          }}
          className="min-h-9 shrink-0 rounded-sm px-2 font-semibold text-accent hover:bg-accent-soft"
        >
          {item.action.label}
        </button>
      )}
      <IconButton label={dismissLabel} size="sm" onClick={() => onDismiss(item.id)}>
        <X />
      </IconButton>
    </div>
  );
}
