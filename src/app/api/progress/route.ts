import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProgressBundle } from "@/lib/progress";

/** GET → the honest progress bundle for the signed-in learner. */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return NextResponse.json(await getProgressBundle(supabase, data.user.id));
}
