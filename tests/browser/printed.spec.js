import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("printed finish changes the rendering, undoes, persists and round-trips through a project", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Lataa esikatselu" }),
  ).toBeEnabled();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "white.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" fill="white"/></svg>',
      ),
    });
  const toggle = page.getByRole("button", {
    name: "Painettu ilme",
    exact: true,
  });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Flat 2D", exact: true }).click();
  const capture = () =>
    page.locator(".canvas-wrap canvas").evaluate((c) => c.toDataURL());
  const flat = await capture();
  await toggle.click();
  await expect.poll(capture).not.toBe(flat);
  const printed = await capture();
  await page
    .getByRole("button", { name: /^Kumoa/, exact: false })
    .first()
    .click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect.poll(capture).toBe(flat);
  await toggle.click();
  await expect.poll(capture).toBe(printed);

  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Tallenna suunnitelma", exact: true })
    .click();
  const file = await download;
  const design = JSON.parse(await readFile(await file.path(), "utf8"));
  expect(Object.values(design.placements).flat()[0].printed).toBe(true);
  await page.reload();
  await page.locator(".logo-select").first().click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Flat 2D", exact: true }).click();
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles({
      name: "printed.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(design)),
    });
  await page.locator(".logo-select").first().click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  const png = page.waitForEvent("download");
  await page.getByRole("button", { name: "Lataa esikatselu" }).click();
  expect((await png).suggestedFilename()).toMatch(/\.png$/);
});

test("fabric lighting preserves white ink on dark fabric and transparent logo pixels at export resolution", async ({
  page,
}) => {
  await page.goto("/");
  const source = await readFile(
    new URL("../../src/printed.js", import.meta.url),
    "utf8",
  );
  const result = await page.evaluate(async (source) => {
    const { printedLogo } = await import(
      "data:text/javascript;base64," + btoa(source)
    );
    const garment = document.createElement("canvas");
    garment.width = garment.height = 800;
    const fabric = garment.getContext("2d");
    const gradient = fabric.createLinearGradient(250, 0, 550, 0);
    gradient.addColorStop(0, "#101010");
    gradient.addColorStop(0.5, "#505050");
    gradient.addColorStop(1, "#101010");
    fabric.fillStyle = gradient;
    fabric.fillRect(0, 0, 800, 800);
    const logo = document.createElement("canvas");
    logo.width = 200;
    logo.height = 100;
    logo.getContext("2d").fillStyle = "white";
    logo.getContext("2d").fillRect(10, 10, 180, 80);
    const params = { x: 400, y: 400, w: 200, ratio: 2, rotation: 0 };
    const output = printedLogo(logo, garment, params, 2.5);
    const ctx = output.getContext("2d");
    const pixel = (x, y) => [...ctx.getImageData(x, y, 1, 1).data];
    // The original rectangle starts at row 35 (including the 4-unit pad).
    // A fold must move some of that edge, rather than only recolor the ink.
    let displaced = 0;
    for (let x = 40; x < 460; x++)
      if (pixel(x, 34)[3] > 32) displaced++;
    return {
      displaced,
      width: output.width,
      edge: pixel(40, 125),
      middle: pixel(250, 125),
      clear: pixel(1, 1),
    };
  }, source);
  expect(result.width).toBe(520);
  expect(result.displaced).toBeGreaterThan(10);
  expect(result.middle[0]).toBeGreaterThan(result.edge[0] + 5);
  expect(result.edge[0]).toBeGreaterThan(140);
  expect(result.edge[3]).toBe(255);
  expect(result.clear[3]).toBe(0);
});
