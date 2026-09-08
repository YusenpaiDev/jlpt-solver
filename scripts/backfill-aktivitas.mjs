#!/usr/bin/env node
/**
 * Isi aktivitas_harian dari jejak latihan yang udah ada.
 *
 * Tanpa ini, streak semua orang mulai dari nol pas fitur ini nyala — padahal
 * jejaknya ada, cuma kecerai-berai di beberapa tabel.
 *
 * Sumber:
 *   kotoba_progress.updated_at            → hari latihan kotoba
 *   sessions.created_at (score gak null)  → hari ngerjain soal/choukai
 *
 * Catatan tanggal: baris lama cuma nyimpen timestamptz, dan zona waktu user
 * gak kecatat di mana pun. Di sini dipakai WIB (+7) karena semua user sekarang
 * di Indonesia. Buat baris BARU ini gak jadi soal — client yang ngirim tanggal
 * lokalnya sendiri lewat catat_aktivitas().
 *
 *   node scripts/backfill-aktivitas.mjs            # dry-run
 *   node scripts/backfill-aktivitas.mjs --apply
 */

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

const WIB = 7 * 3600_000;
const hariWib = iso => new Date(new Date(iso).getTime() + WIB).toISOString().slice(0, 10);

/* user_id → tanggal → Set(sumber) */
const peta = new Map();
const catat = (uid, tanggal, sumber) => {
  if (!peta.has(uid)) peta.set(uid, new Map());
  const hari = peta.get(uid);
  if (!hari.has(tanggal)) hari.set(tanggal, new Set());
  hari.get(tanggal).add(sumber);
};

const { data: kp, error: e1 } = await sb.from("kotoba_progress").select("user_id, updated_at");
if (e1) { console.error("❌", e1.message); process.exit(1); }
for (const r of kp) catat(r.user_id, hariWib(r.updated_at), "kotoba");
console.log(`kotoba_progress : ${kp.length} baris`);

const { data: ses, error: e2 } = await sb
  .from("sessions")
  .select("user_id, created_at, ai_result->section")
  .not("score", "is", null);
if (e2) { console.error("❌", e2.message); process.exit(1); }
for (const r of ses) catat(r.user_id, hariWib(r.created_at), r.section === "choukai" ? "choukai" : "soal");
console.log(`sessions berskor: ${ses.length} baris`);

const baris = [];
for (const [uid, hari] of peta) {
  for (const [tanggal, sumber] of hari) {
    baris.push({ user_id: uid, tanggal, jumlah: sumber.size, sumber: [...sumber] });
  }
}

console.log(`\nuser kena  : ${peta.size}`);
console.log(`hari kena  : ${baris.length}`);
for (const [uid, hari] of [...peta].slice(0, 6)) {
  console.log(`   ${uid.slice(0, 8)}… ${hari.size} hari · ${[...hari.keys()].sort().slice(-3).join(", ")}`);
}

if (!APPLY) { console.log("\n[DRY-RUN] Jalanin lagi dengan --apply buat nulis."); process.exit(0); }

for (let i = 0; i < baris.length; i += 200) {
  const { error } = await sb.from("aktivitas_harian").upsert(baris.slice(i, i + 200), { onConflict: "user_id,tanggal" });
  if (error) { console.error("❌", error.message); process.exit(1); }
}
const { count } = await sb.from("aktivitas_harian").select("*", { count: "exact", head: true });
console.log(`\n✅ Selesai. Isi aktivitas_harian: ${count} baris.`);
