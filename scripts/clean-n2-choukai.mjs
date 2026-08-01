#!/usr/bin/env node
/**
 * Hapus sesi choukai N2 LAMA (kerangka: cuma mondai 1-2, pertanyaan placeholder,
 * tanpa transkrip) supaya bisa re-import JSON N2 lengkap tanpa duplikat.
 *
 *   node scripts/clean-n2-choukai.mjs         # DRY: cuma backup + list, gak hapus
 *   node scripts/clean-n2-choukai.mjs --go     # backup LALU hapus beneran
 *
 * SELALU nulis backup ke scripts/.backup-n2-choukai-<count>.json dulu (JSON penuh
 * ai_result) — jadi kalau meleset masih bisa dibalikin. Cakupan aman:
 * HANYA sesi dgn ai_result.section==="choukai" DAN title mengandung "N2".
 * Sesi lain (N4, moji/goi, dst) gak kesentuh.
 */
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}
loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !key) { console.error("❌ env Supabase gak lengkap"); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });
const GO = process.argv.includes("--go");

async function main() {
  const { data, error } = await sb.from("sessions").select("id, title, user_id, ai_result");
  if (error) throw error;
  const targets = (data ?? []).filter(s =>
    s.ai_result?.section === "choukai" && (s.title ?? "").includes("N2"));

  if (!targets.length) { console.log("✅ Gak ada sesi N2 choukai. Nggak ada yang dihapus."); return; }

  console.log(`\n🎯 ${targets.length} sesi N2 choukai kena sasaran:\n`);
  for (const s of targets) {
    const qs = s.ai_result?.questions ?? [];
    const dist = {}; for (const q of qs) { const m = q.mondai ?? "?"; dist[m] = (dist[m] || 0) + 1; }
    console.log(`  • ${s.title}  (${qs.length} soal, mondai ${JSON.stringify(dist)})`);
  }

  // Backup penuh SELALU (dry maupun go).
  const backupPath = `scripts/.backup-n2-choukai-${targets.length}.json`;
  await writeFile(backupPath, JSON.stringify(targets, null, 2), "utf8");
  console.log(`\n💾 Backup penuh → ${backupPath}`);

  if (!GO) {
    console.log("\n🔍 DRY RUN — belum ada yang dihapus. Jalankan dgn --go buat hapus beneran.\n");
    return;
  }

  const ids = targets.map(s => s.id);
  // Hapus questions dulu (FK), baru sessions.
  const { error: qe } = await sb.from("questions").delete().in("session_id", ids);
  if (qe) console.log(`  ⚠️  hapus questions: ${qe.message}`);
  const { error: se } = await sb.from("sessions").delete().in("id", ids);
  if (se) throw se;
  console.log(`\n🗑️  ${ids.length} sesi N2 choukai dihapus. Backup ada di ${backupPath}.`);
  console.log("   Next: npm run import (JSON N2 lengkap) → npm run import-audio-split\n");
}
main().catch(e => { console.error("❌ Error:", e.message ?? e); process.exit(1); });
