#!/usr/bin/env node
/**
 * Isi / segarkan katalog Bank Soal (tabel katalog_materi) dari sesi materi di
 * akun owner. Katalog ini yang dilihat SEMUA user di /materi; salinan ke akun
 * user baru dibikin database pas set pertama dibuka (fungsi ambil_set).
 *
 * Jalanin tiap habis ngubah materi di akun owner (import, sync-choukai,
 * mark-ready, …). Progres pribadi owner dibuang dulu — lihat scripts/lib/katalog.mjs.
 *
 * Prasyarat: supabase/migrations/20261102-katalog-bank-soal.sql udah dijalanin.
 *
 *   node scripts/sinkron-katalog.mjs            # dry-run
 *   node scripts/sinkron-katalog.mjs --apply
 *
 * Catatan: salinan yang UDAH ada di akun user gak ikut berubah — buat itu tetap
 * pakai skrip per-judul (sync-choukai, dst) yang nyentuh semua baris.
 */

import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { barisKatalog } from "./lib/katalog.mjs";

if (existsSync(".env.local")) {
  for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "").trim();
  }
}

const APPLY = process.argv.includes("--apply");
const OWNER = "yusufnashirsyarifuddin@gmail.com";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL.trim(), process.env.SUPABASE_SECRET_KEY.trim(), {
  auth: { persistSession: false },
});

async function cariOwner() {
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find(x => (x.email ?? "").toLowerCase() === OWNER);
    if (u) return u.id;
    if (data.users.length < 200) return null;
  }
}

/* PostgREST mentok 1000 baris & ai_result tebal → ambil per 100, urut unik. */
async function semua(buat) {
  const hasil = [];
  for (let a = 0; ; a += 100) {
    const { data, error } = await buat(a, a + 99);
    if (error) throw error;
    hasil.push(...data);
    if (data.length < 100) return hasil;
  }
}

async function main() {
  const ownerId = await cariOwner();
  if (!ownerId) { console.error(`❌ owner ${OWNER} gak ketemu`); process.exit(1); }

  const sesi = await semua((a, b) => sb.from("sessions")
    .select("id, level, category, title, created_at, ai_result")
    .eq("user_id", ownerId).eq("ai_result->>kind", "materi")
    .order("id").range(a, b));
  const { baris, dobel } = barisKatalog(sesi);

  const lama = await semua((a, b) => sb.from("katalog_materi")
    .select("title, ready, ai_result").order("id").range(a, b));
  const petaLama = new Map(lama.map(k => [k.title, k]));

  let baru = 0, berubah = 0, sama = 0;
  for (const r of baris) {
    const k = petaLama.get(r.title);
    if (!k) { baru++; console.log(`  ➕ ${r.title} (${r.total} soal${r.ready ? "" : ", SOON"})`); }
    else if (k.ready !== r.ready || JSON.stringify(k.ai_result) !== JSON.stringify(r.ai_result)) {
      berubah++; console.log(`  ✎ ${r.title} (${r.total} soal${r.ready ? "" : ", SOON"})`);
    } else sama++;
  }
  const yatim = lama.filter(k => !baris.some(r => r.title === k.title)).map(k => k.title);

  const perLevel = {};
  for (const r of baris) perLevel[r.level] = (perLevel[r.level] ?? 0) + 1;
  console.log(`\nSumber owner: ${sesi.length} sesi → ${baris.length} set · ${Object.entries(perLevel).sort().map(([k, v]) => `${k}:${v}`).join(" ")}`);
  if (dobel.length) console.log(`⚠️  judul dobel di akun owner (dipakai yang terbaru): ${dobel.join(", ")}`);
  if (yatim.length) console.log(`⚠️  ada di katalog tapi udah gak ada di owner (dibiarin): ${yatim.join(", ")}`);
  console.log(`Katalog: baru ${baru} · berubah ${berubah} · sama ${sama}`);

  if (!APPLY) { if (baru + berubah > 0) console.log("\n[DRY-RUN] Jalanin lagi dengan --apply buat nulis."); return; }

  const tulis = baris.filter(r => {
    const k = petaLama.get(r.title);
    return !k || k.ready !== r.ready || JSON.stringify(k.ai_result) !== JSON.stringify(r.ai_result);
  });
  for (let i = 0; i < tulis.length; i += 20) {
    const { error } = await sb.from("katalog_materi").upsert(
      tulis.slice(i, i + 20).map(r => ({ ...r, diperbarui: new Date().toISOString() })),
      { onConflict: "title" });
    if (error) { console.error(`❌ ${error.message}`); process.exit(1); }
  }
  console.log(`✅ ${tulis.length} set ditulis ke katalog.`);
}

main().catch(e => { console.error(e); process.exit(1); });
