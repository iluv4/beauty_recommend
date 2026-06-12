#!/usr/bin/env node
/**
 * Generates a local placeholder image (SVG) for every product in
 * data/products.sample.json, written to public/products/<handle>.svg.
 *
 * Why local SVGs instead of remote photos: the bundled demo catalog lists real
 * retail products, but their image CDNs often block hotlinking and the URLs
 * change. App-served SVGs always render, so the photo → recommendation flow
 * looks complete out of the box. Replace these with real product photos by
 * running `npm run sync-products` (pulls Shopify featured images) or by adding
 * an `image` URL to each product.
 *
 * Usage: npm run gen-images
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CATALOG = path.join(ROOT, "data", "products.sample.json");
const OUT_DIR = path.join(ROOT, "public", "products");

// Per-category palette: [gradient top, gradient bottom, ink].
const PALETTE = {
  cleanser: ["#d8f3f0", "#a7e3df", "#0f4f4a"],
  toner: ["#ece7fb", "#cdbdf2", "#3f2f6e"],
  serum: ["#ffe9d6", "#ffc7a8", "#7a3b18"],
  moisturizer: ["#e6f3da", "#c2e3a3", "#355218"],
  sunscreen: ["#fff3c9", "#ffe08a", "#7a5a00"],
  mask: ["#e4e7ec", "#c3ccd9", "#2f3a4a"],
  eye: ["#fde4ef", "#f7bcd8", "#7a1f4f"],
};
const FALLBACK = ["#eee", "#ccc", "#333"];

const xml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** Greedy word-wrap into at most `maxLines` lines of ~`maxChars` chars. */
function wrap(text, maxChars = 15, maxLines = 3) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines - 1) break;
    } else {
      line = candidate;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  // Anything left over gets an ellipsis on the last line.
  const used = lines.join(" ").length;
  if (used < text.length && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1]}…`;
  }
  return lines;
}

function svgFor(product) {
  const [top, bottom, ink] = PALETTE[product.category] ?? FALLBACK;
  const titleLines = wrap(product.title, 15, 3);
  const titleSize = titleLines.length >= 3 ? 50 : titleLines.length === 2 ? 58 : 66;
  const startY = 312 - (titleLines.length - 1) * (titleSize * 0.6);

  const titleTspans = titleLines
    .map(
      (ln, i) =>
        `<tspan x="300" y="${Math.round(startY + i * titleSize * 1.18)}">${xml(ln)}</tspan>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600" role="img" aria-label="${xml(
    product.vendor ? `${product.vendor} ${product.title}` : product.title,
  )}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/>
      <stop offset="1" stop-color="${bottom}"/>
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#bg)"/>
  <circle cx="300" cy="300" r="250" fill="#ffffff" opacity="0.18"/>
  <!-- abstract bottle silhouette -->
  <g fill="#ffffff" opacity="0.30">
    <rect x="262" y="120" width="76" height="34" rx="8"/>
    <rect x="232" y="158" width="136" height="300" rx="34"/>
  </g>
  <text x="300" y="180" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="700" letter-spacing="3" fill="${ink}" opacity="0.85">${xml(
    (product.vendor ?? "").toUpperCase(),
  )}</text>
  <text text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${titleSize}" font-weight="700" fill="${ink}">${titleTspans}</text>
  <text x="300" y="486" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="26" letter-spacing="4" fill="${ink}" opacity="0.7">${xml(
    product.category.toUpperCase(),
  )}</text>
</svg>
`;
}

const products = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
fs.mkdirSync(OUT_DIR, { recursive: true });

let count = 0;
for (const p of products) {
  if (!p.handle) continue;
  fs.writeFileSync(path.join(OUT_DIR, `${p.handle}.svg`), svgFor(p));
  count += 1;
}

console.log(`✔ Wrote ${count} placeholder images to public/products/`);
