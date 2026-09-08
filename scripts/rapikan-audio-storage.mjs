#!/usr/bin/env node
/**
 * Kecilin bucket choukai-audio. Dua tahap, bisa dijalanin terpisah.
 *
 *   --yatim    buang file yang gak dirujuk sesi mana pun
 *   --kompres  re-encode klip yang MASIH dipakai ke AAC 32kbps mono
 *
 * Kenapa perlu: bucket kelewat 2,3× batas gratis Supabase (2.390 MB dari
 * 1.024 MB), dan project kena ancaman restriksi.
 *
 * Tahap 1 (yatim) nyumbang paling banyak dan gak perlu proses apa pun:
 * 25 dari 27 rekaman ujian UTUH itu sisa pendekatan lama (satu audio panjang
 * dipakai semua soal di satu sesi) yang udah digantiin klip per soal. Sisanya
 * klip buat tanggal ujian yang soalnya belum pernah di-import.
 *
 * Tahap 2 (kompres) pakai `afconvert` bawaan macOS — gak perlu install ffmpeg.
 * AAC-LC 32kbps mono, bukan HE-AAC: HE-AAC ukurannya lebih kecil tapi hasilnya
 * durasinya kebaca 66 detik dari sumber 95 detik, dan buat audio listening itu
 * risiko yang gak sebanding.
 *
 * Ekstensi berubah .mp3 → .m4a, jadi URL di sessions.ai_result ikut di-update
 * dan file lamanya dibuang — dalam urutan itu, biar gak ada saat di mana
 * URL-nya nunjuk ke file yang udah gak ada.
 *
 *   node scripts/rapikan-audio-storage.mjs --yatim            # dry-run
 *   node scripts/rapikan-audio-storage.mjs --yatim --apply
 *   node scripts/rapikan-audio-storage.mjs --kompres          # dry-run
 *   node scripts/rapikan-audio-storage.mjs --kompres --apply
 */

import { existsSync, readFileSync, mkdirSync, statSync, readFileSync as rf } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createClient } from "@supabase/supabase-js";

const jalankan = promisify(execFile);

if (existsSync(".env.local")) {
  for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "").trim();
  }
}

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const MODE = args.includes("--kompres") ? "kompres" : args.includes("--yatim") ? "yatim" : null;
if (!MODE) { console.error("Pakai: --yatim atau --kompres [--apply]"); process.exit(1); }

const BUCKET = "choukai-audio";
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL.trim(),
  process.env.SUPABASE_SECRET_KEY.trim(),
  { auth: { persistSession: false } }
);

const mb = n => (n / 1048576).toFixed(1);

