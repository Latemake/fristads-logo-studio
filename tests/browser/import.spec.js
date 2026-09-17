import { test, expect } from "@playwright/test";
import { bundledProducts } from "./catalog-fixture";
test("real Fristads import and same-origin image export", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".product-card")).toHaveCount(
    bundledProducts.length,
  );
  await page.getByRole("button", { name: "Lisää tuotelinkillä" }).click();
  await page
    .getByLabel("Tuotteen osoite")
    .fill(
      "https://www.fristads.com/fi-fi/tuotteet/green-heavy-pikeepaita-7047-gpm-tummansininenharmaa-300509-586",
    );
  await page.getByRole("button", { name: "Lisää vaate", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30000 });
  await expect(page.locator(".product-info h2")).toHaveText(
    "Green heavy pikeepaita 7047 GPM",
  );
  await expect(
    page.getByRole("button", { name: "Lataa esikatselu" }),
  ).toBeEnabled({ timeout: 25000 });
  const promise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Lataa esikatselu" }).click();
  expect((await promise).suggestedFilename()).toBe(
    "fristads-300509-586-kuva-1.png",
  );
});
