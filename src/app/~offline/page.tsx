import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";
import { getUiStrings } from "@/lib/i18n/server";
import { Button, Card, Eyebrow } from "@/components/ui";

export const metadata: Metadata = { title: "Offline" };

/**
 * The offline shell: precached by the service worker (src/app/sw.ts) and
 * served whenever a page navigation cannot reach the network. Chrome,
 * tokens and fonts render; content degrades to one honest message.
 */
export default async function Offline() {
  const { t } = await getUiStrings();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-gutter py-14">
      <Card variant="raised" className="flex w-full flex-col items-start gap-4">
        <WifiOff className="size-8 text-ink-muted" aria-hidden />
        <Eyebrow tone="accent">{t.offline.eyebrow}</Eyebrow>
        <h1 className="font-display text-display-l text-ink">{t.offline.title}</h1>
        <p className="text-body text-ink-muted">{t.offline.body}</p>
        <Link href="/" className="block w-full rounded-md">
          <Button fullWidth tabIndex={-1}>
            {t.offline.retry}
          </Button>
        </Link>
      </Card>
    </main>
  );
}
