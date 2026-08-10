import { NextResponse } from "next/server";
import { checkServices } from "@/lib/health";

export async function GET() {
  const checks = await checkServices();
  const ok = checks.every((check) => check.ok);
  return NextResponse.json(
    { ok, checks, checkedAt: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
