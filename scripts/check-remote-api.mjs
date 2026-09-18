import express from "express";
import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { build } from "vite";

const origin = "http://127.0.0.1:3180";
const api = "http://127.0.0.1:3183";
const bundled = JSON.parse(await readFile("data/products.json", "utf8"));
const catalog = JSON.parse(await readFile("data/pages-products.json", "utf8"));
const variant = bundled[0].variants.find(
  (v) => !bundled.some((p) => p.id === v.id),
);
expect(variant).toBeTruthy();
process.env.VITE_API_URL = api;
await build({ mode: "pages", build: { outDir: "test-results/remote-pages" } });
const backend = spawn(
  process.execPath,
  ["scripts/test-server.mjs", "--production"],
  {
    env: {
      ...process.env,
      PORT: "3183",
      API_ONLY: "true",
      PERSIST_IMPORTS: "false",
      ALLOWED_ORIGINS: origin,
    },
    stdio: "inherit",
  },
);
const app = express();
// Exclude this real color from the test snapshot to exercise remote import even
// when the production snapshot already contains the manufacturer's full range.
app.get("/fristads-logo-studio/catalog.json", (_, res) =>
  res.json(catalog.filter((p) => p.id !== variant.id)),
);
app.use("/fristads-logo-studio", express.static("test-results/remote-pages"));
const server = app.listen(3180, "127.0.0.1");
const browser = await chromium.launch();
try {
  await expect
    .poll(async () => {
      try {
        return (await fetch(api + "/api/health")).status;
      } catch {
        return 0;
      }
    })
    .toBe(200);
  expect(
    (
      await fetch(api + "/api/health", {
        headers: { Origin: "https://unrelated.example" },
      })
    ).status,
  ).toBe(403);
  const preflight = await fetch(api + "/api/products/import", {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  expect(preflight.status).toBe(204);
  expect(preflight.headers.get("access-control-allow-origin")).toBe(origin);
  const page = await browser.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") console.error(message.text());
  });
  page.on("requestfailed", (request) =>
    console.error("Request failed", request.url(), request.failure()),
  );
  page.on("response", (response) => {
    if (response.status() >= 400)
      console.error("HTTP", response.status(), response.url());
  });
  const failures = [],
    images = [];
  page.on("pageerror", (e) => failures.push(e.message));
  page.on("response", (r) => {
    if (r.url().startsWith(api + "/api/image") && r.ok()) images.push(r.url());
  });
  await page.goto(origin + "/fristads-logo-studio/");
  await page.getByRole("button", { name: "Add by product link" }).click();
  await page.getByLabel("Product link", { exact: true }).fill(variant.url);
  await page.getByRole("button", { name: "Add garment", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 60000 });
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "logo.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="60"><text x="0" y="48" fill="white" font-size="48">NORTH</text></svg>',
      ),
    });
  await expect(page.locator(".logo-row")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Download preview" }),
  ).toBeEnabled({ timeout: 30000 });
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download preview" }).click();
  const downloaded = await pending;
  expect((await readFile(await downloaded.path())).length).toBeGreaterThan(
    10000,
  );
  expect(images.length).toBeGreaterThan(0);
  await page.reload();
  await expect(page.locator(".logo-row")).toHaveCount(1);
  await expect(page.locator(".product-info")).toContainText(variant.id);
  await expect(
    page.getByRole("button", { name: "Download preview" }),
  ).toBeEnabled();
  expect(failures).toEqual([]);
  console.log(
    "Remote API: real product import, CORS, image proxy, PNG export and persistence passed.",
  );
} finally {
  await browser.close();
  server.close();
  backend.kill();
}
