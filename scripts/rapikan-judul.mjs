#!/usr/bin/env node
/**
 * Rapiin judul paket ujian.
 *
 * Judulnya kebawa catatan proses import — dan sebagian sekarang salah:
 *
 *   "JLPT N2 - 2013年7月 過去問 (Lengkap 75 Soal)"        → gak 75 lagi, sampahnya udah dibuang
 *   "JLPT N2 - 2021年12月 過去問 (71 asli + 4 artifak…)"  → artifaknya udah gak ada
 *   "JLPT 2010年7月 N2 全問題 (…) (+3 foto)"              → "+3 foto" itu catatan impor
 *
 * Dijadiin satu bentuk: "JLPT N2 — 2013年7月 過去問" / "… 聴解".
 *
 * Nulis ke TIGA tempat sekaligus, kalau cuma satu nanti balik lagi:
 *   · JSON lokal (dipakai import & sync berikutnya)
 *   · sessions.title   (yang dibaca halaman Materi)
 *   · ai_result.title  (kebawa waktu sync)
 *
 *   node scripts/rapikan-judul.mjs            # dry-run
 *   node scripts/rapikan-judul.mjs --apply
 */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
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
const ROOT = "materi/import";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !key) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY gak ada di .env.local");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

/** Bikin judul baku dari judul lama. null = gak bisa diurai, biarin apa adanya. */
export function rapikan(judul, isChoukai, levelHint) {
  const t = String(judul ?? "");
  // Sebagian judul gak nyebut levelnya (kesimpan di kolom sessions.level atau
  // nama folder), jadi terima juga dari luar.
  const level = t.match(/\bN[1-5]\b/)?.[0] ?? levelHint;
  const tgl = t.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月/);
  if (!level || !tgl) return null;

  const jenis = isChoukai ? "聴解" : "過去問";
  return `JLPT ${level} — ${tgl[1]}年${Number(tgl[2])}月 ${jenis}`;
}

async function walkJsons(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walkJsons(full));
    else if (e.isFile() && extname(e.name).toLowerCase() === ".json") out.push(full);
  }
  return out;
}

async function main() {
  /* ── JSON lokal ── */
  let fileUbah = 0;
  const lewat = [];
  for (const f of await walkJsons(ROOT)) {
    let data;
    try { data = JSON.parse(await readFile(f, "utf8")); } catch { continue; }
    const isCho = data.section === "choukai"
      || (data.questions ?? []).some(q => String(q.category ?? "").startsWith("聴解"));
    const dariFolder = f.match(/\bN[1-5]\b/)?.[0];
    const baru = rapikan(data.title, isCho, dariFolder);
    if (!baru) { if (data.title) lewat.push(`${f.replace(ROOT + "/", "")} — ${data.title}`); continue; }
    if (baru === data.title) continue;
    console.log(`  ${data.title}\n  → ${baru}\n`);
    data.title = baru;
    fileUbah++;
    if (APPLY) await writeFile(f, JSON.stringify(data, null, 2) + "\n", "utf8");
  }

  /* ── Supabase ── */
  const { data: sesi, error } = await supabase
    .from("sessions").select("id, title, level, ai_result").eq("ai_result->>kind", "materi");
  if (error) { console.error("❌", error.message); process.exit(1); }

  let sesiUbah = 0;
  for (const s of sesi ?? []) {
    const isCho = s.ai_result?.section === "choukai";
    const baru = rapikan(s.title, isCho, s.level);
    if (!baru || baru === s.title) continue;
    sesiUbah++;
    if (!APPLY) continue;
    await supabase.from("sessions")
      .update({ title: baru, ai_result: { ...s.ai_result, title: baru } })
      .eq("id", s.id);
  }

  console.log(`${APPLY ? "DITULIS" : "DRY-RUN (pakai --apply buat nulis)"}`);
  console.log(`JSON lokal dirapiin : ${fileUbah}`);
  console.log(`Sesi Supabase       : ${sesiUbah}`);
  if (lewat.length) {
    console.log(`\nDilewati — level/tanggal gak kebaca dari judulnya (${lewat.length}):`);
    for (const x of lewat.slice(0, 8)) console.log(`   ${x}`);
  }
}

main().catch(e => { console.error("❌", e); process.exit(1); });
