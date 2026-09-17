import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch();
try {
  await mkdir("test-results", { recursive: true });
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:3000");
  await page.waitForFunction(() =>
    document.querySelector(".export-area .primary:not(:disabled)"),
  );
  await page.screenshot({
    path: "test-results/final-desktop.png",
    fullPage: true,
  });
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "NORTH.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="100"><text x="160" y="78" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="76" fill="white">NORTH</text></svg>',
      ),
    });
  await page.locator(".logo-row").waitFor();
  await page.locator(".toast button").click();
  await page.screenshot({
    path: "test-results/final-editor.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Esitysnäkymä", exact: true }).click();
  await page.locator(".presentation-image").waitFor();
  await page.screenshot({
    path: "test-results/final-presentation.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/final-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Väri: Valkoinen", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document
        .querySelector(".product-info p")
        ?.textContent.includes("100239-900"),
    {},
    { timeout: 45000 },
  );
  await page.waitForFunction(() =>
    document.querySelector(".export-area .primary:not(:disabled)"),
  );
  console.log(
    JSON.stringify({ remoteColorImported: true, browserErrors: errors }),
  );
} finally {
  await browser.close();
}
