"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "Heute",
    // House — today's practice lives here.
    path: "M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5",
  },
  {
    href: "/weg",
    label: "Weg",
    // Signpost — the journey through Germany.
    path: "M12 3v3m0 12v3m-6-9h10.5l2.5-2.5L16.5 7H6a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1Zm0 0v0",
  },
  {
    href: "/du",
    label: "Du",
    path: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
  },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
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
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
                active ? "text-accent-bright" : "text-muted hover:text-foreground"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="size-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={active ? 2.2 : 1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d={tab.path} />
              </svg>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
