import fs from "node:fs";
import path from "node:path";
import { describeFit, STEP_LABELS } from "./recommend";
import type { Product, ProductCategory, RoutineStep, SkinProfile } from "./types";

/**
 * Merchant-authored matching table: Skin Code → product handles per step.
 *
 * Drop a `data/code-matrix.json` into the repo (format: see
 * data/code-matrix.sample.json) and it takes priority over the automatic
 * ingredient engine for any code it lists. Codes not in the table — or
 * handles that don't resolve — fall back to the engine, so a partial table
 * is fine while you fill it in.
 */

export interface CodeMatrixRow {
  /** Optional overrides for the persona shown on the results page. */
  name?: string;
  tagline?: string;
  /** Product handles per routine step. */
  products: Partial<Record<ProductCategory, string[]>>;
}

export type CodeMatrix = Record<string, CodeMatrixRow>;

const CATEGORY_ORDER: ProductCategory[] = [
  "cleanser",
  "toner",
  "serum",
  "moisturizer",
  "sunscreen",
  "mask",
  "eye",
];

let cached: CodeMatrix | null | undefined;

export function loadCodeMatrix(): CodeMatrix | null {
  if (cached !== undefined) return cached;
  const p = path.join(process.cwd(), "data", "code-matrix.json");
  cached = fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as CodeMatrix) : null;
  return cached;
}

export function buildRoutineFromMatrix(
  row: CodeMatrixRow,
  profile: SkinProfile,
  products: Product[],
): RoutineStep[] {
  const byHandle = new Map(products.map((p) => [p.handle, p]));
  const routine: RoutineStep[] = [];

  for (const category of CATEGORY_ORDER) {
    const handles = row.products[category];
    if (!handles || handles.length === 0) continue;

    const picks = handles.flatMap((handle) => {
      const product = byHandle.get(handle);
      if (!product) {
        console.warn(`code-matrix: unknown product handle "${handle}" (${category})`);
        return [];
      }
      const rec = describeFit(product, profile);
      if (rec.matched.length === 0) {
        rec.why = `Hand-picked for your ${profile.skinCode.code} skin code.`;
      }
      return [rec];
    });

    if (picks.length > 0) routine.push({ step: STEP_LABELS[category], category, picks });
  }

  return routine;
}
