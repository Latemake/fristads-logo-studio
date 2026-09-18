import { test, expect } from "@playwright/test";
import { bundledProducts } from "./catalog-fixture";

test("large catalogs paginate, reset filters and preserve the selected design", async ({
  page,
}) => {
  const catalog = Array.from({ length: 155 }, (_, i) => ({
    ...bundledProducts[0],
    id: `${800000 + i}-940`,
    name: `Catalog garment ${i + 1}`,
    category: i < 100 ? "T-paidat" : "Housut",
    variants: [],
  }));
  await page.route("**/api/products", (route) =>
    route.fulfill({ json: catalog }),
  );
  await page.goto("/");
  await expect(page.locator(".product-card")).toHaveCount(48);
  await expect(
    page.getByRole("button", { name: "Edellinen sivu" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Seuraava sivu" }).click();
  await expect(page.locator(".product-card").first()).toContainText(
    "Catalog garment 49",
  );
  await page.locator(".product-card").first().click();
  await expect(page.locator(".product-info h2")).toHaveText(
    "Catalog garment 49",
  );
  await page.getByRole("button", { name: "Seuraava sivu" }).click();
  await page.getByRole("button", { name: "Seuraava sivu" }).click();
  await expect(page.locator(".product-card")).toHaveCount(11);
  await expect(
    page.getByRole("button", { name: "Seuraava sivu" }),
  ).toBeDisabled();
  await page.getByLabel("Tuoteryhmä").selectOption("Housut");
  await expect(page.locator(".product-card")).toHaveCount(48);
  await expect(page.locator(".product-card").first()).toContainText(
    "Catalog garment 101",
  );
  await page.getByLabel("Etsi vaatetta").fill("800154");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(page.locator(".catalog-pagination")).toHaveCount(0);
  await page.locator(".product-card").click();
  await page.reload();
  await expect(page.locator(".product-info h2")).toHaveText(
    "Catalog garment 155",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Seuraava sivu" }).click();
  await expect(page.locator(".product-card").first()).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
