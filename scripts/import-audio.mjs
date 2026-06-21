#!/usr/bin/env node
/**
 * Import audio choukai: upload MP3 per-tes ke Supabase Storage (bucket
 * 'choukai-audio') lalu set field `audio` di SEMUA soal sesi choukai yang cocok.
 *
 *   npm run import-audio
 *
 * Nama file auto-dideteksi (gak perlu rename):
 *   "N2 7-2010.mp3"  → 2010_07   |  "N2 12-2010.mp3" → 2010_12
 *   "N2 T7-2018.mp3" → 2018_07   |  "2010_07.mp3"     → 2010_07
 * Sesi dicocokin lewat judul ("...YYYY年M月 聴解") + ai_result.section==="choukai".
 */
import { readFile, readdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join, extname, basename } from "node:path";
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
if (!url || !key) { console.error("❌ env Supabase gak lengkap di .env.local"); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

const AUDIO_DIR = "materi/import/N2/CHOUKAI/audio";
const BUCKET = "choukai-audio";

/* Derive "YYYY_MM" dari nama file (toleran berbagai format). */
function audioKey(name) {
  const base = basename(name, extname(name));
  // tahun-dulu: "2025--07" / "2025_07" / "2025 - 7" (toleran spasi/fullwidth + dash dobel)
  let m = base.match(/(20\d{2})\s*[-_]+\s*(\d{1,2})(?!\d)/);
  if (m) return `${m[1]}_${String(m[2]).padStart(2, "0")}`;
  // bulan-dulu: "[T]7-2010" / "T12 - 2024" / "12-2010" (toleran spasi & kata "mp3" di nama)
  m = base.match(/T?\s*(\d{1,2})\s*[-_]+\s*(20\d{2})/i);
  if (m) return `${m[2]}_${String(m[1]).padStart(2, "0")}`;
  return null;
}

async function ensureBucket() {
  const { data: buckets } = await sb.storage.listBuckets();
  if (buckets?.some(b => b.name === BUCKET)) return;
  const { error } = await sb.storage.createBucket(BUCKET, { public: true });
  if (error && !/already exists/i.test(error.message)) throw error;
  console.log(`📦 bucket '${BUCKET}' dibuat (public)`);
}

async function main() {
  if (!existsSync(AUDIO_DIR)) { console.error(`❌ folder ${AUDIO_DIR}/ gak ada`); process.exit(1); }
  await ensureBucket();

  const files = (await readdir(AUDIO_DIR)).filter(f => extname(f).toLowerCase() === ".mp3");
  if (!files.length) { console.log(`⚠️  Gak ada .mp3 di ${AUDIO_DIR}/`); return; }

  // Ambil sesi choukai (id, title) — section dicek lewat sub-select biar ringan.
  const { data: sess, error: se } = await sb.from("sessions")
    .select("id, title, ai_result->section");
  if (se) throw se;
  const choukai = (sess ?? []).filter(s => s.section === "choukai");

  console.log(`\n🎧 Import audio choukai (${files.length} file)\n`);

  for (const file of files) {
    const k = audioKey(file);
    if (!k) { console.log(`  ⏭  ${file} — nama gak kebaca (skip)\n`); continue; }
    const [year, mon] = k.split("_");
    const titleNeedle = `${year}年${Number(mon)}月`; // "2010年7月"

    // 1) upload ke Storage
    const buf = await readFile(join(AUDIO_DIR, file));
    const path = `${k}.mp3`;
    const { error: ue } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: "audio/mpeg", upsert: true });
    if (ue) { console.log(`  ❌ ${file} — gagal upload: ${ue.message}\n`); continue; }
    const audioUrl = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    // 2) cocokin ke sesi (judul + section choukai)
    const matches = choukai.filter(s => (s.title ?? "").includes(titleNeedle));
    if (!matches.length) {
      console.log(`  ⬆️  ${file} → ${path} (uploaded) — tapi belum ada sesi "${titleNeedle}" (import JSON-nya dulu)\n`);
      continue;
    }
    for (const s of matches) {
      const { data: full } = await sb.from("sessions").select("ai_result").eq("id", s.id).single();
      const ai = full.ai_result;
      ai.questions = (ai.questions ?? []).map(q => ({ ...q, audio: audioUrl }));
      const { error: upe } = await sb.from("sessions").update({ ai_result: ai }).eq("id", s.id);
      if (upe) { console.log(`  ❌ update sesi ${s.id.slice(0,8)} gagal: ${upe.message}`); continue; }
      console.log(`  ✓ ${file} → ${ai.questions.length} soal "${s.title}" dapet audio`);
    }
    console.log("");
  }
  console.log("✅ Selesai. Buka soal choukai, tombol play/mundur/maju harusnya nyala.");
}
main().catch(e => { console.error("❌ Error:", e.message ?? e); process.exit(1); });
