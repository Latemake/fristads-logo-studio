import { readFile, writeFile } from "node:fs/promises";
import { fetchLimited, allowedImage } from "../server/catalog.js";
const bundled = JSON.parse(await readFile("data/products.json", "utf8"));
const imported = JSON.parse(
  await readFile("data/imported.json", "utf8").catch(() => "[]"),
);
const products = [
  ...new Map([...imported, ...bundled].map((p) => [p.id, p])).values(),
];
for (const product of products) {
  const originals = [...product.images];
  product.images = await Promise.all(
    originals.map(async (src, i) => {
      if (!src.startsWith("https:")) return src;
      if (!allowedImage(src)) throw Error("Invalid garment image");
      const file = `/garments/${product.id}-${i}.jpg`;
      const { buffer } = await fetchLimited(src);
      if (buffer[0] !== 255 || buffer[1] !== 216)
        throw Error("Expected JPEG: " + src);
      await writeFile("public" + file, buffer);
      return file;
    }),
  );
  product.sourceImages = product.sourceImages || originals;
  product.variants = (product.variants || []).filter((v) =>
    products.some((p) => p.id === v.id),
  );
}
await writeFile(
  "data/pages-products.json",
  JSON.stringify(products, null, 2) + "\n",
);
console.log(`Prepared ${products.length} garments for Pages.`);
