/**
 * Shared types for the skin analysis + recommendation flow.
 */

export type SkinType = "dry" | "normal" | "combination" | "oily";
export type Sensitivity = "low" | "medium" | "high";

/** One canonical list of concern ids, shared by the quiz, the photo analysis and the engine. */
export const CONCERN_IDS = [
  "breakouts",
  "redness",
  "dark-spots",
  "uneven-tone",
  "visible-pores",
  "oiliness",
  "dryness",
  "fine-lines",
  "dullness",
  "dark-circles",
  "texture",
] as const;
export type ConcernId = (typeof CONCERN_IDS)[number];

export type Severity = "none" | "mild" | "moderate" | "prominent";

export interface QuizAnswers {
  /** "How does your skin feel a few hours after cleansing?" — drives skin type. */
  feelAfterCleansing: "tight" | "comfortable" | "oily-tzone" | "oily-all";
  /** Self-reported reactivity. */
  sensitivity: "often" | "sometimes" | "rarely";
  /** Up to 3 self-selected concerns. */
  concerns: ConcernId[];
  ageRange?: "under-20" | "20s" | "30s" | "40s" | "50-plus";
}

export interface SkinTone {
  fitzpatrick: "I" | "II" | "III" | "IV" | "V" | "VI";
  undertone: "warm" | "cool" | "neutral";
  description: string;
}

export interface PhotoFinding {
  id: ConcernId;
  severity: Severity;
  note: string;
}

export interface PhotoAnalysis {
  isFace: boolean;
  imageQuality: { ok: boolean; issues: string[] };
  skinTone: SkinTone;
  findings: PhotoFinding[];
  /** Friendly 2–3 sentence summary written for the customer. */
  summary: string;
}

export interface WeightedConcern {
  id: ConcernId;
  /** 1 (minor) – 4 (top priority). */
  weight: number;
  source: "quiz" | "photo" | "both";
}

export interface SkinProfile {
  skinType: SkinType;
  sensitivity: Sensitivity;
  tone?: SkinTone;
  concerns: WeightedConcern[];
  summary: string;
  /** True when produced without the AI photo analysis (no API key configured). */
  demo: boolean;
}

export type ProductCategory =
  | "cleanser"
  | "toner"
  | "serum"
  | "moisturizer"
  | "sunscreen"
  | "mask"
  | "eye";

export interface Product {
  id: string;
  handle: string;
  title: string;
  vendor?: string;
  category: ProductCategory;
  price: string;
  currencyCode: string;
  image?: string;
  url?: string;
  /** Canonical ingredient slugs — see lib/ingredients.ts. */
  keyIngredients: string[];
  suitedFor?: SkinType[];
  fragranceFree?: boolean;
  description?: string;
}

export interface MatchedIngredient {
  ingredient: string;
  ingredientLabel: string;
  concern: ConcernId;
}

export interface Recommendation {
  product: Product;
  score: number;
  why: string;
  matched: MatchedIngredient[];
}

export interface RoutineStep {
  step: string;
  category: ProductCategory;
  picks: Recommendation[];
}

export interface AnalyzeRequest {
  consent: boolean;
  quiz: QuizAnswers;
  image?: {
    /** base64 without the data: prefix */
    data: string;
    mediaType: "image/jpeg" | "image/png" | "image/webp";
  };
}

export interface AnalyzeResponse {
  profile: SkinProfile;
  routine: RoutineStep[];
}

export interface ApiError {
  error: { code: string; message: string };
}
