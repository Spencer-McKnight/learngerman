import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  buildIndex,
  buildVocabProbe,
  combinePlacement,
  CTEST_PASSAGES,
  initialSkills,
  parseCTest,
  scoreCTest,
  scoreVocabProbe,
  seedWordStates,
  SEED_LEXICON,
  analyzeProduction,
} from "@/lib/engine";
import type { SyntaxStage } from "@/lib/engine";
import { savePlacement } from "@/lib/engine/store";

const index = buildIndex(SEED_LEXICON);

/**
 * GET → the placement instrument: yes/no vocabulary probe (real flags
 * withheld — they are recomputed server-side from the seed) and the
 * C-test passages with gaps blanked.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const seed = Number(new URL(request.url).searchParams.get("seed") ?? 7);
  const probe = buildVocabProbe(index, { seed });
  return NextResponse.json({
    seed,
    vocabProbe: probe.map((item) => item.word),
    ctest: CTEST_PASSAGES.map((passage) => ({
      id: passage.id,
      display: parseCTest(passage).display,
      gaps: parseCTest(passage).answers.length,
    })),
  });
}

const submitSchema = z.object({
  seed: z.number().int(),
  saidYes: z.array(z.boolean()),
  ctest: z.record(z.string(), z.array(z.string())).optional(),
  /** Free German sentences from the syntax probe, if attempted. */
  productions: z.array(z.string()).optional(),
});

/** POST → score the probes and seed the learner's starting state. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = submitSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.message }, { status: 400 });
  }
  const { seed, saidYes, ctest, productions } = body.data;

  const probe = buildVocabProbe(index, { seed });
  const vocab = scoreVocabProbe(probe, saidYes);

  let ctestScore: number | undefined;
  if (ctest) {
    const scores = CTEST_PASSAGES.filter((passage) => ctest[passage.id]).map((passage) =>
      scoreCTest(parseCTest(passage).answers, ctest[passage.id]),
    );
    if (scores.length > 0) {
      ctestScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }
  }

  let observedStage: SyntaxStage | undefined;
  if (productions && productions.length > 0) {
    let best = 0;
    for (const sentence of productions) {
      for (const observation of analyzeProduction(sentence, index)) {
        if (observation.success && observation.stage > best) best = observation.stage;
      }
    }
    if (best > 0) observedStage = best as SyntaxStage;
  }

  const placement = combinePlacement(vocab, ctestScore, observedStage);
  const now = new Date();
  const words = seedWordStates(index, placement.knownUntilRank, now);
  const skills = initialSkills(placement.seedRating);
  await savePlacement(supabase, data.user.id, words, skills, placement.stage, {
    ...placement,
    accuracy: vocab.accuracy,
    ctestScore,
    placedAt: now.toISOString(),
  });

  return NextResponse.json({ placement, seededWords: words.length });
}
