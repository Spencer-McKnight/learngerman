import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUiStrings } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow } from "@/components/ui";
import { LoginPanel } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getUiStrings();
  return { title: t.login.signIn };
}

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) {
    redirect("/");
  }
  const { t } = await getUiStrings();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-gutter pt-[calc(var(--safe-top)+3.5rem)] pb-[calc(var(--safe-bottom)+3.5rem)]">
      <div className="flex flex-col items-center gap-4">
        <SignpostMark />
        <Eyebrow tone="accent">{t.login.eyebrow}</Eyebrow>
      </div>
      <LoginPanel />
    </main>
  );
}

/**
 * The Wegweiser mark from public/icon.svg, inline so it takes the theme's
 * accent: a signpost with two blades pointing deeper into Germany, and
 * the one yellow dot — the station the learner stands at.
 */
function SignpostMark() {
  return (
    <svg
      aria-hidden
      viewBox="96 72 320 368"
      className="size-16 text-accent"
      fill="currentColor"
    >
      <rect x="244" y="176" width="24" height="248" rx="6" />
      <rect x="172" y="416" width="168" height="16" rx="8" />
      <path d="M136 160 h228 l44 36 l-44 36 h-228 a10 10 0 0 1 -10 -10 v-52 a10 10 0 0 1 10 -10 z" />
      <rect x="160" y="188" width="150" height="16" rx="8" className="fill-ground" />
      <path d="M376 248 h-228 l-44 36 l44 36 h228 a10 10 0 0 0 10 -10 v-52 a10 10 0 0 0 -10 -10 z" />
      <rect x="202" y="276" width="150" height="16" rx="8" className="fill-ground" />
      <circle cx="256" cy="112" r="34" className="fill-milestone stroke-milestone-ink" strokeWidth="10" />
    </svg>
  );
}
