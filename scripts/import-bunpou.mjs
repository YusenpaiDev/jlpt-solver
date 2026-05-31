#!/usr/bin/env node
/**
 * Import JSON bunpou (generated via Claude.ai chat) ke Supabase bunpou_patterns table.
 *
 * Cara pakai:
 *   1. Generate JSON di Claude.ai pakai prompt di materi/PROMPT-BUNPOU.md
 *   2. Save JSON ke materi/import-bunpou/<nama>.json
 *   3. Jalankan:
 *        npm run import-bunpou
 *        npm run import-bunpou -- --level N1
 *        npm run import-bunpou -- materi/import-bunpou/foo.json
 *
 * Idempotent — upsert by (user_id, pattern). Re-run aman.
 */

import { readFile, readdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
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
let levelOverride = "";
let userEmail = "yusufnashirsyarifuddin@gmail.com";
let importDir = "materi/import-bunpou";
const positional = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--level") levelOverride = args[++i];
  else if (a === "--user-email") userEmail = args[++i];
  else if (a === "--dir") importDir = args[++i];
  else if (a === "--help" || a === "-h") {
    console.log("Usage: npm run import-bunpou -- [--level N2] [--user-email you@x.com] [--dir materi/import-bunpou] [file.json ...]");
    process.exit(0);
  } else positional.push(a);
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

/* Discover JSON files — rekursif */
async function walkJsons(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.startsWith(".")) continue;
      out.push(...await walkJsons(full));
    } else if (e.isFile() && extname(e.name).toLowerCase() === ".json" && !e.name.startsWith(".")) {
      out.push(full);
    }
  }
  return out;
}

async function discoverJsons() {
  if (positional.length > 0) return positional.filter(p => extname(p).toLowerCase() === ".json");
  if (!existsSync(importDir)) {
    console.error(`❌ Folder ${importDir}/ gak ada. Bikin dulu + drop JSON kamu ke situ.`);
    process.exit(1);
  }
  return await walkJsons(importDir);
}

/* Normalize 1 pattern entry */
function normalizePattern(p, fallbackLevel) {
  return {
    pattern: (p.pattern ?? "").toString().trim(),
    meaning: (p.meaning ?? "").toString().trim(),
    connects_to: p.connects_to ?? null,
    notes: p.notes ?? null,
    example_jp: p.example_jp ?? null,
    example_id: p.example_id ?? null,
    level: p.level ?? fallbackLevel ?? null,
  };
}

async function pushFile(userId, filePath) {
  const raw = JSON.parse(await readFile(filePath, "utf8"));
  const fileLevel = levelOverride || raw.level || "N2";
  const patterns = Array.isArray(raw.patterns) ? raw.patterns : [];

  const validRows = patterns
    .map(p => normalizePattern(p, fileLevel))
    .filter(p => p.pattern && p.meaning)
    .map(p => ({ ...p, user_id: userId }));

  if (validRows.length === 0) {
    return { inserted: 0, error: "Gak ada pattern valid di JSON" };
  }

  const { error } = await supabase
    .from("bunpou_patterns")
    .upsert(validRows, { onConflict: "user_id,pattern", ignoreDuplicates: false });

  if (error) return { inserted: 0, error: error.message };
  return { inserted: validRows.length, error: null };
}

async function main() {
  const userId = await findUserId(userEmail);
  if (!userId) {
    console.error(`❌ User ${userEmail} gak ketemu di Supabase.`);
    process.exit(1);
  }

  const files = await discoverJsons();
  if (files.length === 0) {
    console.log(`⚠️  Gak ada JSON di ${importDir}/. Drop file kamu ke situ dulu.`);
    return;
  }

  console.log(`\n📥 Import Bunpou ke Supabase`);
  console.log(`   User: ${userEmail}`);
  console.log(`   Default level: ${levelOverride || "(dari JSON, fallback N2)"}`);
  console.log(`   Files: ${files.length}\n`);

  let totalInserted = 0;
  let totalFailed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`[${i + 1}/${files.length}] ${file}`);
    try {
      const { inserted, error } = await pushFile(userId, file);
      if (error) {
        console.log(`  ❌ ${error}\n`);
        totalFailed++;
        continue;
      }
      console.log(`  ✓ ${inserted} pattern di-upsert\n`);
      totalInserted += inserted;
    } catch (err) {
      console.log(`  ❌ ${err.message}\n`);
      totalFailed++;
    }
  }

  console.log(`✅ Selesai. ${totalInserted} pattern tersimpan${totalFailed > 0 ? `, ${totalFailed} file gagal` : ""}.`);
  console.log(`   Cek di Materi → Bunpou di app.`);
}

main().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
