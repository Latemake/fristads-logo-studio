import { test, expect } from "@playwright/test";
test("API errors are readable JSON and disallow arbitrary network targets", async ({
  request,
}) => {
  for (const url of [
    "http://127.0.0.1/private",
    "https://evil.example/fi-fi/tuotteet/test-100239-940",
    "not-a-url",
  ]) {
    const response = await request.post("/api/products/import", {
      data: { url },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("Fristads");
  }
  const invalid = await request.post("/api/products/import", {
    data: "{",
    headers: { "Content-Type": "application/json" },
  });
  expect(invalid.status()).toBe(400);
  expect((await invalid.json()).error).toContain("Virheellinen");
  const blocked = await request.get("/api/image?url=http://localhost:3000");
  expect(blocked.status()).toBe(400);
  const unknown = await request.get("/api/missing");
  expect(unknown.status()).toBe(404);
  expect((await unknown.json()).error).toContain("löytynyt");
});
test("official remote images are proxied and cached without canvas tainting", async ({
  request,
}) => {
  const products = await (await request.get("/api/products")).json();
  const url = products.find((p) => p.id === "100239-940").sourceImages[0];
  const first = await request.get("/api/image", { params: { url } });
  expect(first.ok()).toBe(true);
  expect(first.headers()["content-type"]).toContain("image/jpeg");
  const data = await first.body();
  expect(data.length).toBeGreaterThan(1000);
  const second = await request.get("/api/image", { params: { url } });
  expect((await second.body()).equals(data)).toBe(true);
});
