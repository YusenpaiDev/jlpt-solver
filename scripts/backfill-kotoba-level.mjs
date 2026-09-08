#!/usr/bin/env node
/**
 * Isi kolom `level` di kotoba_progress buat baris-baris lama.
 *
 * Baris yang dibikin sebelum migrasi kotoba-level.sql cuma punya `word`. Level
 * tiap kata cuma ada di deck lokal (src/data/kotoba/N*.json), dan deck itu
 * sengaja GAK dibawa ke bundle Statistik — 2,3 MB cuma buat ngitung angka.
 * Jadi pencocokannya dikerjain sekali di sini, hasilnya nempel di DB.
 *
 * Kata yang nongol di lebih dari satu deck diambil level TERENDAH (N5 dulu):
 * kalau sebuah kata ada di daftar N5 dan N2, dia emang kata N5 yang kebawa.
 *
 *   node scripts/backfill-kotoba-level.mjs            # dry-run
 *   node scripts/backfill-kotoba-level.mjs --apply
 */

import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) {
  for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "").trim();
  }
}

const APPLY = process.argv.includes("--apply");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL.trim(),
  process.env.SUPABASE_SECRET_KEY.trim(),
  { auth: { persistSession: false } }
);

/* N5 → N1: yang duluan menang, jadi kata dasar gak keklaim level atas. */
const URUT = ["N5", "N4", "N3", "N2", "N1"];

const peta = new Map();
for (const lv of URUT) {
  const deck = JSON.parse(await readFile(`src/data/kotoba/${lv}.json`, "utf8"));
  let baru = 0;
  for (const w of deck.vocabulary ?? []) {
    if (w.word && !peta.has(w.word)) { peta.set(w.word, lv); baru++; }
  }
  console.log(`  ${lv}: ${(deck.vocabulary ?? []).length} kata (${baru} unik pertama kali)`);
}
console.log(`\npeta kata → level: ${peta.size} kata\n`);

const { data: rows, error } = await sb
  .from("kotoba_progress")
  .select("user_id, word, level")
  .is("level", null);
if (error) { console.error("❌", error.message); process.exit(1); }

console.log(`baris tanpa level: ${rows.length}`);

const perLevel = {};
const yatim = [];
const patch = [];
for (const r of rows) {
  const lv = peta.get(r.word);
  if (!lv) { yatim.push(r.word); continue; }
  perLevel[lv] = (perLevel[lv] ?? 0) + 1;
  patch.push({ user_id: r.user_id, word: r.word, level: lv });
}

console.log("bisa diisi  :", patch.length);
for (const [k, v] of Object.entries(perLevel).sort()) console.log(`   ${k}: ${v}`);
console.log("gak ketemu di deck mana pun:", yatim.length);
if (yatim.length) console.log("   contoh:", [...new Set(yatim)].slice(0, 8).join(", "));

if (APPLY && patch.length) {
  /* Update per baris — upsert bakal nimpa benar/salah jadi default. */
  let n = 0;
  for (const p of patch) {
    const { error: e } = await sb
      .from("kotoba_progress")
      .update({ level: p.level })
      .eq("user_id", p.user_id)
      .eq("word", p.word);
    if (e) { console.error(`❌ ${p.word}: ${e.message}`); process.exit(1); }
    if (++n % 100 === 0) process.stdout.write(`  ${n}/${patch.length}…\r`);
  }
  process.stdout.write(" ".repeat(30) + "\r");
  console.log(`\n✅ ${patch.length} baris diisi levelnya.`);
} else if (!APPLY) {
  console.log("\n[DRY-RUN] Jalanin lagi dengan --apply buat nulis.");
}
