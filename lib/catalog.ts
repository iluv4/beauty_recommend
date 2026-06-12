import fs from "node:fs";
import path from "node:path";
import type { Product } from "./types";

/**
 * Loads the product catalog.
 *
 * - `data/products.json` — generated from your real Shopify store by
 *   `npm run sync-products` (gitignored).
 * - `data/products.sample.json` — bundled demo catalog used until you sync.
 */

let cache: { products: Product[]; isSample: boolean } | null = null;

export function loadCatalog(): { products: Product[]; isSample: boolean } {
  if (cache) return cache;

  const dataDir = path.join(process.cwd(), "data");
  const syncedPath = path.join(dataDir, "products.json");
  const samplePath = path.join(dataDir, "products.sample.json");

  if (fs.existsSync(syncedPath)) {
    const products = JSON.parse(fs.readFileSync(syncedPath, "utf8")) as Product[];
    if (products.length > 0) {
      cache = { products, isSample: false };
      return cache;
    }
  }

  const products = JSON.parse(fs.readFileSync(samplePath, "utf8")) as Product[];
  cache = { products, isSample: true };
  return cache;
}
