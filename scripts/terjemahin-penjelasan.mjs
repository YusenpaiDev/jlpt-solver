#!/usr/bin/env node
/**
 * Terjemahin penjelasan soal yang masih full bahasa Jepang ke Indonesia.
 *
 * Kenapa perlu: build-bank-soal.mjs nolak soal yang penjelasannya gak punya
 * huruf latin — gerbang mutu, supaya Lembar Tugas gak nyajiin soal yang
 * penjelasannya gak kebaca sama yang belajar. Sekarang 442 soal ketahan di
 * situ (426 N1, 16 N3), jadi soalnya ada di bank tapi gak pernah keluar.
 *
 * Yang diterjemahin cuma tiga field: explanation, why_wrong, tip.
 * Pertanyaan, opsi, dan bacaan 読解 TIDAK disentuh — itu teks ujian asli.
 *
 *   node scripts/terjemahin-penjelasan.mjs --contoh 5     # coba 5 soal, gak nulis
 *   node scripts/terjemahin-penjelasan.mjs                # dry-run: hitung aja
 *   node scripts/terjemahin-penjelasan.mjs --apply
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { glob } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";

if (existsSync(".env.local")) {
  for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "").trim();
  }
}

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const iContoh = args.indexOf("--contoh");
const CONTOH = iContoh !== -1 ? Number(args[iContoh + 1] || 5) : 0;

const MODEL = "claude-opus-5";
const PER_BATCH = 8;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/* Ambang yang SAMA dipakai audit & build-bank-soal: penjelasan gaya Indonesia
   sepadat apa pun selalu nyisain beberapa huruf latin; yang Jepang total nol. */
const hurufLatin = s => (String(s).match(/[A-Za-z]/g) ?? []).length;
const perluTerjemah = q => {
  if (String(q.category ?? "").startsWith("聴解")) return false;
  const blob = `${q.explanation ?? ""} ${q.why_wrong ?? ""} ${q.tip ?? ""}`;
  return hurufLatin(blob) < 3;
};

const SISTEM = `Kamu penerjemah untuk aplikasi belajar JLPT berbahasa Indonesia.

Kamu menerima penjelasan soal JLPT yang ditulis dalam bahasa Jepang. Terjemahkan
ke bahasa Indonesia yang santai tapi jelas — nada seorang guru yang menjelaskan
ke murid, pakai "kamu", bukan bahasa formal kaku.

ATURAN:
1. Istilah Jepang yang jadi POKOK penjelasan tetap ditulis Jepang, diikuti
   bacaan dan artinya. Contoh: 「添付」(てんぷ) = melampirkan.
2. Istilah tata bahasa Jepang (助詞, 受身形, 自動詞) diterjemahkan ke istilah
   Indonesia yang lazim dipakai pelajar (partikel, bentuk pasif, kata kerja
   intransitif).
3. Panjangnya kira-kira sama dengan aslinya. Jangan ditambah-tambahi, jangan
   diringkas sampai hilang isinya.
4. Kalau ada field yang isinya kosong, balikan tetap string kosong.
5. Jangan pernah mengubah, mengoreksi, atau mengomentari isi soalnya. Kamu
   hanya menerjemahkan penjelasan yang diberikan.`;

const SKEMA = {
  type: "object",
  properties: {
    hasil: {
      type: "array",
      items: {
        type: "object",
        properties: {
          i: { type: "integer" },
          explanation: { type: "string" },
          why_wrong: { type: "string" },
          tip: { type: "string" },
        },
        required: ["i", "explanation", "why_wrong", "tip"],
        additionalProperties: false,
      },
    },
  },
  required: ["hasil"],
  additionalProperties: false,
};

let tokIn = 0, tokOut = 0;

