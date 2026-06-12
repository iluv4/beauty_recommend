import { computeSkinCode } from "./skin-code";
import type {
  ConcernId,
  PhotoAnalysis,
  QuizAnswers,
  Sensitivity,
  SkinProfile,
  SkinType,
  WeightedConcern,
} from "./types";

/**
 * Merges quiz answers (self-reported) with the photo analysis (observed)
 * into one SkinProfile that drives recommendations.
 *
 * Division of labor — photos can't reliably tell oily from dry, and quizzes
 * can't tell tone, so:
 *  - skin type / baseline sensitivity ← quiz
 *  - tone, visible concerns, summary  ← photo
 *  - concern weights                  ← both (boosted when they agree)
 */

const SKIN_TYPE_FROM_QUIZ: Record<QuizAnswers["feelAfterCleansing"], SkinType> = {
  tight: "dry",
  comfortable: "normal",
  "oily-tzone": "combination",
  "oily-all": "oily",
};

const SENSITIVITY_FROM_QUIZ: Record<QuizAnswers["sensitivity"], Sensitivity> = {
  often: "high",
  sometimes: "medium",
  rarely: "low",
};

const SEVERITY_WEIGHT: Record<string, number> = {
  none: 0,
  mild: 1,
  moderate: 2,
  prominent: 3,
};

export function buildProfile(
  quiz: QuizAnswers,
  photo: PhotoAnalysis,
  demo: boolean,
): SkinProfile {
  const skinType = SKIN_TYPE_FROM_QUIZ[quiz.feelAfterCleansing];
  let sensitivity = SENSITIVITY_FROM_QUIZ[quiz.sensitivity];

  // Visible redness corroborates reactivity — bump sensitivity one level.
  const redness = photo.findings.find((f) => f.id === "redness");
  if (redness && SEVERITY_WEIGHT[redness.severity] >= 2 && sensitivity === "medium") {
    sensitivity = "high";
  }

  const concerns = new Map<ConcernId, WeightedConcern>();

  quiz.concerns.forEach((id, i) => {
    concerns.set(id, { id, weight: i === 0 ? 3 : 2, source: "quiz" });
  });

  for (const finding of photo.findings) {
    const w = SEVERITY_WEIGHT[finding.severity] ?? 0;
    if (w === 0) continue;
    const existing = concerns.get(finding.id);
    if (existing) {
      existing.weight = Math.min(4, Math.max(existing.weight, w) + 1);
      existing.source = "both";
    } else {
      concerns.set(finding.id, { id: finding.id, weight: w, source: "photo" });
    }
  }

  // Dry skin types rarely want oil-control products even if the photo caught shine.
  if (skinType === "dry") concerns.delete("oiliness");

  const sorted = [...concerns.values()].sort((a, b) => b.weight - a.weight).slice(0, 5);

  return {
    skinType,
    sensitivity,
    skinCode: computeSkinCode(skinType, sensitivity, sorted, quiz),
    tone: photo.isFace ? photo.skinTone : undefined,
    concerns: sorted,
    scores: photo.scores,
    summary: photo.summary,
    demo,
  };
}
