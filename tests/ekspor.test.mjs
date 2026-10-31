import assert from "node:assert/strict";
import test from "node:test";
import { kotobaKeCsv, catatanKeMarkdown } from "../src/lib/ekspor.ts";

test("CSV kotoba: BOM, header, escaping koma/kutip/baris baru, null jadi kosong", () => {
  const csv = kotobaKeCsv([
    { kanji: "才能", reading: "さいのう", meaning: "bakat, talenta", level: "N2", example: 'dia bilang "hebat"\nbaris 2', favorite: true, created_at: "2026-10-01T00:00:00Z" },
    { kanji: "辛い", reading: null, meaning: "pedas", level: null, created_at: "2026-10-02T00:00:00Z" },
  ]);
  assert.ok(csv.startsWith("﻿kanji,reading,meaning,level,example,favorite,created_at\r\n"));
  assert.ok(csv.includes('才能,さいのう,"bakat, talenta",N2,"dia bilang ""hebat""\nbaris 2",true,2026-10-01T00:00:00Z'));
  assert.ok(csv.includes("辛い,,pedas,,,,2026-10-02T00:00:00Z"));
  assert.equal(kotobaKeCsv([]), "﻿kanji,reading,meaning,level,example,favorite,created_at\r\n");
});

test("Markdown catatan: judul, tanggal, isi, judul kosong aman", () => {
  const md = catatanKeMarkdown([
    { judul: "Partikel は vs が", isi: "は = topik\n", created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-05T00:00:00Z" },
    { judul: null, isi: null, created_at: "2026-10-02T00:00:00Z" },
  ], new Date("2026-11-01T00:00:00Z"));
  assert.ok(md.startsWith("# Catatan Sensei JLPT\n\nDiekspor 2026-11-01 · 2 catatan\n"));
  assert.ok(md.includes("## Partikel は vs が\n\n_2026-10-05_\n\nは = topik\n"));
  assert.ok(md.includes("## Tanpa judul\n\n_2026-10-02_"));
});