async function terjemahkanBatch(batch) {
  const muatan = batch.map((b, i) => ({
    i,
    question: b.q.question.slice(0, 200),
    explanation: b.q.explanation ?? "",
    why_wrong: b.q.why_wrong ?? "",
    tip: b.q.tip ?? "",
  }));

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SISTEM,
    output_config: { format: { type: "json_schema", schema: SKEMA }, effort: "low" },
    messages: [{
      role: "user",
      content:
        "Terjemahkan field explanation, why_wrong, dan tip dari tiap butir berikut. " +
        "Field `question` cuma konteks — jangan diterjemahkan, jangan dikembalikan.\n\n" +
        JSON.stringify(muatan, null, 2),
    }],
  });

  tokIn += res.usage.input_tokens;
  tokOut += res.usage.output_tokens;

  const teks = res.content.find(b => b.type === "text")?.text ?? "{}";
  return JSON.parse(teks).hasil ?? [];
}

/* ── kumpulkan ── */
const berkas = [];
for await (const f of glob("materi/import/**/*.json")) berkas.push(f);
berkas.sort();

const kerjaan = [];
const isiBerkas = new Map();
for (const f of berkas) {
  let d;
  try { d = JSON.parse(await readFile(f, "utf8")); } catch { continue; }
  isiBerkas.set(f, d);
  (d.questions ?? []).forEach((q, idx) => {
    if (perluTerjemah(q)) kerjaan.push({ f, idx, q });
  });
}

const perLevel = {};
for (const k of kerjaan) { const lv = k.f.split("/")[2]; perLevel[lv] = (perLevel[lv] ?? 0) + 1; }
console.log(`soal yang penjelasannya masih Jepang: ${kerjaan.length}`);
for (const [k, v] of Object.entries(perLevel).sort()) console.log(`  ${k}: ${v}`);

const antrian = CONTOH ? kerjaan.slice(0, CONTOH) : kerjaan;
if (!APPLY && !CONTOH) {
  console.log("\n[DRY-RUN] --contoh 5 buat nyoba, --apply buat jalan penuh.");
  process.exit(0);
}

console.log(`\nmodel: ${MODEL} · ${antrian.length} soal · ${PER_BATCH} per panggilan\n`);

let selesai = 0;
for (let i = 0; i < antrian.length; i += PER_BATCH) {
  const batch = antrian.slice(i, i + PER_BATCH);
  let hasil;
  try {
    hasil = await terjemahkanBatch(batch);
  } catch (e) {
    console.warn(`  ⚠️  batch ${i / PER_BATCH + 1} gagal: ${e.message}`);
    continue;
  }

  for (const h of hasil) {
    const b = batch[h.i];
    if (!b) continue;
    if (CONTOH) {
      console.log(`\n── ${b.q.question.slice(0, 46)}`);
      console.log(`   SEBELUM: ${String(b.q.explanation).slice(0, 90)}`);
      console.log(`   SESUDAH: ${String(h.explanation).slice(0, 90)}`);
      continue;
    }
    const d = isiBerkas.get(b.f);
    Object.assign(d.questions[b.idx], {
      explanation: h.explanation,
      why_wrong: h.why_wrong,
      tip: h.tip,
      /* Jejak: kalau nanti hasilnya kurang enak dibaca, ketahuan mana yang
         mesin yang nerjemahin dan mana tulisan asli. */
      penjelasan_diterjemahkan: true,
    });
    selesai++;
  }
  process.stdout.write(`  ${Math.min(i + PER_BATCH, antrian.length)}/${antrian.length}\r`);
}
process.stdout.write(" ".repeat(30) + "\r");

const biaya = (tokIn / 1e6) * 5 + (tokOut / 1e6) * 25;   // Opus 5: $5 in / $25 out per MTok
console.log(`token: ${tokIn.toLocaleString()} in · ${tokOut.toLocaleString()} out`);
console.log(`biaya: ~$${biaya.toFixed(2)}`);

if (CONTOH) { console.log("\n(contoh doang — gak ada file yang diubah)"); process.exit(0); }

for (const [f, d] of isiBerkas) {
  await writeFile(f, JSON.stringify(d, null, 2) + "\n", "utf8");
}
console.log(`\n✅ ${selesai} penjelasan diterjemahin di ${isiBerkas.size} file.`);
console.log("   Jalanin `node scripts/build-bank-soal.mjs --apply` buat masukin ke bank soal.");
