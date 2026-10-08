import assert from "node:assert/strict";
import test from "node:test";
import { keputusanTur, rapikanTur, TUR_AWAL, LANGKAH_DESKTOP, LANGKAH_HP } from "../src/lib/honix-tur.ts";

const kini = new Date("2026-10-09T12:00:00Z");
const hariLalu = n => new Date(kini.getTime() - n * 86_400_000).toISOString();

test("belum pernah lihat tur → tur otomatis", () => {
  assert.equal(keputusanTur(TUR_AWAL, kini), "tur");
  assert.equal(keputusanTur({ terakhir: null, ingatkan: false }, kini), "tur");
});

test("kurang dari 30 hari → diam", () => {
  assert.equal(keputusanTur({ terakhir: hariLalu(29), ingatkan: true }, kini), null);
  assert.equal(keputusanTur({ terakhir: hariLalu(0), ingatkan: true }, kini), null);
});

test("30 hari atau lebih → tawarin, kecuali pengingat dimatiin", () => {
  assert.equal(keputusanTur({ terakhir: hariLalu(30), ingatkan: true }, kini), "tawar");
  assert.equal(keputusanTur({ terakhir: hariLalu(400), ingatkan: true }, kini), "tawar");
  assert.equal(keputusanTur({ terakhir: hariLalu(30), ingatkan: false }, kini), null);
});

test("tanggal rusak dianggap belum pernah", () => {
  assert.equal(keputusanTur({ terakhir: "bukan-tanggal", ingatkan: true }, kini), "tur");
});

test("rapikanTur cuma nerima bentuk yang valid", () => {
  assert.deepEqual(rapikanTur(undefined), TUR_AWAL);
  assert.deepEqual(rapikanTur("x"), TUR_AWAL);
  assert.deepEqual(rapikanTur({ terakhir: 5, ingatkan: "ya" }), TUR_AWAL);
  assert.deepEqual(rapikanTur({ terakhir: "2026-10-01T00:00:00.000Z", ingatkan: false }),
    { terakhir: "2026-10-01T00:00:00.000Z", ingatkan: false });
  assert.deepEqual(rapikanTur({ ingatkan: false }), { terakhir: null, ingatkan: false });
});

test("langkah: diawali & diakhiri langkah tengah, HP gabung jadi Lainnya", () => {
  for (const daftar of [LANGKAH_DESKTOP, LANGKAH_HP]) {
    assert.equal(daftar[0].target, null);
    assert.equal(daftar.at(-1).target, null);
  }
  assert.ok(LANGKAH_HP.some(l => l.target === "lainnya"));
  assert.ok(!LANGKAH_HP.some(l => ["catatan", "progres", "pengaturan"].includes(l.target)));
  assert.equal(LANGKAH_DESKTOP.length, 9);
});
