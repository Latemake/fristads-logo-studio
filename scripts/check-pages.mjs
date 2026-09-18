import express from "express";
import { chromium, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
const app = express();
app.use("/fristads-logo-studio", express.static("dist-pages"));
const server = app.listen(3180, "127.0.0.1");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1000 },
  });
  const failures = [],
    api = [];
  await page.addInitScript(() =>
    localStorage.setItem("logo-studio-language", "fi"),
  );
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  page.on("request", (request) => {
    if (request.url().includes("/api/")) api.push(request.url());
  });
  await page.goto(
    process.env.TEST_SITE || "http://127.0.0.1:3180/fristads-logo-studio/",
  );
  const products = JSON.parse(
    await readFile("data/pages-products.json", "utf8"),
  );
  await expect(page.locator(".product-card")).toHaveCount(
    Math.min(48, products.length),
  );
  await expect(page.locator(".brand img")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lisää tuotelinkillä" }),
  ).toHaveCount(0);
  // Decode every shipped image and verify every variant target, without downloading
  // thousands of large images into a single browser tab.
  const ids = new Set(products.map((p) => p.id));
  for (const p of products)
    for (const v of p.variants || []) expect(ids.has(v.id)).toBe(true);
  const images = [...new Set(products.flatMap((p) => p.images))];
  for (const src of images) {
    const metadata = await sharp("dist-pages" + src).metadata();
    expect(metadata.width).toBeGreaterThan(0);
    expect(metadata.height).toBeGreaterThan(0);
  }
  if (products.length > 48) {
    await page.getByRole("button", { name: "Seuraava sivu" }).click();
    await expect(page.locator(".product-card").first()).toContainText(
      products[48].name,
    );
    await page.getByRole("button", { name: "Edellinen sivu" }).click();
  }
  for (const category of [...new Set(products.map((p) => p.category))]) {
    await page.getByLabel("Tuoteryhmä").selectOption(category);
    await expect(page.locator(".product-card")).toHaveCount(
      Math.min(48, products.filter((p) => p.category === category).length),
    );
    await page.locator(".product-card").first().click();
    await expect(
      page.getByRole("button", { name: "Lataa esikatselu" }),
    ).toBeEnabled();
    await expect(page.locator(".canvas-status")).toHaveCount(0);
  }
  // Export an actual newly imported WebP garment and round-trip its project metadata.
  const added =
    products.find((p) => p.images[0].endsWith(".webp")) || products[0];
  await page.getByLabel("Tuoteryhmä").selectOption("Kaikki");
  await page.getByLabel("Etsi vaatetta").fill(added.id);
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.locator(".product-card").click();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "logo.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="60"><text x="0" y="48" fill="white" font-size="48">NORTH</text></svg>',
      ),
    });
  await expect(
    page.getByRole("button", { name: "Painettu ilme", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /Poista valkoinen tausta|Remove white background|Ta bort vit bakgrund/i })).toHaveCount(0);
  for (const [name, extension] of [
    ["Lataa esikatselu", ".png"],
    ["Lataa yhteenveto", ".pdf"],
    ["Tallenna suunnitelma", ".json"],
  ]) {
    const pending = page.waitForEvent("download");
    await page
      .getByRole("button", { name, exact: name === "Tallenna suunnitelma" })
      .click();
    const download = await pending;
    expect(download.suggestedFilename().endsWith(extension)).toBeTruthy();
    expect((await readFile(await download.path())).length).toBeGreaterThan(100);
    if (extension === ".json") {
      await page
        .locator('input[type="file"]')
        .nth(1)
        .setInputFiles(await download.path());
      await expect(page.locator(".product-info")).toContainText(added.id);
    }
  }
  await page.reload();
  await expect(page.locator(".logo-row")).toHaveCount(1);
  await page.screenshot({ path: "test-results/pages-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/pages-mobile.png",
    fullPage: true,
  });
  expect(failures).toEqual([]);
  expect(api).toEqual([]);
  console.log(
    `Pages: ${products.length} garments, exports, persistence and mobile layout passed without API requests.`,
  );
} finally {
  await browser.close();
  server.close();
}
