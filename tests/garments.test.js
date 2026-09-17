import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyGarment, garmentPlacement } from "../src/garments.js";
test("garment categories distinguish hoodies, vests, fleece, shorts and overalls", () => {
  for (const [name, category] of [
    ["Hupullinen collegetakki", "Hupparit"],
    ["High vis Green hupullinen stretch collegetakki", "Hupparit"],
    ["Softshell takki", "Takit"],
    ["Acode softshell liivi", "Liivit"],
    ["Polartec fleecetakki", "Fleecet"],
    ["Stretch shortsit", "Shortsit"],
    ["Green umpihaalari", "Haalarit"],
    ["Airtech talvihousut", "Housut"],
  ])
    assert.equal(classifyGarment(name), category);
});
test("lower-body garments use thigh and leg presets with smaller logos", () => {
  const trousers = garmentPlacement("Housut");
  assert.ok(trousers.w < garmentPlacement("T-paidat").w);
  assert.ok(trousers.presets.every(([label]) => !label.includes("rinta")));
  assert.equal(garmentPlacement("Haalarit").y, 215);
});
