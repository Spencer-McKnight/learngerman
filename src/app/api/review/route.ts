import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  applyOutcome,
  detectMilestones,
  estimateCefr,
  isKnown,
} from "@/lib/engine";
import type { ReviewOutcome, SkillId, SyntaxStage } from "@/lib/engine";
import { loadSnapshot, saveOutcome } from "@/lib/engine/store";

const outcomeSchema = z.object({
  taskKind: z.string(),
  skill: z.enum(["reading", "listening", "writing", "speaking", "grammar"]),
  correct: z.boolean(),
  lexemeGrades: z.record(z.string(), z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])),
  difficulty: z.number(),
  stageAttempted: z.number().int().min(1).max(5).optional(),
  stageSuccess: z.boolean().optional(),
  earContrastId: z.string().optional(),
  biteId: z.string().optional(),
  inputSeconds: z.number().min(0).max(3600).optional(),
});

/**
 * POST → fold one graded interaction into the learner state and
 * report any genuine milestone the outcome crossed.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = outcomeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const outcome: ReviewOutcome = {
    ...parsed.data,
    skill: parsed.data.skill as SkillId,
    stageAttempted: parsed.data.stageAttempted as SyntaxStage | undefined,
    lexemeGrades: parsed.data.lexemeGrades as ReviewOutcome["lexemeGrades"],
  };

  const before = await loadSnapshot(supabase, data.user.id);
  const after = applyOutcome(before, outcome);

  const touched = Object.keys(outcome.lexemeGrades);
  const touchedWords = after.words.filter((word) => touched.includes(word.lexemeId));
  await saveOutcome(supabase, after, outcome, touchedWords);

  const milestones = detectMilestones(
    {
      knownCount: before.words.filter((word) => isKnown(word, before.now)).length,
      stage: before.syntax.stage,
      masteredContrasts: before.ear.filter((c) => c.mastered).map((c) => c.contrastId),
      band: estimateCefr(before).band,
    },
    {
      knownCount: after.words.filter((word) => isKnown(word, after.now)).length,
      stage: after.syntax.stage,
      masteredContrasts: after.ear.filter((c) => c.mastered).map((c) => c.contrastId),
      band: estimateCefr(after).band,
    },
  );
  if (milestones.length > 0) {
    await supabase.from("milestone_events").insert(
      milestones.map((event) => ({
        user_id: data.user.id,
        kind: event.kind,
        label: event.label,
        detail: event.detail,
      })),
    );
  }

  return NextResponse.json({ ok: true, milestones });
}
