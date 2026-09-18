import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import sharp from "sharp";
import {
  fetchLimited,
  allowedImage,
  validateProductUrl,
} from "../server/catalog.js";
import { classifyGarment, CATEGORY_ORDER } from "../src/garments.js";

const cache = "data/catalog-cache";
await mkdir(cache, { recursive: true });
await mkdir("public/garments/catalog", { recursive: true });
const original = JSON.parse(await readFile("data/pages-products.json", "utf8"));
const products = new Map();
const failures = [];
const sources = new Set();
let nextRequest = 0;
async function cachedPage(url, file) {
  sources.add(url);
  try {
    if (process.argv.includes("--refresh"))
      throw Object.assign(new Error(), { code: "ENOENT" });
    return await readFile(file, "utf8");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  // Respect Fristads' published ten-second crawl interval. Cached pages make retries resumable.
  await new Promise((resolve) =>
    setTimeout(resolve, Math.max(0, nextRequest - Date.now())),
  );
  nextRequest = Date.now() + 10500;
  const { buffer } = await fetchLimited(url, 8_000_000);
  await writeFile(file, buffer);
  return buffer.toString("utf8");
}
function parseListing(html, url) {
  const $ = cheerio.load(html);
  const cards = $(".productlist__main-grid article.product");
  if (!cards.length) throw Error(`No products found on ${url}`);
  cards.each((_, card) => {
    const element = $(card);
    const productUrl = validateProductUrl(
      new URL(element.find("a.product-link").attr("href"), url).href,
    );
    const id = productUrl.match(/(\d{6}-\d{3})\/?$/)[1];
    const name = element.find(".product__details-name").text().trim();
    const brand = element.find(".product__details-brand").text().trim();
    const pictures = element.find("picture").toArray();
    const garmentPictures = pictures.filter(
      (p) => !/Model|Action/i.test($(p).attr("class") || ""),
    );
    const images = [
      ...new Set(
        (garmentPictures.length ? garmentPictures : pictures)
          .map((p) => {
            const img = $(p).find("img");
            return (
              img.attr("srcset")?.split(",")[0]?.trim().split(/\s+/)[0] ||
              img.attr("src")
            );
          })
          .filter(allowedImage),
      ),
    ];
    if (!name || !images.length) {
      failures.push({ id, url: productUrl, error: "Missing name or image" });
      return;
    }
    products.set(id, {
      id,
      name,
      brand,
      color: id.slice(-3),
      category: classifyGarment(name),
      url: productUrl,
      images,
      sourceImages: images,
      variants: [],
    });
  });
  return cards.length;
}
const rootUrl = "https://www.fristads.com/fi-fi/tuotteet";
const rootHtml = await cachedPage(rootUrl, `${cache}/all-fi-1.html`);
const root = cheerio.load(rootHtml);
const expected = Number(
  root("[data-js=articlelist-total-result]").first().text(),
);
const pageSize = parseListing(rootHtml, rootUrl);
// The unfiltered cumulative list fails beyond 1,000 cards on the source site.
// Its published color groups are smaller and together cover the catalog.
const groups = root('[data-filtertype="ColorGroup"]')
  .first()
  .find(".colorfilter__option")
  .toArray();
groups.push(
  ...root('[data-filtertype="Brand"]')
    .first()
    .find(".listfilter__option")
    .toArray()
    .filter(
      (element) =>
        Number(
          root(element)
            .find(".listfilter__option-hits")
            .text()
            .replace(/\D/g, ""),
        ) < 1000,
    ),
);
let page = 1;
for (const element of groups) {
  const option = root(element);
  const path = option.find("[data-filter-url]").attr("data-filter-url");
  if (!/^\/fi-fi\/tuotteet\/(?:color|brand)\/[a-z0-9-]+$/.test(path))
    throw Error("Unexpected color group URL");
  const count = Number(
    option
      .find(".colorfilter__option-hits, .listfilter__option-hits")
      .text()
      .replace(/\D/g, ""),
  );
  const last = Math.ceil(count / pageSize);
  const url = `https://www.fristads.com${path}${last > 1 ? `/page/${last}` : ""}`;
  const html = await cachedPage(
    url,
    `${cache}/group-${path.split("/").pop()}.html`,
  );
  const found = parseListing(html, url);
  if (found !== count)
    throw Error(`Incomplete group ${path}: expected ${count}, found ${found}`);
  page++;
  console.log(
    `Catalog group ${page - 1}/${groups.length}: ${products.size}/${expected} products`,
  );
}
if (products.size < expected) {
  const fallbackUrl = `${rootUrl}/page/27`;
  parseListing(
    await cachedPage(fallbackUrl, `${cache}/all-fi-27.html`),
    fallbackUrl,
  );
  console.log(
    `Including products without a color filter: ${products.size}/${expected}`,
  );
}
if (products.size < expected) {
  const brandUrl = `${rootUrl}/brand/fristads-29`;
  const doc = cheerio.load(
    await cachedPage(brandUrl, `${cache}/brand-fristads-first.html`),
  );
  for (const element of doc('[data-filtertype="Gender"]')
    .first()
    .find(".listfilter__option")
    .toArray()) {
    const option = doc(element);
    const path = option.find("[data-filter-url]").attr("data-filter-url");
    if (
      !/^\/fi-fi\/tuotteet\/gender\/(male|female|unisex|dual)\/brand\/fristads-29$/.test(
        path,
      )
    )
      throw Error("Unexpected gender partition");
    const count = Number(
      option.find(".listfilter__option-hits").text().replace(/\D/g, ""),
    );
    const last = Math.ceil(count / pageSize);
    const url = `https://www.fristads.com${path}${last > 1 ? `/page/${last}` : ""}`;
    parseListing(
      await cachedPage(url, `${cache}/gender-${path.split("/")[4]}.html`),
      url,
    );
    console.log(`Manufacturer cross-check: ${products.size}/${expected}`);
    if (products.size === expected) break;
  }
}
if (products.size < expected) {
  const categoryPaths = [
    ...new Set(
      root("a[href]")
        .map((_, el) => root(el).attr("href"))
        .get()
        .filter((path) => /^\/fi-fi\/tuotteet\/group\/[a-z0-9-]+$/.test(path)),
    ),
  ];
  categoryPaths.sort(
    (a, b) => Number(!a.includes("college")) - Number(!b.includes("college")),
  );
  for (const path of categoryPaths) {
    const url = `https://www.fristads.com${path}`;
    const html = await cachedPage(
      url,
      `${cache}/category-${path.split("/").pop()}-1.html`,
    );
    const doc = cheerio.load(html);
    const count = Number(
      doc("[data-js=articlelist-total-result]").first().text(),
    );
    parseListing(html, url);
    const last = Math.ceil(count / pageSize);
    if (last > 1 && last < 28)
      parseListing(
        await cachedPage(
          `${url}/page/${last}`,
          `${cache}/category-${path.split("/").pop()}-${last}.html`,
        ),
        url,
      );
    page++;
    console.log(`Category cross-check: ${products.size}/${expected}`);
    if (products.size === expected) break;
  }
}
await writeFile(
  `${cache}/discovered.json`,
  JSON.stringify([...products.values()], null, 2),
);
if (!expected || products.size !== expected)
  throw Error(
    `Incomplete catalog: expected ${expected}, found ${products.size}. Existing catalog is unchanged.`,
  );
await writeFile(
  `${cache}/discovered.json`,
  JSON.stringify([...products.values()], null, 2),
);
const colors = new Map();
for (const p of original) {
  if (p.color && !/^\d+$/.test(p.color))
    colors.set(p.id.slice(-3), {
      name: p.color,
      colors: p.variants?.find((v) => v.id === p.id)?.colors || ["#999999"],
    });
  for (const v of p.variants || [])
    if (!/^\d+$/.test(v.name)) colors.set(v.id.slice(-3), v);
}
const models = new Map();
for (const p of products.values()) {
  p.color = colors.get(p.id.slice(-3))?.name || p.color;
  const family = models.get(p.id.slice(0, 6)) || [];
  family.push({
    id: p.id,
    name: p.color,
    url: p.url,
    colors: colors.get(p.id.slice(-3))?.colors || ["#999999"],
  });
  models.set(p.id.slice(0, 6), family);
}
let completed = 0;
const queue = [...products.values()];
const output = [];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const p = queue.shift();
      try {
        const previous = original.find((old) => old.id === p.id);
        if (
          previous &&
          previous.images.every((src) => src.startsWith("/garments/"))
        ) {
          p.images = previous.images;
          p.sourceImages = previous.sourceImages || p.sourceImages;
          p.color = previous.color;
        } else {
          p.images = await Promise.all(
            p.sourceImages.map(async (src) => {
              const file = `/garments/catalog/${createHash("sha256").update(src).digest("hex").slice(0, 24)}.webp`;
              try {
                await readFile("public" + file);
              } catch (e) {
                if (e.code !== "ENOENT") throw e;
                let buffer;
                for (let attempt = 0; attempt < 3; attempt++) {
                  try {
                    buffer = (await fetchLimited(src, 15_000_000)).buffer;
                    break;
                  } catch (error) {
                    if (attempt === 2) throw error;
                    await new Promise((resolve) =>
                      setTimeout(resolve, 1000 * (attempt + 1)),
                    );
                  }
                }
                const temporary = "public" + file + "." + p.id + ".tmp";
                await sharp(buffer)
                  .resize({
                    width: 1200,
                    height: 1400,
                    fit: "inside",
                    withoutEnlargement: true,
                  })
                  .webp({ quality: 86 })
                  .toFile(temporary);
                await rename(temporary, "public" + file);
              }
              return file;
            }),
          );
        }
        p.variants = models.get(p.id.slice(0, 6));
        output.push(p);
      } catch (error) {
        failures.push({ id: p.id, url: p.url, error: error.message });
      }
      completed++;
      if (completed % 100 === 0)
        console.log(`Images: ${completed}/${products.size}`);
    }
  }),
);
await writeFile(`${cache}/failures.json`, JSON.stringify(failures, null, 2));
if (failures.length)
  throw Error(
    `${failures.length} products failed; see ${cache}/failures.json. Existing published catalog is unchanged.`,
  );
// Retain existing garments so saved designs and their view indexes stay valid.
for (const p of original) if (!products.has(p.id)) output.push(p);
const ids = new Set(output.map((p) => p.id));
for (const p of output) p.variants = p.variants.filter((v) => ids.has(v.id));
const priority = new Map(original.map((p, index) => [p.id, index]));
output.sort(
  (a, b) =>
    (priority.get(a.id) ?? 10000) - (priority.get(b.id) ?? 10000) ||
    CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
    a.name.localeCompare(b.name, "fi") ||
    a.id.localeCompare(b.id),
);
await writeFile(
  "data/pages-products.json.tmp",
  JSON.stringify(output, null, 2) + "\n",
);
await rename("data/pages-products.json.tmp", "data/pages-products.json");
const report = {
  updatedAt: new Date().toISOString(),
  source: "https://www.fristads.com/fi-fi/tuotteet",
  pages: sources.size,
  discovered: products.size,
  total: output.length,
  models: new Set(output.map((p) => p.id.slice(0, 6))).size,
  categories: Object.fromEntries(
    CATEGORY_ORDER.map((c) => [
      c,
      output.filter((p) => p.category === c).length,
    ]),
  ),
  failures,
};
await writeFile(
  "data/catalog-report.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
