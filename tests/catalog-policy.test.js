import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isMultiItemProduct,
  singleItemCatalog,
} from "../src/catalog-policy.js";

test("catalog excludes packs and sets while retaining individual garments and single packs", () => {
  for (const name of [
    "Bokserit 3-pack, 9329 BOX",
    "Sukat 2-paria",
    "Henkilökorttipidin 10-pakkaus",
    "5 kpl pakkaus",
    "Sadeasusetti 4099 LRS",
  ]) {
    assert.equal(isMultiItemProduct({ name }), true, name);
  }
  assert.equal(
    isMultiItemProduct({ id: "127382-940", name: "Alusasu 7416 UE" }),
    true,
  );
  for (const name of [
    "Henkilökorttipidin 1-pakkaus",
    "Bokserit 9329 BOX",
    "2-in-1 talvitakki",
    "Calcium huppari",
    "Turvakengät",
  ]) {
    assert.equal(isMultiItemProduct({ name }), false, name);
  }
  const products = singleItemCatalog([
    { id: "125034-940", name: "Bokserit 3-pack" },
    {
      id: "126686-940",
      name: "Bokserit",
      variants: [{ id: "125034-940" }, { id: "126686-940" }],
    },
  ]);
  assert.equal(products.length, 1);
  assert.deepEqual(products[0].variants, [{ id: "126686-940" }]);
});
