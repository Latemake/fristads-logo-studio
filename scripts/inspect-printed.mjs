import { chromium } from "@playwright/test";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1000 },
  });
  await page.goto("http://localhost:3000");
  await page.getByRole("button", { name: "Lataa esikatselu" }).waitFor();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "NORTH.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><text x="150" y="75" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="70" fill="white">NORTH</text></svg>',
      ),
    });
  await page
    .getByRole("button", { name: "Painettu ilme", exact: true })
    .click();
  await page.locator(".toast button").click();
  await page.screenshot({
    path: "test-results/printed-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Painettu ilme", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/printed-mobile.png" });
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.getByRole("button", { name: "Keskellä", exact: true }).click();
  const slider = page.getByRole("slider", { name: "Logon koko", exact: true });
  await slider.focus();
  await slider.press("End");
  for (let i = 0; i < 200; i++) await slider.press("ArrowLeft");
  await page.locator(".canvas-wrap canvas").click({ position: { x: 20, y: 20 } });
  await page.locator(".canvas-wrap canvas").screenshot({ path: "test-results/printed-close.png" });
  await page.locator(".logo-select").first().click();
  await page.getByRole("button", { name: "Flat 2D", exact: true }).click();
  await page.locator(".canvas-wrap canvas").click({ position: { x: 20, y: 20 } });
  await page.locator(".canvas-wrap canvas").screenshot({ path: "test-results/flat-close.png" });
} finally {
  await browser.close();
}
