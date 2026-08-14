#!/usr/bin/env node
/**
 * Periksa mutu JSON bank soal — jalanin kapan aja buat lihat kondisi bank.
 *
 *   node scripts/audit-bank-soal.mjs
 *   node scripts/audit-bank-soal.mjs --verbose      # tampilkan tiap soal cacat
 *
 * Cocok dipakai sebelum & sesudah fix-dokkai-passage / fix-opsi-duplikat /
 * drop-soal-sampah buat mastiin perbaikannya beneran kena.
 */

import { readFile, readdir } from "node:fs/promises";
import { join, extname } from "node:path";

const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const dirIdx = args.indexOf("--dir");
const ROOT = dirIdx !== -1 ? args[dirIdx + 1] : "materi/import";

/** Samain perlakuan opsi kayak di src/lib/soal-validate.ts: buang nomor depan,
 *  spasi, dan tanda baca ekor sebelum dibandingin. */
const badan = s => String(s)
  .normalize("NFKC")
  .replace(/^[1-4][．.、:：)）\s]*/u, "")
  .replace(/[\s　]+/gu, "")
  .replace(/[。、．,.]+$/u, "")
  .toLowerCase();

/* Deteksi penjelasan yang ditulis full bahasa Jepang.
 *
 * Dua ukuran sebelumnya sama-sama meleset dan bikin angka audit ngawur:
 *   "hitung kata latin ≥6"  → nolak "雲 dibaca 'くも' (awan)" yang sebenarnya benar
 *   "ada kata fungsi ID"    → nolak "対抗心 = jiwa kompetisi" yang juga benar
 * Yang beneran mbedain cuma satu: penjelasan Jepang total NOL huruf latin,
 * sedangkan gaya Indonesia sepadat apa pun selalu nyisain beberapa. */
const MIN_HURUF_LATIN = 3;
const hurufLatin = s => (String(s).match(/[A-Za-z]/g) ?? []).length;

const PENANDA = /\[[^\]]*(KOSONG|belum diisi|tidak ada di exam asli|SOURCE MISSING|TODO|placeholder)[^\]]*\]/i;

function periksa(q) {
  const bad = [];
  const opsi = Array.isArray(q.options) ? q.options : [];

  if (!String(q.question ?? "").trim()) bad.push("pertanyaan kosong");
  if (PENANDA.test([q.question, ...opsi].join(" "))) bad.push("baris pengganjal");

  if (opsi.length !== 4) bad.push(`opsi ${opsi.length} (harus 4)`);
  else {
    const b = opsi.map(badan);
    if (b.some(x => !x)) bad.push("ada opsi kosong");
    if (new Set(b).size !== b.length) bad.push("opsi duplikat");
  }

  const k = parseInt(q.correct, 10);
  if (!(k >= 1 && k <= opsi.length)) bad.push(`kunci jawaban invalid ("${q.correct}")`);

  const blob = `${q.explanation ?? ""} ${q.why_wrong ?? ""} ${q.tip ?? ""}`;
  if (!String(q.explanation ?? "").trim()) bad.push("penjelasan kosong");
  else if (hurufLatin(blob) < MIN_HURUF_LATIN) bad.push("penjelasan full bahasa Jepang");

  if (String(q.category ?? "").includes("読解") && !q.passage) bad.push("読解 tanpa bacaan");

  return bad;
}

async function walkJsons(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walkJsons(full));
    else if (e.isFile() && extname(e.name).toLowerCase() === ".json") out.push(full);
  }
  return out;
}

async function main() {
  const files = await walkJsons(ROOT);
  const tally = {}, contoh = {}, rinci = [];
  let total = 0, cacat = 0;

  for (const f of files) {
    let data;
    try { data = JSON.parse(await readFile(f, "utf8")); } catch {
      console.warn(`⚠️  ${f} — JSON rusak`);
      continue;
    }
    for (const q of data.questions ?? []) {
      total++;
      const bad = periksa(q);
      if (!bad.length) continue;
      cacat++;
      for (const b of bad) {
        tally[b] = (tally[b] ?? 0) + 1;
        contoh[b] ??= { f: f.replace(ROOT + "/", ""), q: String(q.question ?? "").slice(0, 46) };
      }
      if (VERBOSE) rinci.push({ f: f.replace(ROOT + "/", ""), q: String(q.question ?? "").slice(0, 46), bad });
    }
  }

  const pct = n => ((n / total) * 100).toFixed(2);
  console.log(`Diperiksa : ${total} soal dari ${files.length} file`);
  console.log(`Cacat     : ${cacat} soal (${pct(cacat)}%)`);
  console.log(`Bersih    : ${total - cacat} soal (${pct(total - cacat)}%)`);

  if (!cacat) return console.log("\nGak ada masalah.");

  console.log("\nRincian:");
  for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(4)}x  ${k}`);
    console.log(`        contoh: ${contoh[k].f} — "${contoh[k].q}"`);
  }

  if (VERBOSE) {
    console.log("\nSemua soal cacat:");
    for (const r of rinci) console.log(`  [${r.bad.join(", ")}] ${r.f} — ${r.q}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
