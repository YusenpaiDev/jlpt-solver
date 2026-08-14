#!/usr/bin/env node
/**
 * Tambal profiles.target_level dari user_metadata.
 *
 * Kenapa perlu: trigger handle_new_user() cuma nyalin `username`, jadi
 * profiles.target_level selalu keisi default kolom ('N3'). Pilihan asli user
 * — dari halaman daftar & onboarding — nyangkut di auth.users.raw_user_meta_data.
 *
 * Skrip ini nyamain keduanya. Buat nyetop masalahnya di user BARU, jalanin juga
 * materi/MIGRATION-TARGET-LEVEL.sql (bagian trigger butuh SQL Editor).
 *
 *   node scripts/fix-target-level.mjs           # dry-run
 *   node scripts/fix-target-level.mjs --apply
 */

import { existsSync, readFileSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}
loadEnvLocal();

const APPLY = process.argv.includes("--apply");
const BACKUP_DIR = "materi/.backup-supabase/target-level";
const VALID = new Set(["N1", "N2", "N3", "N4", "N5"]);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !key) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY gak ada di .env.local");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function semuaUser() {
  const out = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    out.push(...(data?.users ?? []));
    if (!data?.users?.length || data.users.length < 200) return out;
  }
}

async function main() {
  const users = await semuaUser();
  const { data: profil, error } = await supabase.from("profiles").select("id, target_level");
  if (error) { console.error("❌", error.message); process.exit(1); }
  const peta = new Map((profil ?? []).map(p => [p.id, p.target_level]));

  const perbaikan = [];
  let tanpaMetadata = 0, sudahCocok = 0;

  for (const u of users) {
    const md = u.user_metadata?.target_level;
    if (!md || !VALID.has(md)) { tanpaMetadata++; continue; }
    const sekarang = peta.get(u.id) ?? null;
    if (sekarang === md) { sudahCocok++; continue; }
    perbaikan.push({ id: u.id, email: u.email, dari: sekarang, ke: md });
  }

  console.log(`\n${APPLY ? "🔴 APPLY" : "🔍 DRY-RUN"}`);
  console.log(`User               : ${users.length}`);
  console.log(`Sudah cocok        : ${sudahCocok}`);
  console.log(`Metadata kosong    : ${tanpaMetadata} (dibiarin — gak ada yang bisa dipercaya)`);
  console.log(`Perlu ditambal     : ${perbaikan.length}\n`);

  for (const p of perbaikan) console.log(`  ${String(p.email).padEnd(36)} ${p.dari} → ${p.ke}`);

  if (!APPLY) { console.log(`\nJalankan lagi dengan --apply buat nulis.`); return; }
  if (perbaikan.length === 0) return;

  await mkdir(BACKUP_DIR, { recursive: true });
  await writeFile(join(BACKUP_DIR, "sebelum.json"), JSON.stringify(perbaikan, null, 2), "utf8");

  let ok = 0;
  for (const p of perbaikan) {
    const { error: e } = await supabase.from("profiles").update({ target_level: p.ke }).eq("id", p.id);
    if (e) console.log(`  ❌ ${p.email}: ${e.message}`);
    else ok++;
  }
  console.log(`\n✅ ${ok}/${perbaikan.length} profil ditambal. Nilai lama: ${BACKUP_DIR}/sebelum.json`);
}

main().catch(e => { console.error("❌", e); process.exit(1); });
