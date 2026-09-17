import { chromium } from "@playwright/test";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [width, height] of [
    [1440, 900],
    [1920, 1000],
    [2560, 1440],
    [3072, 1400],
    [1100, 720],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("http://localhost:3000");
    await page.waitForFunction(() =>
      document.querySelector(".export-area .primary:not(:disabled)"),
    );
    const geometry = await page.evaluate(() => {
      const workspace = document
        .querySelector(".workspace")
        .getBoundingClientRect();
      const canvas = document.querySelector("canvas").getBoundingClientRect();
      return {
        width: innerWidth,
        height: innerHeight,
        left: workspace.left,
        right: innerWidth - workspace.right,
        workspaceHeight: workspace.height,
        canvasHeight: canvas.height,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        fontSize: getComputedStyle(document.documentElement).fontSize,
      };
    });
    console.log(JSON.stringify(geometry));
    if (
      geometry.documentWidth > width + 1 ||
      (width > 1000 &&
        (geometry.documentHeight > height + 2 ||
          geometry.left > width * 0.025 ||
          geometry.right > width * 0.025))
    )
      throw Error("Layout overflows or leaves excessive margins at " + width);
    if (width === 1920 || width === 3072 || width === 390)
      await page.screenshot({
        path: `test-results/layout-${width}.png`,
        fullPage: true,
      });
  }
} finally {
  await browser.close();
}
