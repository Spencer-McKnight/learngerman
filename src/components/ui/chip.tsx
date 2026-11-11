import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type Gender = "der" | "die" | "das";

const GENDER_CLASSES: Record<Gender, string> = {
  der: "border-gender-der text-gender-der",
  die: "border-gender-die text-gender-die",
  das: "border-gender-das text-gender-das",
};

const VARIANTS = {
  neutral: "border-hairline bg-surface text-ink",
  accent: "border-accent-soft bg-accent-soft text-accent",
  gender: "bg-surface",
} as const;

interface BaseProps {
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  /** For `variant="gender"`: the article. */
  gender?: Gender;
  /** For `variant="gender"`: whether the colour is shown yet. Colour is
   *  feedback — pass `false` while the learner is still retrieving. */
  revealed?: boolean;
  size?: "sm" | "md";
  /** A `selected` chip (filters, option sets) — sets `aria-pressed` on buttons. */
  selected?: boolean;
  className?: string;
}

export type ChipProps = BaseProps &
  (
    | ({ onClick: ButtonHTMLAttributes<HTMLButtonElement>["onClick"] } & Omit<
        ButtonHTMLAttributes<HTMLButtonElement>,
        "children" | "onClick" | "className"
      >)
    | ({ onClick?: undefined } & Omit<HTMLAttributes<HTMLSpanElement>, "children" | "className">)
  );

/**
 * A small pill for a word, a tag, or a filter. `neutral` for lists,
 * `accent` for the one that is active or new, `gender` for a noun: the
 * article colour arrives only when `revealed` (after the learner has
 * answered), and the article text is always inside the chip so colour is
 * never the only carrier. With `onClick` it renders as a button (44 px
 * tall at `md`); without, as a span. Not for actions with verbs (use
 * `Button`), not for status badges that need an icon, and never as a
 * pre-highlighted gender hint before retrieval.
 */
export function Chip(props: ChipProps) {
  const { children, variant = "neutral", gender, revealed = true, size = "md", selected, className } = props;
  const classes = cn(
    "inline-flex items-center gap-1.5 rounded-pill border font-medium transition-[background-color,border-color,color] duration-(--dur-fast)",
    size === "sm" ? "min-h-7 px-2.5 text-caption" : "min-h-9 px-3 text-body-sm",
    variant === "gender" && gender && revealed ? GENDER_CLASSES[gender] : VARIANTS[variant],
    variant === "gender" && !(gender && revealed) && "border-hairline text-ink",
    selected && "border-accent bg-accent-soft text-accent",
    className,
  );
  if (props.onClick) {
    const { onClick, ...rest } = stripBase(props);
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={cn(classes, "min-h-11 hover:border-accent active:scale-[0.97] disabled:opacity-50")}
        {...rest}
      >
        {children}
      </button>
    );
  }
  const rest = stripBase(props);
  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}

function stripBase<T extends BaseProps>(props: T): Omit<T, keyof BaseProps> {
  const { children, variant, gender, revealed, size, selected, className, ...rest } = props;
  void children;
  void variant;
  void gender;
  void revealed;
  void size;
  void selected;
  void className;
  return rest;
}
