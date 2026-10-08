import assert from "node:assert/strict";
import test from "node:test";
import { hasilPerpanjang, sudahDitutup, tutupPeringatan } from "../src/lib/langganan-waktu.ts";

test("perpanjangan menambah sisa masa aktif dan membatasi akhir bulan", () => {
  const kini = new Date("2026-01-10T12:00:00Z");
  assert.equal(hasilPerpanjang("2026-01-31T12:00:00Z", 1, kini).toISOString(), "2026-02-28T12:00:00.000Z");
  assert.equal(hasilPerpanjang("2028-01-31T12:00:00Z", 1, kini).toISOString(), "2028-02-29T12:00:00.000Z");
  assert.equal(hasilPerpanjang("2026-08-31T12:00:00Z", 6, kini).toISOString(), "2027-02-28T12:00:00.000Z");
});

test("akun tanpa masa aktif diperpanjang dari sekarang", () => {
  const kini = new Date("2026-10-08T12:00:00Z");
  for (const hingga of [null, "2026-01-01T12:00:00Z"]) {
    assert.equal(hasilPerpanjang(hingga, 1, kini).toISOString(), "2026-11-08T12:00:00.000Z");
  }
});

test("pengingat yang ditutup kemarin tidak menutup pengingat hari ini", () => {
  const isi = new Map();
  globalThis.localStorage = {
    getItem: k => isi.get(k) ?? null,
    setItem: (k, v) => isi.set(k, v),
    removeItem: k => isi.delete(k),
    key: i => [...isi.keys()][i] ?? null,
    get length() { return isi.size; },
  };
  try {
    tutupPeringatan(7, new Date("2026-10-08T10:00:00Z"));
    assert.equal(sudahDitutup(7, new Date("2026-10-08T11:00:00Z")), true);
    assert.equal(sudahDitutup(6, new Date("2026-10-09T10:00:00Z")), false);
    assert.equal(sudahDitutup(3, new Date("2026-10-08T11:00:00Z")), false);
    tutupPeringatan(1, new Date("2026-10-08T17:00:00Z"));
    assert.equal(isi.get("pro-warn-dismissed-2026-10-09"), "1");
  } finally { delete globalThis.localStorage; }
});
