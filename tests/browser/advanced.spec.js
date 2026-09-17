import { test, expect } from "@playwright/test";
import { bundledProducts } from "./catalog-fixture";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
const svg = (content, width = 320, height = 120) => ({
  name: "yritys.svg",
  mimeType: "image/svg+xml",
  buffer: Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${content}</svg>`,
  ),
});
const logo = svg(
  '<rect width="320" height="120" rx="12" fill="#eeac44"/><text x="160" y="80" font-size="62" text-anchor="middle" font-family="Arial" fill="#173d30">NORTH</text>',
);
async function start(page) {
  await page.goto("/");
  await expect(page.locator(".product-card")).toHaveCount(
    bundledProducts.length,
  );
  await expect(
    page.getByRole("button", { name: "Lataa esikatselu", exact: false }),
  ).toBeEnabled();
}
async function upload(page, file = logo) {
  await page.locator("input[type=file]").first().setInputFiles(file);
  await expect(page.locator(".logo-row")).toHaveCount(1);
}
test("corner resizing and slider dragging each undo as one action", async ({
  page,
}) => {
  await start(page);
  await upload(page);
  const box = await page.locator("canvas").boundingBox();
  const x = 480 + 110 / 2 + 6,
    y = 285 + 110 / (320 / 120) / 2 + 6;
  await page.mouse.move(
    box.x + (x * box.width) / 800,
    box.y + (y * box.height) / 800,
  );
  await page.mouse.down();
  await page.mouse.move(
    box.x + ((x + 60) * box.width) / 800,
    box.y + ((y + 25) * box.height) / 800,
    { steps: 12 },
  );
  await page.mouse.up();
  expect(
    Number(await page.getByRole("slider", { name: "Logon koko" }).inputValue()),
  ).toBeGreaterThan(170);
  await page.getByRole("button", { name: "Kumoa", exact: true }).click();
  await expect(page.getByRole("slider", { name: "Logon koko" })).toHaveValue(
    "110",
  );
  await page
    .getByRole("slider", { name: "Logon koko" })
    .scrollIntoViewIfNeeded();
  const slider = await page
    .getByRole("slider", { name: "Logon koko" })
    .boundingBox();
  await page.mouse.move(
    slider.x + slider.width * 0.2,
    slider.y + slider.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    slider.x + slider.width * 0.8,
    slider.y + slider.height / 2,
    { steps: 20 },
  );
  await page.mouse.up();
  expect(
    Number(await page.getByRole("slider", { name: "Logon koko" }).inputValue()),
  ).toBeGreaterThan(300);
  await page.getByRole("button", { name: "Kumoa", exact: true }).click();
  await expect(page.getByRole("slider", { name: "Logon koko" })).toHaveValue(
    "110",
  );
});
test("existing logo reuse, two-page PDF and presentation focus restoration", async ({
  page,
}, testInfo) => {
  await start(page);
  await upload(page);
  await page.getByLabel("Suunnitelman nimi").fill("Pohjola – työvaatteet");
  await page.getByLabel("Suunnitelman nimi").blur();
  await page.getByRole("button", { name: "Kuvakulma 2", exact: true }).click();
  await page.locator(".logo-library summary").click();
  await page.getByRole("button", { name: "Lisää logo yritys.svg" }).click();
  await expect(page.locator(".logo-row")).toHaveCount(1);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Lataa yhteenveto" }).click();
  const pdf = await download;
  const file = testInfo.outputPath("summary.pdf");
  await pdf.saveAs(file);
  const bytes = await readFile(file);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.toString("latin1")).toContain("/Count 2");
  await page.getByRole("button", { name: "Esitysnäkymä", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".presentation-image")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Esitysnäkymä", exact: true }),
  ).toBeFocused();
});
test("background removal keeps inner white details and is reversible", async ({
  page,
}) => {
  await start(page);
  await upload(
    page,
    svg(
      '<rect width="100" height="100" fill="white"/><rect x="20" y="20" width="60" height="60" fill="black"/><rect x="40" y="40" width="20" height="20" fill="white"/>',
      100,
      100,
    ),
  );
  const source = await page.locator(".logo-row img").getAttribute("src");
  await page.getByRole("button", { name: "Poista valkoinen tausta" }).click();
  await expect(page.locator(".toast[role=status]")).toContainText("poistettu");
  const processed = await page.locator(".logo-row img").getAttribute("src");
  expect(processed).not.toEqual(source);
  const pixel = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    c.getContext("2d").drawImage(img, 0, 0);
    return {
      width: img.width,
      pixel: [...c.getContext("2d").getImageData(30, 30, 1, 1).data],
    };
  }, processed);
  expect(pixel.width).toBe(60);
  expect(pixel.pixel).toEqual([255, 255, 255, 255]);
  await page.getByRole("button", { name: "Kumoa", exact: true }).click();
  await expect(page.locator(".logo-row img")).toHaveAttribute("src", source);
});
test("transparent padding is cropped and empty or unsafe uploads do not destroy work", async ({
  page,
}) => {
  await start(page);
  await upload(
    page,
    svg('<rect x="100" y="40" width="120" height="40" fill="black"/>'),
  );
  const src = await page.locator(".logo-row img").getAttribute("src");
  const size = await page.evaluate(async (src) => {
    const i = new Image();
    i.src = src;
    await i.decode();
    return [i.width, i.height];
  }, src);
  expect(size).toEqual([120, 40]);
  await page.locator("input[type=file]").first().setInputFiles(svg(""));
  await expect(page.getByRole("alert")).toContainText("läpinäkyvä");
  await expect(page.locator(".logo-row")).toHaveCount(1);
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles(svg("<script>alert(1)</script>"));
  await expect(page.getByRole("alert")).toContainText("aktiivista");
  await expect(page.locator(".logo-row")).toHaveCount(1);
});
test("invalid PNG in an imported design is rejected before autosave", async ({
  page,
}) => {
  await start(page);
  await upload(page);
  const before = await page.locator(".logo-row img").getAttribute("src");
  const d = {
    version: 1,
    productId: "100239-940",
    view: 0,
    placements: {
      "100239-940:0": [
        {
          id: "bad",
          name: "broken",
          src: "data:image/png;base64,AAAA",
          x: 400,
          y: 400,
          w: 100,
          ratio: 2,
          rotation: 0,
          opacity: 1,
        },
      ],
    },
  };
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(d)),
    });
  await expect(page.getByRole("alert")).toContainText("Kuvaa ei voitu");
  await expect(page.locator(".logo-row img")).toHaveAttribute("src", before);
  await page.reload();
  await expect(page.locator(".logo-row")).toHaveCount(1);
  await expect(page.locator(".logo-row img")).toHaveAttribute("src", before);
});
test("portable product metadata restores a design outside the current catalog", async ({
  page,
}) => {
  await start(page);
  const d = {
    version: 1,
    title: "Siirrettävä työ",
    productId: "999999-940",
    view: 0,
    placements: {},
    products: [
      {
        id: "999999-940",
        name: "Siirretty Fristads-tuote",
        category: "T-paidat",
        color: "Musta",
        images: ["/garments/100239-940-0.jpg"],
        url: "https://www.fristads.com/fi-fi/tuotteet/test-999999-940",
      },
    ],
  };
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles({
      name: "portable.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(d)),
    });
  await expect(page.locator(".product-info h2")).toHaveText(
    "Siirretty Fristads-tuote",
  );
  await expect(
    page.getByText("Tallennettu selaimeen", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".product-info h2")).toHaveText(
    "Siirretty Fristads-tuote",
  );
  await expect(page.getByLabel("Suunnitelman nimi")).toHaveValue(
    "Siirrettävä työ",
  );
});
test("new design can be cancelled and undone without losing the previous design", async ({
  page,
}) => {
  await start(page);
  await upload(page);
  await page
    .getByRole("button", { name: "Uusi suunnitelma", exact: true })
    .click();
  await page.getByRole("button", { name: "Peruuta", exact: true }).click();
  await expect(page.locator(".logo-row")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Uusi suunnitelma", exact: true })
    .click();
  await page.getByRole("button", { name: "Aloita uusi", exact: true }).click();
  await expect(page.locator(".logo-row")).toHaveCount(0);
  await page.getByRole("button", { name: "Kumoa", exact: true }).click();
  await expect(page.locator(".logo-row")).toHaveCount(1);
});
test("search, category filter, reset and narrow layout remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await start(page);
  await page.getByLabel("Tuoteryhmä").selectOption("Takit");
  await expect(page.locator(".product-card")).toHaveCount(
    bundledProducts.filter((p) => p.category === "Takit").length,
  );
  await page.getByLabel("Etsi vaatetta").fill("ei tällaista tuotetta");
  await expect(page.locator(".product-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Näytä kaikki vaatteet" }).click();
  await expect(page.locator(".product-card")).toHaveCount(
    bundledProducts.length,
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  await upload(page);
  await page.getByRole("button", { name: "Keskitä", exact: true }).click();
  await expect(page.locator(".controls")).toBeVisible();
});
test("image load failure offers retry and recovers", async ({ page }) => {
  let fail = true;
  await page.route("**/garments/100239-940-0.jpg", (route) =>
    fail ? route.abort() : route.continue(),
  );
  await page.goto("/");
  await expect(page.getByText("Tuotekuva ei latautunut.")).toBeVisible();
  fail = false;
  await page
    .getByRole("button", { name: "Yritä uudelleen", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Lataa esikatselu" }),
  ).toBeEnabled();
});
test("keyboard focus and accessibility pass on empty, edited and help views", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await start(page);
  let results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await upload(page);
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole("button", { name: "Ohjeet" }).click();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => !!document.activeElement.closest("[role=dialog]"),
      ),
    ).toBe(true);
  }
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Ohjeet" })).toBeFocused();
});
test("switching a garment color preserves originals and can copy its layout", async ({
  page,
}) => {
  await start(page);
  await upload(page);
  await page
    .getByRole("button", { name: "Väri: Tummanharmaa", exact: true })
    .click();
  await expect(page.locator(".product-info p")).toContainText("100239-941");
  await expect(page.locator(".logo-row")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Kopioi saman mallin logot", exact: true })
    .click();
  await expect(page.locator(".logo-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Väri: Musta", exact: true }).click();
  await expect(page.locator(".logo-row")).toHaveCount(1);
  await expect(page.locator(".product-info p")).toContainText("100239-940");
});
test("SVG internal gradients remain valid after safety checks", async ({
  page,
}) => {
  await start(page);
  await upload(
    page,
    svg(
      '<defs><linearGradient id="fill"><stop stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient></defs><rect width="320" height="120" fill="url(\'\#fill\')"/>',
    ),
  );
  await expect(page.locator(".logo-row")).toHaveCount(1);
});
