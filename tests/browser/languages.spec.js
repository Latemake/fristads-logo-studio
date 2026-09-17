import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
test.use({ storageState: { cookies: [], origins: [] } });

test("English default and persistent language switching preserve the design", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: "Choose a garment" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Language", exact: true }),
  ).toHaveValue("en");
  await page
    .getByLabel("Design name", { exact: true })
    .fill("My custom project");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "brand.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100" height="40" fill="red"/></svg>',
      ),
    });
  await expect(
    page.getByRole("button", { name: "Printed", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const canvas = await page.locator("canvas").evaluate((c) => c.toDataURL());
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("sv");
  await expect(
    page.getByRole("heading", { name: "Välj plagg", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Designnamn", { exact: true })).toHaveValue(
    "My custom project",
  );
  expect(await page.locator("canvas").evaluate((c) => c.toDataURL())).toBe(
    canvas,
  );
  await page.getByRole("button", { name: "Hjälp", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Din design, steg för steg.",
  );
  await page.getByRole("button", { name: "Stäng", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await expect(page.locator(".logo-row")).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Språk", exact: true })
    .selectOption("fi");
  await expect(
    page.getByRole("heading", { name: "Valitse vaate", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Kieli", exact: true })
    .selectOption("en");
  await page.getByLabel("Search garments", { exact: true }).fill("trousers");
  await expect(page.locator(".product-card").first()).toContainText("trousers");
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const language of ["en", "fi", "sv"]) {
    await page.locator(".language-picker select").selectOption(language);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await expect(page.locator(".language-picker")).toBeVisible();
  }
});

test("Swedish PDF export and English validation messages are translated", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Download preview" }),
  ).toBeEnabled();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "bad.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("bad"),
    });
  await expect(page.getByRole("alert")).toContainText(
    "Choose a PNG, JPG, WebP or SVG image.",
  );
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "brand.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100" height="40" fill="red"/></svg>',
      ),
    });
  await page.locator(".language-picker select").selectOption("sv");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Ladda ner sammanfattning" }).click();
  const pdf = await readFile(await (await pending).path());
  const raw = pdf.toString("latin1");
  const streams = [...raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
    .map((match) => {
      try {
        return inflateSync(Buffer.from(match[1], "latin1")).toString("latin1");
      } catch {
        return "";
      }
    })
    .join("\n");
  expect(streams).toContain("Logotyper");
  expect(streams).toContain("Visa produkten hos Fristads");
  expect(streams).not.toContain("Kuvakulma");
});
