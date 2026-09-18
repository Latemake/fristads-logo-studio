import { test } from "node:test";
import assert from "node:assert/strict";
import {
  removeWhitePixels,
  constrainLogo,
  logoBounds,
  validateDesign,
  validateProducts,
  hitHandle,
} from "../src/lib.js";
const logo = {
  id: "one",
  name: "Logo",
  src: "data:image/png;base64,aGVsbG8=",
  x: 400,
  y: 400,
  w: 100,
  ratio: 2,
  rotation: 0,
  opacity: 1,
};
const design = {
  version: 1,
  productId: "100239-940",
  view: 0,
  placements: { "100239-940:0": [logo] },
};
test("white background removal keeps enclosed white logo details", () => {
  const data = new Uint8ClampedArray(5 * 5 * 4).fill(255);
  for (let y = 1; y < 4; y++)
    for (let x = 1; x < 4; x++)
      if (x !== 2 || y !== 2) {
        const i = (y * 5 + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 0;
      }
  assert.equal(removeWhitePixels(data, 5, 5), 16);
  assert.equal(data[3], 0);
  assert.equal(data[(2 * 5 + 2) * 4 + 3], 255);
  assert.equal(data[(1 * 5 + 1) * 4 + 3], 255);
});
test("rotated logos stay fully within the canvas", () => {
  const result = constrainLogo({
      ...logo,
      rotation: 45,
      w: 450,
      x: -100,
      y: 1000,
    }),
    bounds = logoBounds(result);
  assert.ok(result.x - bounds.x >= 7.999);
  assert.ok(result.y + bounds.y <= 792.001);
});
test("corner handles follow the selected logo geometry", () => {
  assert.ok(hitHandle(logo, 456, 431));
  assert.equal(hitHandle(logo, 400, 400), false);
});
test("design import rejects duplicate identifiers and prototype keys", () => {
  assert.throws(() =>
    validateDesign({ ...design, placements: { "100239-940:0": [logo, logo] } }),
  );
  assert.throws(() =>
    validateDesign({ ...design, placements: JSON.parse('{"__proto__":[]}') }),
  );
});
test("per-view limits and excessive image payloads are enforced on import", () => {
  assert.throws(() =>
    validateDesign({
      ...design,
      placements: {
        "100239-940:0": Array.from({ length: 21 }, (_, i) => ({
          ...logo,
          id: String(i),
        })),
      },
    }),
  );
  assert.throws(() =>
    validateDesign({
      ...design,
      placements: { "100239-940:0": [{ ...logo, ratio: 0 }] },
    }),
  );
});
test("portable design metadata cannot reference external or executable URLs", () => {
  const product = {
    id: "100239-940",
    name: "T-paita",
    url: "https://www.fristads.com/fi-fi/tuotteet/test-100239-940",
    images: ["/garments/100239-940-0.jpg"],
  };
  assert.equal(validateProducts([product])[0].id, product.id);
  assert.equal(
    validateProducts([
      {
        ...product,
        images: ["/garments/catalog/0123456789abcdef01234567.webp"],
      },
    ])[0].id,
    product.id,
  );
  assert.throws(() =>
    validateProducts([
      { ...product, images: ["/garments/catalog/../../secret.webp"] },
    ]),
  );
  assert.throws(() =>
    validateProducts([{ ...product, url: "javascript:alert(1)" }]),
  );
  assert.throws(() =>
    validateProducts([
      { ...product, images: ["https://example.com/tracking.png"] },
    ]),
  );
  assert.throws(() =>
    validateProducts([{ ...product, images: ["/garments/../../secret"] }]),
  );
});
