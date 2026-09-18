import { test, expect, devices } from "@playwright/test";
test.use({
  ...devices["iPhone 13"],
  defaultBrowserType: "chromium",
  storageState: { cookies: [], origins: [] },
});
test("photo library input uploads a photo, resets for reuse and keeps mobile controls usable", async ({
  page,
}) => {
  await page.goto("/");
  const photos = page
    .locator(".mobile-photo-actions")
    .getByRole("button", { name: "Choose from photos" });
  await expect(photos).toBeEnabled();
  const input = page.getByTestId("photo-library-input");
  await expect(input).toHaveAttribute("accept", "image/*");
  expect(await input.getAttribute("capture")).toBeNull();
  const data = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 100;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, 200, 100);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const file = {
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from(data, "base64"),
  };
  for (let count = 1; count <= 2; count++) {
    const chooser = page.waitForEvent("filechooser");
    await photos.tap();
    await (await chooser).setFiles(file);
    await expect(page.locator(".logo-row")).toHaveCount(count);
    await expect(input).toHaveValue("");
  }
  const tools = page.getByRole("toolbar", { name: "Selected logo actions" });
  await tools.getByRole("button", { name: "Make logo larger" }).tap();
  await expect(
    page.getByRole("slider", { name: "Logo size", exact: true }),
  ).toHaveValue("125");
  await page.locator(".mobile-edit-link").tap();
  await expect(
    page.getByRole("button", { name: "Printed", exact: true }),
  ).toBeInViewport();
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const target = await photos.boundingBox();
    expect(target.height).toBeGreaterThanOrEqual(44);
  }
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download preview" }).tap();
  expect((await pending).suggestedFilename()).toMatch(/\.png$/);
});
