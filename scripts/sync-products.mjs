#!/usr/bin/env node
/**
 * Pulls products from your Shopify store into data/products.json,
 * which the recommendation engine uses instead of the bundled samples.
 *
 * Usage:
 *   SHOPIFY_STORE_DOMAIN=your-store.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxx \
 *   npm run sync-products
 *
 * Per product, the script needs:
 *   - key ingredients → metafield `custom.key_ingredients`
 *       (type "list of single-line text", or a comma-separated single line)
 *   - category        → tag `category:serum` (etc.), or inferred from
 *       productType/title keywords
 *   - optional tags   → `skin:oily` `skin:dry` `skin:combination` `skin:normal`,
 *       `fragrance-free`
 */

import fs from "node:fs";
import path from "node:path";

const DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2025-07";
const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || (DOMAIN ? `https://${DOMAIN}` : "");

if (!DOMAIN || !TOKEN) {
  console.error(
    "Missing env vars. Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN (Admin API access token with read_products).",
  );
  process.exit(1);
}

// ── Ingredient normalization ──────────────────────────────────────────────
// KEEP IN SYNC with lib/ingredients.ts (slug → aliases). The matcher checks
// whether a lowercased ingredient name contains any alias fragment.
const ALIASES = {
  niacinamide: ["niacinamide", "vitamin b3", "nicotinamide"],
  "salicylic-acid": ["salicylic", "bha", "betaine salicylate"],
  "glycolic-acid": ["glycolic", "aha"],
  "lactic-acid": ["lactic acid"],
  "azelaic-acid": ["azelaic", "azeloyl"],
  retinol: ["retinol", "retinal", "retinaldehyde", "retinyl"],
  bakuchiol: ["bakuchiol"],
  "vitamin-c": ["ascorbic", "ascorbyl", "vitamin c", "ascorbate"],
  "tranexamic-acid": ["tranexamic"],
  "alpha-arbutin": ["arbutin"],
  "hyaluronic-acid": ["hyaluronic", "hyaluronate", "hyaluron"],
  glycerin: ["glycerin", "glycerine", "glycerol"],
  squalane: ["squalane", "squalene"],
  ceramides: ["ceramide"],
  panthenol: ["panthenol", "vitamin b5", "pantothenic"],
  "centella-asiatica": ["centella", "cica", "asiaticoside", "asiatic acid"],
  madecassoside: ["madecassoside", "madecassic"],
  "green-tea": ["green tea", "camellia sinensis"],
  "tea-tree": ["tea tree", "melaleuca"],
  "zinc-pca": ["zinc pca", "zinc"],
  peptides: ["peptide", "palmitoyl", "matrixyl", "copper tripeptide"],
  "snail-mucin": ["snail"],
  propolis: ["propolis", "honey extract"],
  mugwort: ["mugwort", "artemisia"],
  "rice-extract": ["rice", "oryza sativa"],
  clay: ["kaolin", "clay", "bentonite", "charcoal"],
  allantoin: ["allantoin"],
  "beta-glucan": ["beta-glucan", "beta glucan"],
  "licorice-root": ["licorice", "glycyrrhiza"],
  adenosine: ["adenosine"],
  caffeine: ["caffeine"],
};

function normalizeIngredient(raw) {
  const name = raw.trim().toLowerCase();
  if (!name) return null;
  if (ALIASES[name]) return name; // already a slug
  for (const [slug, aliases] of Object.entries(ALIASES)) {
    if (aliases.some((a) => name.includes(a))) return slug;
  }
  return null;
}

