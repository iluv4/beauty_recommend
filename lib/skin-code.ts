import type { QuizAnswers, Sensitivity, SkinCode, SkinType, WeightedConcern } from "./types";

/**
 * MBTI-style "Skin Code" — four binary axes, 16 types.
 * Same shape as the well-known Baumann skin-typing system, so it reads
 * familiar to US skincare communities:
 *
 *   O / D — Oily vs Dry            (from the quiz: how skin feels)
 *   S / R — Sensitive vs Resistant (quiz reactivity + visible redness)
 *   P / N — Pigmented vs Even      (dark spots / uneven tone in concerns)
 *   W / T — Wrinkle-care vs Tight  (fine lines in concerns, or age 40+)
 */

const AXIS_DETAILS: Record<string, { axis: string; label: string; detail: string }> = {
  O: { axis: "Moisture", label: "Oily", detail: "Your skin makes plenty of its own glow — lightweight, non-greasy layers work best." },
  D: { axis: "Moisture", label: "Dry", detail: "Your barrier wants extra moisture and lipids — richer textures are your friend." },
  S: { axis: "Sensitivity", label: "Sensitive", detail: "Quick to react — gentle, fragrance-free formulas keep things calm." },
  R: { axis: "Sensitivity", label: "Resistant", detail: "Sturdy skin that tolerates active ingredients well." },
  P: { axis: "Pigment", label: "Pigmented", detail: "Dark spots or uneven tone are a current focus — brightening care pays off." },
  N: { axis: "Pigment", label: "Even", detail: "Tone looks even overall — protect it and maintain." },
  W: { axis: "Aging", label: "Wrinkle-care", detail: "Fine lines are on the agenda — renewal ingredients earn their keep." },
  T: { axis: "Aging", label: "Tight", detail: "Firmness is on your side — prevention is the smartest play." },
};

const PERSONAS: Record<string, { name: string; tagline: string }> = {
  DRNT: { name: "The Effortless Classic", tagline: "Balanced, calm, and even — your skin mostly asks for consistency." },
  DRNW: { name: "The Timeless Polisher", tagline: "Smooth and steady, with first lines ready for renewal care." },
  DRPT: { name: "The Radiance Chaser", tagline: "Comfortable skin on a mission for a brighter, more even tone." },
  DRPW: { name: "The Glow Restorer", tagline: "Tone and early lines are the mission — and your resilient skin can handle the actives." },
  DSNT: { name: "The Gentle Minimalist", tagline: "Dry and easily unsettled — short, soothing routines win." },
  DSNW: { name: "The Tender Renewer", tagline: "Delicate skin that wants renewal — gently does it." },
  DSPT: { name: "The Soft-Glow Soother", tagline: "Brightening, but make it gentle — comfort comes first." },
  DSPW: { name: "The Delicate Restorer", tagline: "Dry, reactive, and chasing tone and firmness — slow, kind layers." },
  ORNT: { name: "The Fresh Powerhouse", tagline: "Oil to spare and tough as nails — keep it light and keep it clear." },
  ORNW: { name: "The Bold Renewer", tagline: "Resilient, glow-prone skin that's ready for serious renewal actives." },
  ORPT: { name: "The Clarity Seeker", tagline: "Shine and dark marks are the targets — and your skin can take the actives." },
  ORPW: { name: "The Luminous Fighter", tagline: "Tone, lines, and shine — a multitasking routine for skin that keeps up." },
  OSNT: { name: "The Balanced Calmer", tagline: "Glowy but reactive — lightweight calm is your sweet spot." },
  OSNW: { name: "The Sensitive Smoother", tagline: "Shine, sensitivity, and first lines — gentle renewal, always buffered." },
  OSPT: { name: "The Glow Guardian", tagline: "Oily, easily flushed, and tone-focused — barrier first, brightening second." },
  OSPW: { name: "The Gentle Brightener", tagline: "The full agenda — oil, sensitivity, tone, lines — handled gently, one step at a time." },
};

export function computeSkinCode(
  skinType: SkinType,
  sensitivity: Sensitivity,
  concerns: WeightedConcern[],
  quiz: QuizAnswers,
): SkinCode {
  const has = (id: string) => concerns.some((c) => c.id === id);

  const moisture =
    skinType === "oily" || skinType === "combination"
      ? "O"
      : skinType === "dry"
        ? "D"
        : has("oiliness")
          ? "O"
          : "D";

  const sens =
    sensitivity === "high" ? "S" : sensitivity === "low" ? "R" : has("redness") ? "S" : "R";

  const pigment = has("dark-spots") || has("uneven-tone") ? "P" : "N";

  const aging =
    has("fine-lines") || quiz.ageRange === "40s" || quiz.ageRange === "50-plus" ? "W" : "T";

  const code = `${moisture}${sens}${pigment}${aging}`;
  const persona = PERSONAS[code];

  return {
    code,
    name: persona.name,
    tagline: persona.tagline,
    axes: [moisture, sens, pigment, aging].map((letter) => ({
      letter,
      ...AXIS_DETAILS[letter],
    })),
  };
}
