import {
  CONCERN_INGREDIENTS,
  CONCERN_LABELS,
  SENSITIVE_CAUTION,
  ingredientLabel,
} from "./ingredients";
import type {
  ConcernId,
  MatchedIngredient,
  Product,
  ProductCategory,
  Recommendation,
  RoutineStep,
  SkinProfile,
} from "./types";

/**
 * Rule-based recommendation engine.
 *
 * score(product) = Σ concernWeight × ingredientBenefit  (over matched ingredients)
 *                + skin-type fit bonus
 *                − sensitivity penalties (strong actives, fragrance)
 *
 * Deterministic and explainable: every pick carries the matched
 * ingredient → concern pairs it was chosen for.
 */

const CORE_STEPS: { category: ProductCategory; step: string; picks: number }[] = [
  { category: "cleanser", step: "Step 1 · Cleanser", picks: 1 },
  { category: "toner", step: "Step 2 · Toner", picks: 1 },
  { category: "serum", step: "Step 3 · Treat", picks: 2 },
  { category: "moisturizer", step: "Step 4 · Moisturize", picks: 1 },
  { category: "sunscreen", step: "Step 5 · Protect (AM)", picks: 1 },
];

const EXTRA_STEPS: { category: ProductCategory; step: string; picks: number; when: ConcernId[] }[] = [
  { category: "eye", step: "Bonus · Eye Care", picks: 1, when: ["dark-circles"] },
  { category: "mask", step: "Bonus · Weekly Mask", picks: 1, when: ["oiliness", "visible-pores", "breakouts"] },
];

function scoreProduct(product: Product, profile: SkinProfile): Recommendation {
  let score = 0;
  const matched: MatchedIngredient[] = [];

  for (const concern of profile.concerns) {
    for (const { ingredient, benefit } of CONCERN_INGREDIENTS[concern.id]) {
      if (product.keyIngredients.includes(ingredient)) {
        score += concern.weight * benefit;
        matched.push({
          ingredient,
          ingredientLabel: ingredientLabel(ingredient),
          concern: concern.id,
        });
      }
    }
  }

  if (product.suitedFor?.includes(profile.skinType)) score += 2;

  if (profile.sensitivity === "high") {
    const isRinseOff = product.category === "cleanser" || product.category === "mask";
    const hasCaution = product.keyIngredients.some((i) => SENSITIVE_CAUTION.includes(i));
    if (hasCaution && !isRinseOff) score -= 8;
    if (product.fragranceFree) score += 1;
  }

  return { product, score, matched, why: "" };
}

function buildWhy(rec: Recommendation, profile: SkinProfile): string {
  const parts: string[] = [];

  if (rec.matched.length > 0) {
    // Group matched pairs: ingredient → set of concerns (keep insertion order, cap for readability).
    const byIngredient = new Map<string, Set<ConcernId>>();
    for (const m of rec.matched) {
      if (!byIngredient.has(m.ingredientLabel)) byIngredient.set(m.ingredientLabel, new Set());
      byIngredient.get(m.ingredientLabel)!.add(m.concern);
    }
    const ingredients = [...byIngredient.keys()].slice(0, 3);
    const concernSet = new Set<ConcernId>();
    ingredients.forEach((label) => byIngredient.get(label)!.forEach((c) => concernSet.add(c)));
    const concernText = [...concernSet]
      .slice(0, 3)
      .map((c) => CONCERN_LABELS[c])
      .join(", ");
    const ingredientText =
      ingredients.length > 1
        ? `${ingredients.slice(0, -1).join(", ")} and ${ingredients[ingredients.length - 1]}`
        : ingredients[0];
    parts.push(`${ingredientText} target${ingredients.length === 1 ? "s" : ""} your ${concernText}.`);
  }

  if (rec.product.suitedFor?.includes(profile.skinType)) {
    parts.push(`Formulated with ${profile.skinType} skin in mind.`);
  }

  if (profile.sensitivity === "high" && rec.product.fragranceFree) {
    parts.push("Fragrance-free — a safer pick for reactive skin.");
  }

  return parts.join(" ") || "A well-rounded staple that fits your routine.";
}

export function buildRoutine(profile: SkinProfile, products: Product[]): RoutineStep[] {
  const concernIds = new Set(profile.concerns.map((c) => c.id));
  const steps = [
    ...CORE_STEPS,
    ...EXTRA_STEPS.filter((s) => s.when.some((c) => concernIds.has(c))),
  ];

  const routine: RoutineStep[] = [];

  for (const { category, step, picks } of steps) {
    const ranked = products
      .filter((p) => p.category === category)
      .map((p) => scoreProduct(p, profile))
      .sort((a, b) => b.score - a.score)
      .slice(0, picks);

    if (ranked.length === 0) continue;

    // Avoid recommending two serums that do the exact same job: if the runner-up
    // shares every matched ingredient with the winner, swap in the next candidate.
    if (ranked.length === 2) {
      const [first, second] = ranked;
      const firstSet = new Set(first.matched.map((m) => m.ingredient));
      const overlap =
        second.matched.length > 0 &&
        second.matched.every((m) => firstSet.has(m.ingredient));
      if (overlap) {
        const alternative = products
          .filter((p) => p.category === category && p.id !== first.product.id && p.id !== second.product.id)
          .map((p) => scoreProduct(p, profile))
          .sort((a, b) => b.score - a.score)[0];
        if (alternative && alternative.score > 0) ranked[1] = alternative;
      }
    }

    for (const rec of ranked) rec.why = buildWhy(rec, profile);
    routine.push({ step, category, picks: ranked });
  }

  return routine;
}