function parseIngredients(metafieldValue) {
  if (!metafieldValue) return { slugs: [], unknown: [] };
  let names;
  try {
    const parsed = JSON.parse(metafieldValue); // list-type metafields are JSON arrays
    names = Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch {
    names = metafieldValue.split(/[,;|]/);
  }
  const slugs = new Set();
  const unknown = [];
  for (const n of names) {
    const slug = normalizeIngredient(String(n));
    if (slug) slugs.add(slug);
    else if (String(n).trim()) unknown.push(String(n).trim());
  }
  return { slugs: [...slugs], unknown };
}

// ── Category inference ────────────────────────────────────────────────────
const CATEGORY_KEYWORDS = [
  ["cleanser", ["cleanser", "cleansing", "face wash", "facial wash", "foam"]],
  ["toner", ["toner", "mist", "facial spray"]],
  ["sunscreen", ["sunscreen", "sun screen", "spf", "uv "]],
  ["mask", ["mask", "masque", "peel-off", "sheet"]],
  ["eye", ["eye cream", "eye serum", "eye gel", "under-eye", "undereye"]],
  ["moisturizer", ["moisturizer", "moisturiser", "cream", "lotion", "emulsion", "balm"]],
  ["serum", ["serum", "ampoule", "essence", "treatment", "booster", "oil"]],
];

function inferCategory(tags, productType, title) {
  const explicit = tags.find((t) => t.toLowerCase().startsWith("category:"));
  if (explicit) return explicit.slice("category:".length).trim().toLowerCase();
  const haystack = `${productType} ${title}`.toLowerCase();
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => haystack.includes(k))) return category;
  }
  return null;
}

// ── Shopify Admin GraphQL ─────────────────────────────────────────────────
const QUERY = `
  query Products($cursor: String) {
    products(first: 100, after: $cursor, query: "status:active") {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        title
        handle
        vendor
        productType
        tags
        onlineStoreUrl
        featuredMedia { preview { image { url } } }
        priceRangeV2 { minVariantPrice { amount currencyCode } }
        metafield(namespace: "custom", key: "key_ingredients") { value }
      }
    }
  }
`;

async function shopifyGraphQL(variables) {
  const res = await fetch(`https://${DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": TOKEN,
    },
    body: JSON.stringify({ query: QUERY, variables }),
  });
  if (!res.ok) {
    throw new Error(`Shopify API ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  if (json.errors) throw new Error(`Shopify GraphQL: ${JSON.stringify(json.errors)}`);
  return json.data;
}

async function main() {
  const products = [];
  const skipped = [];
  const noIngredients = [];
  let cursor = null;

  do {
    const data = await shopifyGraphQL({ cursor });
    const page = data.products;

    for (const node of page.nodes) {
      const tags = node.tags ?? [];
      const category = inferCategory(tags, node.productType ?? "", node.title);
      if (!category) {
        skipped.push(node.title);
        continue;
      }

      const { slugs, unknown } = parseIngredients(node.metafield?.value);
      if (slugs.length === 0) noIngredients.push(node.title);
      if (unknown.length > 0) {
        console.warn(`  · "${node.title}": unmatched ingredients → ${unknown.join(", ")}`);
      }

      const suitedFor = tags
        .filter((t) => t.toLowerCase().startsWith("skin:"))
        .map((t) => t.slice("skin:".length).trim().toLowerCase())
        .filter((t) => ["dry", "normal", "combination", "oily"].includes(t));

      products.push({
        id: node.id,
        handle: node.handle,
        title: node.title,
        vendor: node.vendor || undefined,
        category,
        price: Number.parseFloat(node.priceRangeV2.minVariantPrice.amount).toFixed(2),
        currencyCode: node.priceRangeV2.minVariantPrice.currencyCode,
        image: node.featuredMedia?.preview?.image?.url,
        url: node.onlineStoreUrl || (STORE_URL ? `${STORE_URL}/products/${node.handle}` : undefined),
        keyIngredients: slugs,
        suitedFor: suitedFor.length > 0 ? suitedFor : undefined,
        fragranceFree: tags.some((t) => t.toLowerCase() === "fragrance-free") || undefined,
      });
    }

    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);

  const outPath = path.join(process.cwd(), "data", "products.json");
  fs.writeFileSync(outPath, JSON.stringify(products, null, 2));

  console.log(`\n✔ Wrote ${products.length} products to data/products.json`);
  if (skipped.length > 0) {
    console.log(`⚠ Skipped ${skipped.length} (no category match — add a "category:<x>" tag):`);
    skipped.forEach((t) => console.log(`  - ${t}`));
  }
  if (noIngredients.length > 0) {
    console.log(
      `⚠ ${noIngredients.length} products have no key ingredients (metafield custom.key_ingredients) — they'll rarely be recommended:`,
    );
    noIngredients.forEach((t) => console.log(`  - ${t}`));
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
