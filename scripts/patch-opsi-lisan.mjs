#!/usr/bin/env node
/**
 * Tandai soal 聴解 yang opsinya cuma dibacain lewat audio (問題3/4/5).
 *
 * Kenapa gak lewat sync-choukai: skrip itu nimpa ai_result UTUH dari file
 * lokal, dan file lokal `audio: null`. Kalau dipakai sesudah import-audio-split,
 * klip yang barusan nempel ikut kehapus. Yang ini cuma nyentuh satu field per
 * soal — audio, transkrip, gambar, skor, semuanya gak keganggu.
 *
 * Soal dikenali dari bentuk opsinya sendiri (["1","2","3"]), bukan dari urutan,
 * jadi aman walau isi sesi udah bergeser.
 *
 *   node scripts/patch-opsi-lisan.mjs --level N1          # dry-run
 *   node scripts/patch-opsi-lisan.mjs --level N1 --apply
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
if (!level || !/^N[1-5]$/.test(level)) {
  console.error("Pakai: node scripts/patch-opsi-lisan.mjs --level N1 [--apply]");
  process.exit(1);
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL.trim(),
  process.env.SUPABASE_SECRET_KEY.trim(),
  { auth: { persistSession: false } }
);

/** Opsi hasil restorasi bentuknya nomor polos — persis ["1","2","3"]. */
const nomorPolos = o =>
  Array.isArray(o) && o.length >= 3 && o.every((x, i) => String(x).trim() === String(i + 1));

const { data, error } = await sb
  .from("sessions")
  .select("id, title, ai_result")
  .eq("level", level)
  .eq("ai_result->>kind", "materi")
  .eq("ai_result->>section", "choukai");
if (error) { console.error("❌", error.message); process.exit(1); }

let sesiKena = 0, soalKena = 0, adaAudio = 0;

for (const s of data) {
  const qs = s.ai_result?.questions ?? [];
  let ubah = 0;
  for (const q of qs) {
    if (nomorPolos(q.options) && q.opsiLisan !== true) { q.opsiLisan = true; ubah++; }
    if (q.audio) adaAudio++;
  }
  if (!ubah) continue;
  sesiKena++; soalKena += ubah;

  if (APPLY) {
    const { error: e } = await sb.from("sessions").update({ ai_result: s.ai_result }).eq("id", s.id);
    if (e) { console.error(`❌ ${s.id}: ${e.message}`); process.exit(1); }
  }
}

console.log(
  `${APPLY ? "" : "[DRY-RUN] "}${level} · sesi diperiksa: ${data.length} · ` +
  `sesi ditandai: ${sesiKena} · soal ditandai: ${soalKena} · soal beraudio (dipertahankan): ${adaAudio}`
);
if (!APPLY && soalKena > 0) console.log("Jalanin lagi dengan --apply buat nulis.");
