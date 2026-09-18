import express from "express";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateProductUrl,
  allowedImage,
  fetchLimited,
  parseProduct,
} from "./catalog.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const storage = path.resolve(root, process.env.DATA_DIR || "data");
const app = express();
app.disable("x-powered-by");
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);
app.use("/api", (req, res, next) => {
  res.vary("Origin");
  const origin = req.get("Origin");
  const ownOrigin = `${req.protocol}://${req.get("host")}`;
  if (origin && origin !== ownOrigin) {
    if (!allowedOrigins.has(origin))
      return res.status(403).json({ error: "Origin not allowed." });
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Access-Control-Max-Age", "600");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "10kb" }));
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  next();
});
const readJson = async (file, fallback = []) => {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
};
async function atomicWrite(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = file + "." + randomUUID() + ".tmp";
  await writeFile(temporary, content);
  await rename(temporary, file);
}
const bundled = await readJson(
  path.join(root, process.env.CATALOG_FILE || "data/pages-products.json"),
);
app.get("/api/health", (_, res) =>
  res.json({ app: "fristads-logo-studio", status: "ok" }),
);
let imported = await readJson(path.join(storage, "imported.json"));
app.get("/api/products", (_, res) => {
  // Bundled products retain their reliable local images, even after a duplicate import.
  res.json([
    ...new Map([...imported, ...bundled].map((p) => [p.id, p])).values(),
  ]);
});
let pendingWrite = Promise.resolve();
app.post("/api/products/import", async (req, res) => {
  try {
    const url = validateProductUrl(req.body?.url),
      { buffer } = await fetchLimited(url),
      remote = parseProduct(buffer.toString("utf8"), url);
    const product = bundled.find((p) => p.id === remote.id) || remote;
    if (process.env.PERSIST_IMPORTS === "false") return res.json(product);
    pendingWrite = pendingWrite
      .catch(() => {})
      .then(async () => {
        const next = [...imported.filter((p) => p.id !== product.id), product];
        await atomicWrite(
          path.join(storage, "imported.json"),
          JSON.stringify(next, null, 2),
        );
        imported = next;
      });
    await pendingWrite;
    res.json(product);
  } catch (error) {
    res.status(400).json({
      error:
        error.name === "TimeoutError"
          ? "Fristadsin sivu ei vastannut ajoissa. Yritä uudelleen."
          : error.message,
    });
  }
});
function imageType(buffer) {
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
    return "image/jpeg";
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  return null;
}
const inflightImages = new Map();
async function imageBuffer(url) {
  const file = path.join(
    storage,
    "image-cache",
    createHash("sha256").update(url).digest("hex"),
  );
  try {
    const cached = await readFile(file);
    if (imageType(cached)) return cached;
  } catch (e) {
    if (e.code !== "ENOENT") console.warn("Image cache read:", e.message);
  }
  if (!inflightImages.has(url)) {
    inflightImages.set(
      url,
      (async () => {
        try {
          const { buffer } = await fetchLimited(url, 15_000_000);
          if (!imageType(buffer)) throw Error("Virheellinen kuvamuoto");
          await atomicWrite(file, buffer).catch((e) =>
            console.warn("Image cache write:", e.message),
          );
          return buffer;
        } finally {
          inflightImages.delete(url);
        }
      })(),
    );
  }
  return inflightImages.get(url);
}
app.get("/api/image", async (req, res) => {
  if (!allowedImage(req.query.url))
    return res.status(400).send("Virheellinen kuvaosoite");
  try {
    const buffer = await imageBuffer(req.query.url);
    res
      .set("Content-Type", imageType(buffer))
      .set("Cache-Control", "public, max-age=86400")
      .send(buffer);
  } catch {
    res.status(502).send("Kuvan hakeminen epäonnistui. Yritä uudelleen.");
  }
});
app.use("/api", (_, res) =>
  res.status(404).json({ error: "Rajapintaa ei löytynyt." }),
);
app.use((error, req, res, next) => {
  if (!error) return next();
  res.status(error.status || 500).json({
    error:
      error.type === "entity.too.large"
        ? "Pyyntö on liian suuri."
        : "Virheellinen pyyntö. Tarkista tiedot.",
  });
});
if (process.env.API_ONLY === "true") {
  app.use((_, res) => res.status(404).json({ error: "Not found." }));
} else if (process.argv.includes("--production")) {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*path}", (_, res) =>
    res.sendFile(path.join(root, "dist/index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.listen(
  Number(process.env.PORT || 3000),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      "Fristads Logo Studio: http://localhost:" + (process.env.PORT || 3000),
    ),
);
