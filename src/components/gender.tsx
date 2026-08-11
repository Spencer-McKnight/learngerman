/**
 * The gender-colour system (technology.md): der blue, die red, das
 * green — the same three colours everywhere nouns appear, always with
 * the article text present (colour is never the only carrier), and
 * arriving as FEEDBACK after retrieval, never as a pre-highlighted
 * answer. The .das-amber root class switches das to amber for
 * red-green colour-vision deficiency.
 */

import type { Gender } from "@/lib/engine";

export const GENDER_TEXT: Record<Gender, string> = {
  der: "text-gender-der",
  die: "text-gender-die",
  das: "text-gender-das",
};

export const GENDER_BORDER: Record<Gender, string> = {
  der: "border-gender-der",
  die: "border-gender-die",
  das: "border-gender-das",
};

/** A noun with its article, coloured — used only in feedback states. */
export function GenderedNoun({
  gender,
  lemma,
  className = "",
}: {
  gender: Gender;
  lemma: string;
  className?: string;
}) {
  return (
    <span className={`font-semibold ${GENDER_TEXT[gender]} ${className}`}>
      {gender} {lemma}
    </span>
  );
}
