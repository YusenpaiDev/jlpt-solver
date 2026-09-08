#!/usr/bin/env node
/**
 * Beresin dua sisa setelah import-audio-split:
 *
 *   1. WARIS — soal 統合理解 (問題5) yang audionya "hilang". Bukan hilang: satu
 *      rekaman dipakai 2 pertanyaan (質問1・質問2), jadi klipnya cuma 3 buat 4
 *      jawaban. import-audio-split mencocokkan soal ke-N ke klip ke-N, jadi
 *      pertanyaan terakhir gak kebagian. Diwarisin dari soal sebelumnya
 *      SELAMA masih di mondai yang sama.
 *
 *   2. SEBAR — import-audio-split cuma nempel ke satu baris per judul, yaitu
 *      punya owner. Salinan di akun tester tetap bisu. Di sini `audio`,
 *      `transcript`, dan `image` disalin dari sesi owner ke sesi berjudul sama
 *      milik user lain, dicocokin per indeks soal (urutannya identik karena
 *      dua-duanya di-sync dari file lokal yang sama).
 *
 * Cuma nyentuh tiga field itu — pertanyaan, opsi, kunci, skor, dan flag lain
 * gak diapa-apain.
 *
 *   node scripts/rapikan-audio-choukai.mjs --level N1          # dry-run
 *   node scripts/rapikan-audio-choukai.mjs --level N1 --apply
 */

import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) {
  for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "").trim();
  }
}

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const level = args[args.indexOf("--level") + 1];
const OWNER = "yusufnashirsyarifuddin@gmail.com";
if (!level || !/^N[1-5]$/.test(level)) {
  console.error("Pakai: node scripts/rapikan-audio-choukai.mjs --level N1 [--apply]");
  process.exit(1);
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL.trim(),
  process.env.SUPABASE_SECRET_KEY.trim(),
  { auth: { persistSession: false } }
);

const { data: { users } } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
const ownerId = users.find(u => (u.email ?? "").toLowerCase() === OWNER)?.id;
if (!ownerId) { console.error(`❌ owner ${OWNER} gak ketemu`); process.exit(1); }

const { data, error } = await sb
  .from("sessions")
  .select("id, user_id, title, ai_result")
  .eq("level", level)
  .eq("ai_result->>kind", "materi")
  .eq("ai_result->>section", "choukai");
if (error) { console.error("❌", error.message); process.exit(1); }

const perlu = new Map();                       // id sesi → ai_result yang udah diubah
const tandai = id => (obj) => perlu.set(id, obj);

/* ── 1. waris klip di dalam mondai yang sama ── */
let diwarisin = 0;
for (const s of data) {
  const qs = s.ai_result?.questions ?? [];
  let ubah = 0;
  for (let i = 1; i < qs.length; i++) {
    const q = qs[i], sblm = qs[i - 1];
    if (!q.audio && sblm.audio && q.mondai != null && q.mondai === sblm.mondai) {
      q.audio = sblm.audio;
      if (!q.transcript && sblm.transcript) q.transcript = sblm.transcript;
      ubah++;
    }
  }
  if (ubah) { diwarisin += ubah; tandai(s.id)(s.ai_result); }
}

/* ── 2. sebar dari owner ke akun lain ── */
const ownerPerJudul = new Map(
  data.filter(s => s.user_id === ownerId).map(s => [s.title, s.ai_result?.questions ?? []])
);

let disebar = 0, sesiSebar = 0, tanpaInduk = 0;
for (const s of data) {
  if (s.user_id === ownerId) continue;
  const induk = ownerPerJudul.get(s.title);
  if (!induk) { tanpaInduk++; continue; }

  const qs = s.ai_result?.questions ?? [];
  if (qs.length !== induk.length) { tanpaInduk++; continue; }   // beda isi → jangan tebak

  let ubah = 0;
  for (let i = 0; i < qs.length; i++) {
    if (!qs[i].audio && induk[i].audio) { qs[i].audio = induk[i].audio; ubah++; }
    if (!qs[i].transcript && induk[i].transcript) qs[i].transcript = induk[i].transcript;
    if (!qs[i].image && induk[i].image) qs[i].image = induk[i].image;
  }
  if (ubah) { disebar += ubah; sesiSebar++; tandai(s.id)(s.ai_result); }
}

if (APPLY) {
  let n = 0;
  for (const [id, ai] of perlu) {
    const { error: e } = await sb.from("sessions").update({ ai_result: ai }).eq("id", id);
    if (e) { console.error(`❌ ${id}: ${e.message}`); process.exit(1); }
    if (++n % 25 === 0) process.stdout.write(`  ${n}/${perlu.size} sesi…\r`);
  }
  process.stdout.write(" ".repeat(40) + "\r");
}

console.log(
  `${APPLY ? "" : "[DRY-RUN] "}${level} · sesi disentuh: ${perlu.size}\n` +
  `  klip diwarisin (1 rekaman 2 pertanyaan) : ${diwarisin}\n` +
  `  klip disebar ke akun lain               : ${disebar} (${sesiSebar} sesi)\n` +
  `  sesi dilewat (gak ada induk / isi beda) : ${tanpaInduk}`
);
if (!APPLY && perlu.size > 0) console.log("\nJalanin lagi dengan --apply buat nulis.");
