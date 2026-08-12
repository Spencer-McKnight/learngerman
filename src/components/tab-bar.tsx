"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Signpost, User } from "lucide-react";
import { useStrings } from "@/components/i18n-provider";
import type { UiStrings } from "@/lib/i18n/strings";

const TABS: {
  href: string;
  label: (t: UiStrings) => string;
  Icon: typeof Home;
}[] = [
  { href: "/", label: (t) => t.tabs.today, Icon: Home },
  { href: "/weg", label: (t) => t.tabs.path, Icon: Signpost },
  { href: "/du", label: (t) => t.tabs.you, Icon: User },
];

export function TabBar() {
  const pathname = usePathname();
  const t = useStrings();
  return (
    <nav
      aria-label={t.tabs.mainNav}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-all duration-200 ${
                active ? "text-accent-bright" : "text-muted hover:text-foreground"
              }`}
            >
              <tab.Icon
                className={`size-5 transition-all duration-200 ${active ? "scale-110" : ""}`}
                strokeWidth={active ? 2.2 : 1.7}
              />
              {tab.label(t)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
