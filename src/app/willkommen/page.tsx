import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlacementFlow } from "./placement-flow";

export const dynamic = "force-dynamic";

/** Willkommen — the honest three-minute start (placement + habit anchor). */
export default async function Willkommen() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("learner_profiles")
    .select("placed")
    .maybeSingle();
  if (profile?.placed) redirect("/");
  return <PlacementFlow />;
}
