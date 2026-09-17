import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateProductUrl,
  allowedImage,
  parseProduct,
} from "../server/catalog.js";
import { validateDesign, hitLogo } from "../src/lib.js";
test("product imports only accept specific Fristads HTTPS product URLs", () => {
  assert.equal(
    validateProductUrl(
      "https://www.fristads.com/fi-fi/tuotteet/test-100239-940",
    ),
    "https://www.fristads.com/fi-fi/tuotteet/test-100239-940",
  );
  for (const u of [
    "https://evil.com/fi-fi/tuotteet/test-100239-940",
    "http://www.fristads.com/fi-fi/tuotteet/test-100239-940",
    "https://www.fristads.com/fi-fi/tuotteet",
    "https://user@www.fristads.com/fi-fi/tuotteet/test-100239-940",
    "https://www.fristads.com:444/fi-fi/tuotteet/test-100239-940",
  ])
    assert.throws(() => validateProductUrl(u));
});
test("image proxy rejects private and lookalike hosts", () => {
  assert.ok(allowedImage("https://mediacdn5.fristadskansas.com/Cache/a.jpg"));
  for (const u of [
    "http://127.0.0.1/a",
    "https://mediacdn5.fristadskansas.com.evil.com/a",
    "file:///a",
    "https://www.fristads.com/a",
  ])
    assert.equal(allowedImage(u), false);
});
test("garment packshots precede model photography", () => {
  const p = parseProduct(
    '<h1>Test takki</h1><meta property="og:image" content="https://mediacdn5.fristadskansas.com/model.jpg"><meta property="og:title" content="Test takki | Musta | Fristads"><div class="slide--product"><img src="https://mediacdn5.fristadskansas.com/front.jpg"></div>',
    "https://www.fristads.com/fi-fi/tuotteet/test-100239-940",
  );
  assert.deepEqual(p.images, [
    "https://mediacdn5.fristadskansas.com/front.jpg",
  ]);
  assert.equal(p.color, "Musta");
  assert.equal(p.category, "Takit");
});
test("design import rejects invalid or active image payloads", () => {
  const d = { version: 1, productId: "100239-940", view: 0, placements: {} };
  assert.deepEqual(validateDesign(d), d);
  assert.throws(() =>
    validateDesign({ ...d, placements: { a: [{ src: "https://evil.com" }] } }),
  );
  assert.throws(() => validateDesign({ ...d, view: -1 }));
});
test("hit testing follows logo rotation", () => {
  const l = { x: 400, y: 400, w: 200, ratio: 4, rotation: 90 };
  assert.ok(hitLogo(l, 400, 480));
  assert.equal(hitLogo(l, 480, 400), false);
});
