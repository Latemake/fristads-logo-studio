import { readFileSync } from "node:fs";
export const bundledProducts = JSON.parse(
  readFileSync(new URL("../../data/products.json", import.meta.url), "utf8"),
);
