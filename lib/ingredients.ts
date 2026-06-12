import type { ConcernId } from "./types";

/**
 * Ingredient knowledge base.
 *
 * This is the heart of the "전성분 매칭" idea: products carry canonical
 * ingredient slugs, and each skin concern maps to the ingredients known to
 * help it (benefit 1–3). The recommendation engine multiplies concern weight
 * by ingredient benefit to score every product.
 *
 * Edit freely — it's plain data, no code changes needed elsewhere.
 */

export interface IngredientInfo {
  label: string;
  /** Lowercased name fragments used by scripts/sync-products.mjs to normalize INCI/marketing names. */
  aliases: string[];
}

export const INGREDIENTS: Record<string, IngredientInfo> = {
  niacinamide: { label: "Niacinamide", aliases: ["niacinamide", "vitamin b3", "nicotinamide"] },
  "salicylic-acid": { label: "Salicylic Acid (BHA)", aliases: ["salicylic", "bha", "betaine salicylate"] },
  "glycolic-acid": { label: "Glycolic Acid (AHA)", aliases: ["glycolic", "aha"] },
  "lactic-acid": { label: "Lactic Acid", aliases: ["lactic acid"] },
  "azelaic-acid": { label: "Azelaic Acid", aliases: ["azelaic", "azeloyl"] },
  retinol: { label: "Retinol", aliases: ["retinol", "retinal", "retinaldehyde", "retinyl"] },
  bakuchiol: { label: "Bakuchiol", aliases: ["bakuchiol"] },
  "vitamin-c": { label: "Vitamin C", aliases: ["ascorbic", "ascorbyl", "vitamin c", "ascorbate"] },
  "tranexamic-acid": { label: "Tranexamic Acid", aliases: ["tranexamic"] },
  "alpha-arbutin": { label: "Alpha Arbutin", aliases: ["arbutin"] },
  "hyaluronic-acid": { label: "Hyaluronic Acid", aliases: ["hyaluronic", "hyaluronate", "hyaluron"] },
  glycerin: { label: "Glycerin", aliases: ["glycerin", "glycerine", "glycerol"] },
  squalane: { label: "Squalane", aliases: ["squalane", "squalene"] },
  ceramides: { label: "Ceramides", aliases: ["ceramide"] },
  panthenol: { label: "Panthenol (B5)", aliases: ["panthenol", "vitamin b5", "pantothenic"] },
  "centella-asiatica": { label: "Centella Asiatica", aliases: ["centella", "cica", "asiaticoside", "asiatic acid"] },
  madecassoside: { label: "Madecassoside", aliases: ["madecassoside", "madecassic"] },
  "green-tea": { label: "Green Tea", aliases: ["green tea", "camellia sinensis"] },
  "tea-tree": { label: "Tea Tree", aliases: ["tea tree", "melaleuca"] },
  "zinc-pca": { label: "Zinc PCA", aliases: ["zinc pca", "zinc"] },
  peptides: { label: "Peptides", aliases: ["peptide", "palmitoyl", "matrixyl", "copper tripeptide"] },
  "snail-mucin": { label: "Snail Mucin", aliases: ["snail"] },
  propolis: { label: "Propolis", aliases: ["propolis", "honey extract"] },
  mugwort: { label: "Mugwort", aliases: ["mugwort", "artemisia"] },
  "rice-extract": { label: "Rice Extract", aliases: ["rice", "oryza sativa"] },
  clay: { label: "Clay (Kaolin)", aliases: ["kaolin", "clay", "bentonite", "charcoal"] },
  allantoin: { label: "Allantoin", aliases: ["allantoin"] },
  "beta-glucan": { label: "Beta-Glucan", aliases: ["beta-glucan", "beta glucan"] },
  "licorice-root": { label: "Licorice Root", aliases: ["licorice", "glycyrrhiza"] },
  adenosine: { label: "Adenosine", aliases: ["adenosine"] },
  caffeine: { label: "Caffeine", aliases: ["caffeine"] },
};