async function semuaObjek() {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await sb.storage.from(BUCKET).list("", { limit: 1000, offset: off });
    if (error) { console.error("❌", error.message); process.exit(1); }
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

/** Nama file audio yang dirujuk sesi mana pun — ini yang gak boleh disentuh. */
async function yangDipakai() {
  const { data, error } = await sb
    .from("sessions")
    .select("id, ai_result")
    .eq("ai_result->>section", "choukai");
  if (error) { console.error("❌", error.message); process.exit(1); }
  const pakai = new Set();
  for (const s of data) for (const q of s.ai_result?.questions ?? []) {
    if (q.audio) pakai.add(q.audio.split("/").pop());
  }
  return { pakai, sesi: data };
}

async function buangYatim() {
  const objek = await semuaObjek();
  const { pakai } = await yangDipakai();
  const yatim = objek.filter(f => !pakai.has(f.name));
  const besar = yatim.reduce((n, f) => n + (f.metadata?.size ?? 0), 0);
  const total = objek.reduce((n, f) => n + (f.metadata?.size ?? 0), 0);

  const utuh = yatim.filter(f => /^\d{4}_\d{2}\.mp3$/.test(f.name));
  console.log(`objek di bucket : ${objek.length} · ${mb(total)} MB`);
  console.log(`dirujuk sesi    : ${objek.length - yatim.length}`);
  console.log(`YATIM           : ${yatim.length} file · ${mb(besar)} MB`);
  console.log(`   di antaranya rekaman ujian utuh (pendekatan lama): ${utuh.length}`);
  console.log(`sesudah dibuang : ${mb(total - besar)} MB\n`);

  if (!APPLY) { console.log("[DRY-RUN] Tambahin --apply buat beneran hapus."); return; }

  for (let i = 0; i < yatim.length; i += 100) {
    const batch = yatim.slice(i, i + 100).map(f => f.name);
    const { error } = await sb.storage.from(BUCKET).remove(batch);
    if (error) { console.error("❌", error.message); process.exit(1); }
    process.stdout.write(`  ${Math.min(i + 100, yatim.length)}/${yatim.length}\r`);
  }
  console.log(`\n✅ ${yatim.length} file yatim dibuang · ${mb(besar)} MB dibebasin.`);
}

async function kompres() {
  const objek = await semuaObjek();
  const { pakai, sesi } = await yangDipakai();

  /* Cuma klip .mp3 yang masih dipakai. Yang .m4a berarti udah pernah dikompres. */
  const target = objek.filter(f => pakai.has(f.name) && f.name.endsWith(".mp3"));
  const besar = target.reduce((n, f) => n + (f.metadata?.size ?? 0), 0);
  console.log(`klip dipakai & masih .mp3 : ${target.length} file · ${mb(besar)} MB`);
  console.log(`perkiraan sesudah 32kbps  : ~${mb(besar * 0.26)} MB\n`);

  if (!APPLY) { console.log("[DRY-RUN] Tambahin --apply buat beneran konversi."); return; }

  const kerja = join(tmpdir(), "choukai-kompres");
  mkdirSync(kerja, { recursive: true });

  /* nama lama → nama baru, dipakai buat nge-update URL di ai_result */
  const petaNama = new Map();
  let hemat = 0, gagal = 0;

  for (const [i, f] of target.entries()) {
    const namaBaru = f.name.replace(/\.mp3$/, ".m4a");
    const asli = join(kerja, f.name);
    const hasil = join(kerja, namaBaru);
    try {
      const { data, error } = await sb.storage.from(BUCKET).download(f.name);
      if (error) throw error;
      const { writeFile } = await import("node:fs/promises");
      await writeFile(asli, Buffer.from(await data.arrayBuffer()));

      await jalankan("afconvert", ["-f", "m4af", "-d", "aac", "-b", "32000", "-c", "1", asli, hasil]);

      const isi = await readFile(hasil);
      const { error: eUp } = await sb.storage.from(BUCKET)
        .upload(namaBaru, isi, { contentType: "audio/mp4", upsert: true });
      if (eUp) throw eUp;

      hemat += (f.metadata?.size ?? 0) - isi.length;
      petaNama.set(f.name, namaBaru);
      await unlink(asli).catch(() => {});
      await unlink(hasil).catch(() => {});
    } catch (e) {
      gagal++;
      console.warn(`\n  ⚠️  ${f.name}: ${e.message ?? e}`);
    }
    if ((i + 1) % 25 === 0) process.stdout.write(`  ${i + 1}/${target.length} · hemat ${mb(hemat)} MB\r`);
  }
  process.stdout.write(" ".repeat(50) + "\r");

  /* URL di-update DULUAN, file lama dibuang belakangan — biar gak ada jeda
     di mana sesi nunjuk ke file yang udah gak ada. */
  let sesiDiubah = 0;
  for (const s of sesi) {
    let ubah = false;
    for (const q of s.ai_result?.questions ?? []) {
      if (!q.audio) continue;
      const nama = q.audio.split("/").pop();
      const baru = petaNama.get(nama);
      if (baru) { q.audio = q.audio.replace(nama, baru); ubah = true; }
    }
    if (!ubah) continue;
    const { error } = await sb.from("sessions").update({ ai_result: s.ai_result }).eq("id", s.id);
    if (error) { console.error(`❌ sesi ${s.id}: ${error.message}`); process.exit(1); }
    sesiDiubah++;
  }

  const lama = [...petaNama.keys()];
  for (let i = 0; i < lama.length; i += 100) {
    await sb.storage.from(BUCKET).remove(lama.slice(i, i + 100));
  }

  console.log(`✅ ${petaNama.size} klip dikompres · ${gagal} gagal`);
  console.log(`   ${sesiDiubah} sesi URL-nya di-update · ${mb(hemat)} MB dibebasin`);
}

await (MODE === "yatim" ? buangYatim() : kompres());
