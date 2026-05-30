#!/usr/bin/env node
/**
 * Backup semua sesi Supabase (ai_result lengkap) ke JSON file lokal.
 *
 * Cara pakai:
 *   npm run backup                          # default: yusufnashir...@gmail.com
 *   npm run backup -- --user-email you@x.com
 *   npm run backup -- --out materi/import/<level>/<kategori>
 *
 * Output:
 *   <out>/<sanitized-title>__<short-id>.json
 *   <out>/<sanitized-title>__<short-id>.json.pushed   (sentinel biar gak re-import)
 */

import { writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

/* .env.local loader */
function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}
loadEnvLocal();

/* CLI */
const args = process.argv.slice(2);
let userEmail = "yusufnashirsyarifuddin@gmail.com";
let outDir = "materi/import";
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--user-email") userEmail = args[++i];
  else if (a === "--out") outDir = args[++i];
  else if (a === "--help" || a === "-h") {
    console.log("Usage: npm run backup -- [--user-email you@x.com] [--out materi/import]");
    process.exit(0);
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !key) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY gak ada di .env.local");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function findUserId(email) {
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data?.users?.find(u => (u.email ?? "").toLowerCase() === email.toLowerCase());
    if (u) return u.id;
    if (!data?.users?.length || data.users.length < 200) return null;
    page++;
  }
}

/* Sanitize string buat filename — keep alphanumeric, Jepang, dash, underscore */
function sanitizeName(s) {
  return (s ?? "untitled")
    .replace(/[\\/:*?"<>|]/g, "")    // forbidden chars di filesystem
    .replace(/\s+/g, "-")             // space → dash
    .replace(/-+/g, "-")              // collapse multi dash
    .replace(/^-|-$/g, "")            // trim dash
    .slice(0, 120);                   // max 120 char
}

async function main() {
  console.log(`\n📦 Backup sesi Supabase ke ${outDir}/`);
  console.log(`   User: ${userEmail}\n`);

  const userId = await findUserId(userEmail);
  if (!userId) {
    console.error(`❌ User ${userEmail} gak ketemu di Supabase.`);
    process.exit(1);
  }

  // Pull semua sesi user
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("id, title, level, category, total, ai_result, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(`❌ Gagal fetch sesi: ${error.message}`);
    process.exit(1);
  }

  if (!sessions || sessions.length === 0) {
    console.log("⚠️  User belum punya sesi.");
    return;
  }

  console.log(`Ketemu ${sessions.length} sesi. Save ke disk...\n`);

  let saved = 0;
  let skipped = 0;

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const level = s.level || "UNKNOWN";
    const cat = s.category === "AI" ? "AI" : (s.category || "UNKNOWN");

    // Folder: <out>/<level>/<category>/
    const folder = join(outDir, level, cat);
    await mkdir(folder, { recursive: true });

    // Filename: <sanitized-title>__<short-id>.json
    const shortId = s.id.slice(0, 8);
    const titleSafe = sanitizeName(s.title || `session-${shortId}`);
    const filename = `${titleSafe}__${shortId}.json`;
    const filepath = join(folder, filename);
    const sentinel = filepath + ".pushed";

    if (existsSync(filepath) && existsSync(sentinel)) {
      console.log(`[${i + 1}/${sessions.length}] ⏭  ${filename} (skip — udah ada)`);
      skipped++;
      continue;
    }

    // ai_result udah punya {title, vocabulary, questions} sesuai schema importer
    const content = s.ai_result ?? { title: s.title, vocabulary: [], questions: [] };
    await writeFile(filepath, JSON.stringify(content, null, 2), "utf8");
    await writeFile(sentinel, s.id, "utf8");

    const qCount = content.questions?.length ?? 0;
    const vCount = content.vocabulary?.length ?? 0;
    console.log(`[${i + 1}/${sessions.length}] ✓ ${filename} (${qCount} soal, ${vCount} kotoba)`);
    saved++;
  }

  console.log(`\n✅ Selesai. ${saved} sesi disimpan, ${skipped} di-skip.`);
  console.log(`   Lokasi: ${outDir}/<level>/<kategori>/`);
}

main().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
