"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Signpost, User } from "lucide-react";
import { useStrings } from "@/components/i18n-provider";
import { cn } from "@/components/ui/cn";
import type { UiStrings } from "@/lib/i18n/strings";

export interface TabDef {
  href: string;
  label: (t: UiStrings) => string;
  Icon: typeof Home;
}

/** The three calm home surfaces. A fourth tab is a fourth entry here or
 *  a `tabs` prop from the layout; the bar lays out any count evenly. */
export const DEFAULT_TABS: readonly TabDef[] = [
  { href: "/", label: (t) => t.tabs.today, Icon: Home },
  { href: "/weg", label: (t) => t.tabs.path, Icon: Signpost },
  { href: "/du", label: (t) => t.tabs.you, Icon: User },
];

export function TabBar({ tabs = DEFAULT_TABS }: { tabs?: readonly TabDef[] }) {
  const pathname = usePathname();
  const t = useStrings();
  return (
    <nav
      aria-label={t.tabs.mainNav}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/92 pb-safe backdrop-blur-md"
    >
      <ul
        className="mx-auto grid h-(--tab-bar-height) max-w-md list-none"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="relative flex">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "touch-target flex flex-1 flex-col items-center justify-center gap-1 rounded-sm px-1 text-caption font-semibold transition-colors duration-(--dur-fast)",
                  active ? "text-accent" : "text-ink-muted hover:text-ink",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-0 h-0.5 w-8 rounded-b-pill bg-accent transition-[transform,opacity] ease-spring",
                    active ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0",
                  )}
                />
                <tab.Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                <span className="leading-none">{tab.label(t)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