/** concern → ingredients that help it, with benefit strength 1–3. */
export const CONCERN_INGREDIENTS: Record<ConcernId, { ingredient: string; benefit: 1 | 2 | 3 }[]> = {
  breakouts: [
    { ingredient: "salicylic-acid", benefit: 3 },
    { ingredient: "azelaic-acid", benefit: 3 },
    { ingredient: "niacinamide", benefit: 2 },
    { ingredient: "tea-tree", benefit: 2 },
    { ingredient: "zinc-pca", benefit: 2 },
    { ingredient: "propolis", benefit: 1 },
    { ingredient: "clay", benefit: 1 },
  ],
  redness: [
    { ingredient: "centella-asiatica", benefit: 3 },
    { ingredient: "madecassoside", benefit: 3 },
    { ingredient: "panthenol", benefit: 2 },
    { ingredient: "azelaic-acid", benefit: 2 },
    { ingredient: "mugwort", benefit: 2 },
    { ingredient: "allantoin", benefit: 2 },
    { ingredient: "green-tea", benefit: 1 },
    { ingredient: "beta-glucan", benefit: 1 },
  ],
  "dark-spots": [
    { ingredient: "vitamin-c", benefit: 3 },
    { ingredient: "tranexamic-acid", benefit: 3 },
    { ingredient: "alpha-arbutin", benefit: 3 },
    { ingredient: "niacinamide", benefit: 2 },
    { ingredient: "azelaic-acid", benefit: 2 },
    { ingredient: "licorice-root", benefit: 2 },
    { ingredient: "rice-extract", benefit: 1 },
  ],
  "uneven-tone": [
    { ingredient: "niacinamide", benefit: 3 },
    { ingredient: "vitamin-c", benefit: 2 },
    { ingredient: "lactic-acid", benefit: 2 },
    { ingredient: "rice-extract", benefit: 1 },
    { ingredient: "licorice-root", benefit: 1 },
  ],
  "visible-pores": [
    { ingredient: "niacinamide", benefit: 3 },
    { ingredient: "salicylic-acid", benefit: 2 },
    { ingredient: "clay", benefit: 2 },
    { ingredient: "zinc-pca", benefit: 1 },
  ],
  oiliness: [
    { ingredient: "niacinamide", benefit: 2 },
    { ingredient: "salicylic-acid", benefit: 2 },
    { ingredient: "clay", benefit: 2 },
    { ingredient: "zinc-pca", benefit: 2 },
    { ingredient: "green-tea", benefit: 1 },
  ],
  dryness: [
    { ingredient: "hyaluronic-acid", benefit: 3 },
    { ingredient: "ceramides", benefit: 3 },
    { ingredient: "squalane", benefit: 2 },
    { ingredient: "glycerin", benefit: 2 },
    { ingredient: "panthenol", benefit: 2 },
    { ingredient: "snail-mucin", benefit: 1 },
    { ingredient: "beta-glucan", benefit: 1 },
  ],
  "fine-lines": [
    { ingredient: "retinol", benefit: 3 },
    { ingredient: "peptides", benefit: 3 },
    { ingredient: "bakuchiol", benefit: 2 },
    { ingredient: "vitamin-c", benefit: 2 },
    { ingredient: "adenosine", benefit: 2 },
    { ingredient: "snail-mucin", benefit: 1 },
  ],
  dullness: [
    { ingredient: "vitamin-c", benefit: 3 },
    { ingredient: "glycolic-acid", benefit: 2 },
    { ingredient: "lactic-acid", benefit: 2 },
    { ingredient: "niacinamide", benefit: 1 },
    { ingredient: "rice-extract", benefit: 1 },
  ],
  "dark-circles": [
    { ingredient: "caffeine", benefit: 3 },
    { ingredient: "vitamin-c", benefit: 2 },
    { ingredient: "peptides", benefit: 1 },
    { ingredient: "niacinamide", benefit: 1 },
  ],
  texture: [
    { ingredient: "glycolic-acid", benefit: 3 },
    { ingredient: "lactic-acid", benefit: 2 },
    { ingredient: "salicylic-acid", benefit: 2 },
    { ingredient: "snail-mucin", benefit: 1 },
    { ingredient: "retinol", benefit: 1 },
  ],
};

/** Strong actives we steer away from for highly sensitive skin (leave-on products). */
export const SENSITIVE_CAUTION = ["retinol", "glycolic-acid", "lactic-acid"];

export const CONCERN_LABELS: Record<ConcernId, string> = {
  breakouts: "breakouts",
  redness: "redness",
  "dark-spots": "dark spots",
  "uneven-tone": "uneven tone",
  "visible-pores": "visible pores",
  oiliness: "excess oil",
  dryness: "dryness",
  "fine-lines": "fine lines",
  dullness: "dullness",
  "dark-circles": "dark circles",
  texture: "rough texture",
};

export function ingredientLabel(slug: string): string {
  return INGREDIENTS[slug]?.label ?? slug;
}
