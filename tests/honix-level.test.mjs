import assert from "node:assert/strict";
import test from "node:test";
import { kenaikanLevel } from "../src/lib/honix-level.ts";

test("naik level tepat saat XP melewati 1000", () => {
  assert.deepEqual(kenaikanLevel(998, 1006), { dari: 1, ke: 2 });
  assert.deepEqual(kenaikanLevel(999, 1000), { dari: 1, ke: 2 });
});

test("tidak merayakan jawaban biasa, XP tetap, atau pengurangan XP", () => {
  assert.equal(kenaikanLevel(12, 20), null);
  assert.equal(kenaikanLevel(1000, 1000), null);
  assert.equal(kenaikanLevel(1002, 998), null);
});

test("kenaikan beberapa level memakai level tujuan yang sebenarnya", () => {
  assert.deepEqual(kenaikanLevel(990, 3010), { dari: 1, ke: 4 });
});

test("data XP tidak valid tidak memunculkan perayaan palsu", () => {
  for (const nilai of [NaN, Infinity, -1]) {
    assert.equal(kenaikanLevel(nilai, 1001), null);
    assert.equal(kenaikanLevel(999, nilai), null);
  }
});
