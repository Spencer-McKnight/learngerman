import { checkServices } from "@/lib/health";

export const dynamic = "force-dynamic";

export default async function Home() {
  const checks = await checkServices();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16">
      <header className="flex flex-col items-center gap-3 text-center">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          Learn German
        </p>
        <h1 className="font-display text-5xl font-bold tracking-tight">
          Willkommen.
        </h1>
        <p className="max-w-md text-balance text-muted">
          An adaptive tutor built on comprehensible input — always at your
          level, always slightly beyond it.
        </p>
      </header>

      <section
        aria-label="System status"
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-sm"
      >
        <h2 className="mb-4 font-display text-xs font-semibold uppercase tracking-[0.15em] text-muted">
          System status
        </h2>
        <ul className="flex flex-col gap-3">
          {checks.map((check) => (
            <li key={check.name} className="flex items-start gap-3">
              <span
                aria-hidden
                className={`mt-1.5 size-2 shrink-0 rounded-full ${
                  check.ok ? "bg-success" : "bg-error"
                }`}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {check.name}
                  <span className="sr-only">
                    {check.ok ? " — connected" : " — not connected"}
                  </span>
                </p>
                <p className="truncate text-xs text-muted" title={check.detail}>
                  {check.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <footer className="text-xs text-muted">
        Stage 1 — Fundament · infrastructure &amp; connected services
      </footer>
    </main>
  );
}
