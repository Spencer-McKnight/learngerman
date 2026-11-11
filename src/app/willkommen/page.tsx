import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lineOf, STATIONS } from "@/lib/curriculum";
import type { LineNumber } from "@/components/ui";
import { PlacementFlow, type StartStation } from "./placement-flow";

export const dynamic = "force-dynamic";

/** Willkommen — the honest three-minute start (placement + habit anchor),
 *  ending at the station the learner boards first. */
export default async function Willkommen() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("learner_profiles")
    .select("placed")
    .maybeSingle();
  if (profile?.placed) redirect("/");

  const stations: StartStation[] = STATIONS.map((station) => ({
    id: station.id,
    name: station.name,
    title: station.title,
    titleEn: station.titleEn,
    canDoEn: station.canDoEn,
    minutes: station.minutes,
    order: station.order,
    line: Math.min(5, Math.max(1, lineOf(station).number)) as LineNumber,
  }));

  return <PlacementFlow stations={stations} />;
}
