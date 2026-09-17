import { test, expect } from "@playwright/test";
import { bundledProducts } from "./catalog-fixture";
const logo = {
  name: "yritys.svg",
  mimeType: "image/svg+xml",
  buffer: Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80"><rect width="240" height="80" fill="red"/></svg>',
  ),
};
async function start(page) {
  await page.goto("/");
  await expect(page.locator(".product-card")).toHaveCount(
    bundledProducts.length,
  );
  await expect(
    page.getByRole("button", { name: "Lataa esikatselu" }),
  ).toBeEnabled();
}
async function upload(page) {
  await page.locator("input[type=file]").first().setInputFiles(logo);
  await expect(page.locator(".logo-row")).toHaveCount(1);
}
test("every new garment category loads real local images and exports", async ({
  page,
}) => {
  await start(page);
  expect(bundledProducts.length).toBeGreaterThanOrEqual(24);
  for (const category of [
    "Housut",
    "Takit",
    "Fleecet",
    "Liivit",
    "Shortsit",
    "Hupparit",
    "Colleget",
    "Haalarit",
  ]) {
    await page.getByLabel("Tuoteryhmä").selectOption(category);
    const expected = bundledProducts.filter((p) => p.category === category);
    await expect(page.locator(".product-card")).toHaveCount(expected.length);
    await page.locator(".product-card").first().click();
    await expect(
      page.getByRole("button", { name: "Lataa esikatselu" }),
    ).toBeEnabled();
    await expect(page.locator(".canvas-status")).toHaveCount(0);
    expect(
      await page
        .locator(".product-card img")
        .first()
        .evaluate((i) => i.complete && i.naturalWidth > 0),
    ).toBe(true);
  }
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Lataa esikatselu" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
});
test("per-row deletion works without selection and offers immediate undo", async ({
  page,
}) => {
  await start(page);
  await upload(page);
  await page.getByRole("button", { name: "Kopioi logo", exact: true }).click();
  await expect(page.locator(".logo-row")).toHaveCount(2);
  await page
    .locator(".logo-row")
    .first()
    .getByRole("button", { name: "Poista logo yritys.svg", exact: true })
    .click();
  await expect(page.locator(".logo-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Kumoa poisto", exact: true }).click();
  await expect(page.locator(".logo-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Poista tämän kuvan logot" }).click();
  await expect(page.locator(".logo-row")).toHaveCount(0);
  await page.getByRole("button", { name: "Kumoa poisto", exact: true }).click();
  await expect(page.locator(".logo-row")).toHaveCount(2);
});
test("floating controls resize and remove the selected logo on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await upload(page);
  const toolbar = page.getByRole("toolbar", {
    name: "Valitun logon pikatoiminnot",
  });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole("button", { name: "Suurenna logoa" }).click();
  await expect(page.getByRole("slider", { name: "Logon koko" })).toHaveValue(
    "125",
  );
  await toolbar.getByRole("button", { name: "Pienennä logoa" }).click();
  await expect(page.getByRole("slider", { name: "Logon koko" })).toHaveValue(
    "110",
  );
  await toolbar.getByRole("button", { name: "Poista", exact: true }).click();
  await expect(page.locator(".logo-row")).toHaveCount(0);
  await page.getByRole("button", { name: "Kumoa poisto", exact: true }).click();
  await expect(page.locator(".logo-row")).toHaveCount(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
test("trousers place the logo on the thigh and keyboard deletion is undoable", async ({
  page,
}) => {
  await start(page);
  await page.getByLabel("Tuoteryhmä").selectOption("Housut");
  await page.locator(".product-card").first().click();
  await upload(page);
  await expect(page.getByRole("slider", { name: "Logon koko" })).toHaveValue(
    "80",
  );
  await expect(
    page.getByRole("button", { name: "Vasen reisi", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Vasen rinta", exact: true }),
  ).toHaveCount(0);
  await page.locator("canvas").focus();
  await page.keyboard.press("Backspace");
  await expect(page.locator(".logo-row")).toHaveCount(0);
  await page.keyboard.press("Control+z");
  await expect(page.locator(".logo-row")).toHaveCount(1);
});
