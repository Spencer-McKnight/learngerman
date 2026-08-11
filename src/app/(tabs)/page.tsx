import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeStreak, isoDay } from "@/lib/streak";
import { Button, Card, SectionLabel } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Heute — the start surface. One clear main path (today's round), the
 * humane streak stated calmly, and three small optional detours.
 * No countdowns, no guilt, nothing to lose.
 */
export default async function Heute() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [{ data: claims }, profile, sessions, dueCount] = await Promise.all([
    supabase.auth.getClaims(),
    supabase
      .from("learner_profiles")
      .select("placed, prefs, minutes_per_session")
      .maybeSingle(),
    supabase
      .from("sessions")
      .select("completed_at")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(120),
    supabase
      .from("word_states")
      .select("lexeme_id", { count: "exact", head: true })
      .lte("due", nowIso),
  ]);

  const displayName =
    (claims?.claims?.user_metadata?.display_name as string | undefined) ?? null;
  const placed = profile.data?.placed ?? false;
  const minutes = profile.data?.minutes_per_session ?? 12;
  const plan = (profile.data?.prefs as { plan?: string } | null)?.plan ?? null;
  const due = dueCount.count ?? 0;

  const activeDays = [
    ...new Set(
      (sessions.data ?? [])
        .map((row) => (row.completed_at as string | null)?.slice(0, 10))
        .filter((day): day is string => Boolean(day)),
    ),
  ];
  const streak = computeStreak(activeDays, new Date(`${isoDay(new Date())}T12:00:00Z`));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-10">
      <header className="flex flex-col gap-2">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          Learn German
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight">
          {streak.returning
            ? "Willkommen zurück!"
            : displayName
              ? `Servus, ${displayName}.`
              : "Servus."}
        </h1>
        {streak.length > 0 ? (
          <p className="text-sm text-muted">
            <span className="font-semibold text-foreground">
              {streak.length} {streak.length === 1 ? "Tag" : "Tage"} in Folge
            </span>
            {streak.frozeYesterday && " — gestern war frei, die Serie lebt"}
            {streak.activeToday && " · heute schon geübt"}
          </p>
        ) : streak.returning ? (
          <p className="text-sm text-muted">
            Schön, dass du wieder da bist. Einfach weitermachen — genau da, wo
            du warst.
          </p>
        ) : null}
      </header>

      {!placed ? (
        <Card className="flex flex-col gap-4">
          <SectionLabel>Dein Startpunkt</SectionLabel>
          <p className="text-[15px] leading-relaxed">
            Drei ehrliche Minuten: Wir finden heraus, was du schon kannst, und
            fangen genau dort an — nie zu leicht, nie zu schwer.
          </p>
          <Link href="/willkommen">
            <Button className="w-full">Los geht&rsquo;s</Button>
          </Link>
        </Card>
      ) : (
        <>
          <Card className="flex flex-col gap-4">
            <SectionLabel>Deine heutige Runde</SectionLabel>
            <p className="text-[15px] leading-relaxed">
              Etwa {minutes} Minuten
              {due > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold">{due} Wörter warten auf dich</span>
                </>
              )}
              {streak.activeToday && " — die Serie ist schon sicher, alles Weitere ist Bonus"}
              .
            </p>
            <Link href="/session">
              <Button className="w-full py-3.5 text-base">
                {streak.activeToday ? "Noch eine Runde" : "Runde starten"}
              </Button>
            </Link>
          </Card>

          <div className="flex flex-col gap-2">
            <SectionLabel>Kleine Umwege</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {[
                { mode: "review", label: "Wiederholen", hint: "nur fällige Wörter" },
                { mode: "ear", label: "Ohren", hint: "hörst du den Unterschied?" },
                { mode: "speak", label: "Sprechen", hint: "auf deiner Stufe" },
              ].map((detour) => (
                <Link
                  key={detour.mode}
                  href={`/session?modus=${detour.mode}`}
                  className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3 transition hover:border-accent-bright"
                >
                  <span className="text-sm font-semibold">{detour.label}</span>
                  <span className="text-[11px] leading-tight text-muted">
                    {detour.hint}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {plan && (
        <p className="text-center text-sm text-muted">
          Dein Anker: <span className="italic">„{plan}“</span>
        </p>
      )}
    </main>
  );
}
