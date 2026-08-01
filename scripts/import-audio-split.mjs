#!/usr/bin/env node
/**
 * Import audio choukai POTONGAN (1 klip = 1 soal), beda dari import-audio.mjs
 * yang naruh 1 audio panjang ke SEMUA soal per sesi.
 *
 *   node scripts/import-audio-split.mjs <folder>
 *   # default folder: ~/Downloads/choukai-potong
 *
 * Nama file yang dibaca (contoh):
 *   N3_2010_07_問題一_一番.mp3   → N3 · 2010年7月 · mondai 1 · soal ke-1
 *   N2_2013_12_問題五_七番.mp3   → N2 · 2013年12月 · mondai 5 · soal ke-7
 *
 * Angka boleh kanji (一二三…十一) atau digit. File di-scan rekursif, jadi
 * boleh ditaruh di subfolder N1/N2/N3.
 *
 * Tiap klip di-upload ke bucket 'choukai-audio' (path: N3_2010_07_m1_q1.mp3),
 * lalu di-set ke soal ke-N (dalam mondai) di sesi choukai yang judulnya cocok.
 * Idempotent: upsert storage + update ai_result, aman diulang.
 */
import { readFile, readdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { homedir } from "node:os";
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

const BUCKET = "choukai-audio";
const ROOT = process.argv[2] || join(homedir(), "Downloads", "choukai-potong");
const DRY = process.argv.includes("--dry");

/* Angka kanji → int (dukung 十 combo: 十=10, 十一=11, 二十=20…). */
const KMAP = { "〇": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };
function kanjiNum(s) {
  if (!s) return null;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (s.includes("十")) {
    const [a, b] = s.split("十");
    const tens = a === "" ? 1 : (KMAP[a] ?? NaN);
    const ones = b === "" ? 0 : (KMAP[b] ?? NaN);
    const v = tens * 10 + ones;
    return Number.isNaN(v) ? null : v;
  }
  return KMAP[s] ?? null;
}

/* Parse nama file → {lv, year, mon, mondai, soal}. Toleran spasi/urutan. */
function parseName(name) {
  const base = basename(name, extname(name));
  const lv = base.match(/N([1-5])/)?.[1];
  const ym = base.match(/(20\d{2})\s*[_\-]\s*T?\s*(\d{1,2})/); // T7 = Juli
  const md = base.match(/問題\s*([一二三四五六七八九十〇\d]+)/);
  if (!lv || !ym || !md) return null;
  const mondai = kanjiNum(md[1]);
  // Soal: dukung "N番" (五番) DAN "番号N" (番号1 / 番号2-1 → ambil angka utama).
  let soal = null;
  const bg = base.match(/番号\s*(\d+)/);
  if (bg) soal = parseInt(bg[1], 10);
  else { const sq = base.match(/([一二三四五六七八九十〇\d]+)\s*番/); if (sq) soal = kanjiNum(sq[1]); }
  if (mondai == null || soal == null) return null;
  return { lv, year: ym[1], mon: String(Number(ym[2])).padStart(2, "0"), mondai, soal };
}

/* Scan .mp3 rekursif. */
async function walk(dir) {
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...await walk(p));
    else if (extname(ent.name).toLowerCase() === ".mp3") out.push(p);
  }
  return out;
}

async function ensureBucket() {
  const { data: buckets } = await sb.storage.listBuckets();
  if (buckets?.some(b => b.name === BUCKET)) return;
  const { error } = await sb.storage.createBucket(BUCKET, { public: true });
  if (error && !/already exists/i.test(error.message)) throw error;
  console.log(`📦 bucket '${BUCKET}' dibuat (public)`);
}

async function main() {
  if (!existsSync(ROOT)) { console.error(`❌ folder ${ROOT} gak ada. Kasih path: node scripts/import-audio-split.mjs <folder>`); process.exit(1); }
  const files = await walk(ROOT);
  if (!files.length) { console.log(`⚠️  Gak ada .mp3 di ${ROOT}`); return; }
  console.log(`\n🎧 Import audio choukai POTONGAN — ${files.length} file dari ${ROOT}${DRY ? "  (DRY RUN)" : ""}\n`);

  // Ambil semua sesi choukai sekali (id, title, section).
  const { data: sess, error: se } = await sb.from("sessions").select("id, title, ai_result->section");
  if (se) throw se;
  const choukai = (sess ?? []).filter(s => s.section === "choukai");

  if (!DRY) await ensureBucket();

  // Kelompokin file per sesi (biar update ai_result sekali per sesi).
  const groups = new Map(); // sessionId -> [{clip, url}]
  let skipped = 0, noSession = 0;

  for (const f of files) {
    const meta = parseName(f);
    if (!meta) { console.log(`  ⚠️  ${basename(f)} — nama gak kebaca (skip)`); skipped++; continue; }
    const { lv, year, mon, mondai, soal } = meta;
    const needle = `${year}年${Number(mon)}月`;
    const match = choukai.find(s => (s.title ?? "").includes(`N${lv}`) && (s.title ?? "").includes(needle));
    if (!match) { console.log(`  ⏭  ${basename(f)} — sesi "N${lv} ${needle}" belum ada (import JSON soalnya dulu)`); noSession++; continue; }

    const path = `N${lv}_${year}_${mon}_m${mondai}_q${soal}.mp3`;
    let publicUrl = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    if (!DRY) {
      const buf = await readFile(f);
      const { error: ue } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: "audio/mpeg", upsert: true });
      if (ue) { console.log(`  ❌ ${basename(f)} — gagal upload: ${ue.message}`); skipped++; continue; }
    }
    if (!groups.has(match.id)) groups.set(match.id, { title: match.title, clips: [] });
    groups.get(match.id).clips.push({ mondai, soal, url: publicUrl, name: basename(f) });
  }

  // Terapkan per sesi: set audio ke soal ke-N (index N-1) dalam mondai-nya.
  let attached = 0, missQ = 0;
  for (const [id, g] of groups) {
    const { data: full, error: fe } = await sb.from("sessions").select("ai_result").eq("id", id).single();
    if (fe) { console.log(`  ❌ baca sesi ${id.slice(0, 8)} gagal: ${fe.message}`); continue; }
    const ai = full.ai_result;
    const qs = ai.questions ?? [];
    // index tiap soal dalam mondai-nya (urutan array = urutan 質問)
    let sessAttached = 0;
    for (const c of g.clips) {
      const inMondai = qs.filter(q => Number(q.mondai) === c.mondai);
      const target = inMondai[c.soal - 1];
      if (!target) { missQ++; continue; }
      target.audio = c.url;
      attached++; sessAttached++;
    }
    if (!DRY) {
      const { error: upe } = await sb.from("sessions").update({ ai_result: ai }).eq("id", id);
      if (upe) { console.log(`  ❌ update "${g.title}" gagal: ${upe.message}`); continue; }
    }
    console.log(`  ✓ "${g.title}" — ${sessAttached}/${qs.length} soal dapet klip`);
  }

  console.log(`\n${DRY ? "🔍 DRY: " : "✅ "}Selesai. Kepasang: ${attached} soal · Nama gak kebaca: ${skipped} · Sesi belum ada: ${noSession} · Soal gak ketemu: ${missQ}`);
  if (DRY) console.log("   (DRY RUN — belum ada yang di-upload/diubah. Jalankan tanpa --dry buat eksekusi.)");
}
main().catch(e => { console.error("❌ Error:", e.message ?? e); process.exit(1); });
