import { test } from "node:test";
import assert from "node:assert/strict";
import {
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
