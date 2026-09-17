import { test, expect } from "@playwright/test";
import { bundledProducts } from "./catalog-fixture";
const logo = {
  name: "oma-logo.svg",
  mimeType: "image/svg+xml",
  buffer: Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120"><rect width="320" height="120" rx="14" fill="#eeac44"/><text x="160" y="78" font-size="65" text-anchor="middle" font-family="Arial" fill="#173d30">NORTH</text></svg>',
  ),
};
test("complete logo editing, view isolation, persistence and exports", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".product-card")).toHaveCount(
    bundledProducts.length,
  );
  await expect(
    page.getByRole("button", { name: "Lataa esikatselu" }),
  ).toBeEnabled();
  await page.locator("input[type=file]").first().setInputFiles(logo);
  await expect(page.locator(".logo-row")).toHaveCount(1);
  await page.getByRole("slider", { name: "Logon koko" }).fill("180");
  await page.locator(".advanced-controls summary").click();
  await page.getByRole("slider", { name: "Logon kierto" }).fill("15");
  const box = await page.locator("canvas").boundingBox();
  await page.mouse.move(
    box.x + (box.width * 480) / 800,
    box.y + (box.height * 285) / 800,
  );
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.up();
  await page.getByRole("button", { name: "Kopioi", exact: true }).click();
  await expect(page.locator(".logo-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Kumoa", exact: true }).click();
  await expect(page.locator(".logo-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Toista", exact: true }).click();
  await expect(page.locator(".logo-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Kuvakulma 2", exact: true }).click();
  await expect(page.locator(".logo-row")).toHaveCount(0);
  await page.getByRole("button", { name: "Kuvakulma 1", exact: true }).click();
  await expect(page.locator(".logo-row")).toHaveCount(2);
  await expect(
    page.getByText("Tallennettu selaimeen", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".logo-row")).toHaveCount(2);
  const pngPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Lataa esikatselu" }).click();
  const png = await pngPromise;
  expect(png.suggestedFilename()).toMatch(/\.png$/);
  await png.saveAs("test-results/export.png");
  const jsonPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tallenna suunnitelma" }).click();
  const json = await jsonPromise;
  await json.saveAs("test-results/design.json");
  await page.locator(".logo-row").first().click();
  await page.getByRole("button", { name: "Poista", exact: true }).click();
  await expect(page.locator(".logo-row")).toHaveCount(1);
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles("test-results/design.json");
  await expect(page.locator(".logo-row")).toHaveCount(2);
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("mobile layout and invalid import feedback", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".product-card")).toHaveCount(
    bundledProducts.length,
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Lisää tuotelinkillä" }).click();
  await page.getByLabel("Tuotteen osoite").fill("https://example.com/test");
  await page.getByRole("button", { name: "Lisää vaate", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Fristads");
  await page.getByRole("button", { name: "Sulje", exact: true }).click();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
