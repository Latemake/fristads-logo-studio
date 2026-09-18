import { readFile, writeFile } from "node:fs/promises";
import {
  singleItemCatalog,
  isMultiItemProduct,
} from "../src/catalog-policy.js";
import { CATEGORY_ORDER } from "../src/garments.js";
const original = JSON.parse(await readFile("data/pages-products.json", "utf8"));
const products = singleItemCatalog(original);
const excluded = original
  .filter(isMultiItemProduct)
  .map(({ id, name }) => ({ id, name }));
const report = JSON.parse(await readFile("data/catalog-report.json", "utf8"));
report.filteredAt = new Date().toISOString();
report.excluded = [
  ...new Map(
    [...(report.excluded || []), ...excluded].map((p) => [p.id, p]),
  ).values(),
];
report.total = products.length;
report.models = new Set(products.map((p) => p.id.slice(0, 6))).size;
report.categories = Object.fromEntries(
  CATEGORY_ORDER.map((c) => [
    c,
    products.filter((p) => p.category === c).length,
  ]),
);
await writeFile(
  "data/pages-products.json",
  JSON.stringify(products, null, 2) + "\n",
);
await writeFile(
  "data/catalog-report.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({ remaining: products.length, removed: excluded }, null, 2),
);
