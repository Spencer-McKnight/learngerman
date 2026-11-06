import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import { Check, Lock } from "lucide-react";
import { cn } from "./cn";
import { lineStyle, type LineNumber } from "./line-badge";

export type StationStatus = "locked" | "unseen" | "started" | "passed" | "current";

export interface StationSignProps {
  /** The station name in DIN: "Bäckerei Hofmann". */
  name: string;
  /** The can-do or the scene's one-line setting. */
  subtitle?: ReactNode;
  line: LineNumber;
  status: StationStatus;
  /** Visible station number on the plate ("3"). */
  index?: ReactNode;
  /** Screen-reader text for the status ("Bestanden", "Gesperrt") — from `useStrings()`. */
  statusLabel?: string;
  /** Renders the sign as a link (the lesson route). Ignored when `locked`. */
  href?: string;
  /** Renders the sign as a button. Ignored when `locked` or when `href` is set. */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** Plays `animate-sign-arrive` on mount: the arrival beat. */
  arrive?: boolean;
  className?: string;
}

const STATUS_PLATE: Record<StationStatus, string> = {
  locked: "border-hairline bg-surface-sunken text-ink-muted",
  unseen: "border-hairline bg-surface text-ink",
  started: "border-hairline bg-surface text-ink",
  passed: "border-hairline bg-surface text-ink",
  current: "border-accent bg-surface text-ink shadow-raised ring-2 ring-accent/15",
};

/**
 * A transit-style station nameplate for the course map and the lesson
 * header: a line-coloured bar on the left, the station name in DIN, an
 * optional subtitle, and a status mark on the right (lock, half ring,
 * check, or the accent frame for the current station). Status is carried
 * by shape and `statusLabel`, not by colour alone. Pass `href` to make it
 * the link into the lesson. Use it for stations only — not for detours,
 * settings rows or generic list items (use `Card` or a plain list), and
 * never with milestone yellow.
 */
export function StationSign({
  name,
  subtitle,
  line,
  status,
  index,
  statusLabel,
  href,
  onClick,
  arrive = false,
  className,
}: StationSignProps) {
  const locked = status === "locked";
  const plate = cn(
    "group relative flex w-full items-stretch gap-3 overflow-hidden rounded-md border text-left transition-[border-color,box-shadow,transform]",
    STATUS_PLATE[status],
    !locked && (href || onClick) && "hover:border-accent hover:shadow-raised active:scale-[0.99]",
    arrive && "animate-sign-arrive",
    className,
  );

  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          "w-1.5 shrink-0 self-stretch",
          locked ? "bg-hairline" : "bg-(--badge-fill)",
          status === "current" && "w-2",
        )}
        style={lineStyle(line)}
      />
      <span className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-3">
        {index !== undefined && (
          <span
            className={cn(
              "shrink-0 font-display text-body-sm font-semibold tabular",
              locked ? "text-ink-faint" : "text-ink-muted",
            )}
          >
            {index}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              "truncate font-display text-title font-semibold tracking-tight",
              status === "current" && "text-accent",
            )}
          >
            {name}
          </span>
          {subtitle && <span className="truncate text-body-sm text-ink-muted">{subtitle}</span>}
        </span>
        <StatusMark status={status} line={line} />
        {statusLabel && <span className="sr-only">{statusLabel}</span>}
      </span>
    </>
  );

  if (!locked && href) {
    return (
      <Link href={href} className={plate}>
        {body}
      </Link>
    );
  }
  if (!locked && onClick) {
    return (
      <button type="button" onClick={onClick} className={plate}>
        {body}
      </button>
    );
  }
  return (
    <div aria-disabled={locked || undefined} className={plate}>
      {body}
    </div>
  );
}

function StatusMark({ status, line }: { status: StationStatus; line: LineNumber }) {
  const base = "flex size-6 shrink-0 items-center justify-center rounded-pill";
  switch (status) {
    case "locked":
      return (
        <span aria-hidden className={cn(base, "text-ink-faint")}>
          <Lock className="size-4" strokeWidth={2} />
        </span>
      );
    case "passed":
      return (
        <span
          aria-hidden
          className={cn(base, "bg-(--badge-bg) text-(--badge-ink)")}
          style={lineStyle(line)}
        >
          <Check className="size-4" strokeWidth={3} />
        </span>
      );
    case "started":
      return (
        <span
          aria-hidden
          className={cn(base, "border-2 border-(--badge-fill)")}
          style={{ ...lineStyle(line), background: "linear-gradient(90deg, var(--badge-fill) 50%, transparent 50%)" }}
        />
      );
    case "current":
      return <span aria-hidden className={cn(base, "border-2 border-accent")} />;
    default:
      return <span aria-hidden className={cn(base, "border-2 border-hairline")} />;
  }
}
