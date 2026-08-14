#!/usr/bin/env node
/**
 * Sinkronin JSON bank soal yang udah dibersihin ke sesi Supabase yang UDAH ADA.
 *
 * Kenapa bukan `npm run import`: import selalu INSERT sesi baru. Dipakai buat
 * nambal, soal kamu jadi dobel — 89 sesi lama tetap nangkring dengan data rusak,
 * plus 89 sesi baru. Skrip ini nimpa di tempat.
 *
 * Sesi dicocokin lewat UUID di file sentinel `<file>.json.pushed` yang ditulis
 * import waktu push pertama — bukan lewat judul, jadi gak mungkin salah sasaran.
 *
 * Yang DIUBAH  : sessions.ai_result, sessions.total, dan baris di tabel questions
 * Yang DIBIARIN: score, user_id, created_at, level, category, dan sesi latihan
 *                kamu (yang gak punya sentinel — bukan hasil import)
 *
 * Cara pakai:
 *   node scripts/sync-bank-supabase.mjs            # dry-run, gak nulis apa pun
 *   node scripts/sync-bank-supabase.mjs --apply
 *   node scripts/sync-bank-supabase.mjs --verbose  # rinci per sesi
 */

import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { normalizeResult } from "./lib/normalize-soal.mjs";

/* .env.local loader — sama kayak import-json.mjs */
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

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const VERBOSE = args.includes("--verbose");
const dirIdx = args.indexOf("--dir");
const ROOT = dirIdx !== -1 ? args[dirIdx + 1] : "materi/import";

/** Isi lama tiap sesi disimpan di sini sebelum ditimpa — jaring pengaman,
 *  karena Supabase gak punya undo. */
const BACKUP_DIR = "materi/.backup-supabase/20260813";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !key) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY gak ada di .env.local");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

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

/** Sesi yang isinya udah diperkaya SETELAH import — audio choukai ditempel
 *  lewat import-audio-split, transcript/gambar nyusul belakangan. JSON lokal
 *  gak punya itu, jadi nimpa dari lokal = ngehapus kerjaan tersebut.
 *
 *  Bukan hipotesis: sesi 2025_07_聴解 punya 30 soal beraudio di Supabase,
 *  sedangkan file lokalnya cuma menghasilkan 11 soal tanpa audio. */
function punyaPengayaan(lama) {
  if (lama?.section === "choukai") return "sesi choukai";
  const qs = lama?.questions ?? [];
  if (qs.some(q => q?.audio)) return "ada audio nempel";
  if (qs.some(q => Array.isArray(q?.transcript) && q.transcript.length)) return "ada transcript";
  if (qs.some(q => q?.image != null)) return "ada gambar";
  return null;
}

/** Ringkas apa yang berubah, biar dry-run-nya kebaca manusia — bukan cuma
 *  "beda" tapi beda di mana. */
function bandingkan(lama, baru) {
  const qLama = lama?.questions ?? [];
  const qBaru = baru.questions;
  const kunci = q => String(q?.question ?? "").replace(/[\s　]+/gu, "");

  // Antrean per teks pertanyaan, bukan satu entri per teks. Soal 読解 generik
  // ("この文章全体のテーマは、何か。") muncul sekali PER BACAAN di file yang sama,
  // jadi peta biasa bikin soal ke-2 dicocokin ke pasangan soal ke-1 — laporannya
  // jadi ngarang "opsi berubah" padahal cuma salah jodoh. Urutan soal lama & baru
  // sama (pembersihan cuma menghapus, gak menyusun ulang), jadi ambil berurutan.
  const antrean = new Map();
  for (const q of qLama) {
    const k = kunci(q);
    if (!antrean.has(k)) antrean.set(k, []);
    antrean.get(k).push(q);
  }

  let bacaanBaru = 0, opsiBeda = 0;
  for (const q of qBaru) {
    const l = antrean.get(kunci(q))?.shift();
    if (!l) continue;
    if (!l.passage && q.passage) bacaanBaru++;
    if (JSON.stringify(l.options) !== JSON.stringify(q.options)) opsiBeda++;
  }

  return {
    soalLama: qLama.length,
    soalBaru: qBaru.length,
    dibuang: Math.max(0, qLama.length - qBaru.length),
    bacaanBaru,
    opsiBeda,
    berubah: JSON.stringify(lama) !== JSON.stringify(baru),
  };
}

async function main() {
  const files = (await walkJsons(ROOT)).filter(f => existsSync(f + ".pushed"));
  console.log(`\n${APPLY ? "🔴 APPLY — menulis ke Supabase" : "🔍 DRY-RUN — gak menulis apa pun"}`);
  console.log(`   File bersentinel: ${files.length}\n`);

  const t = { sama: 0, berubah: 0, hilang: 0, gagal: 0, dilindungi: 0 };
  const total = { bacaanBaru: 0, opsiBeda: 0, dibuang: 0 };

  for (const f of files) {
    const rel = f.replace(ROOT + "/", "");
    const sessionId = (await readFile(f + ".pushed", "utf8")).trim();

    const { data: sesi, error } = await supabase
      .from("sessions")
      .select("id, user_id, title, total, ai_result")
      .eq("id", sessionId)
      .maybeSingle();

    if (error) { console.log(`  ❌ ${rel} — ${error.message}`); t.gagal++; continue; }
    if (!sesi) { console.log(`  ⚠️  ${rel} — sesi ${sessionId.slice(0, 8)}… gak ada di Supabase (dihapus?)`); t.hilang++; continue; }

    const pengayaan = punyaPengayaan(sesi.ai_result);
    if (pengayaan) {
      console.log(`  🔒 ${rel} — DILEWATI (${pengayaan}); nimpa dari lokal bakal ngehapusnya`);
      t.dilindungi++;
      continue;
    }

    const baru = normalizeResult(JSON.parse(await readFile(f, "utf8")), basename(f, ".json"));
    const d = bandingkan(sesi.ai_result, baru);

    if (!d.berubah) { t.sama++; if (VERBOSE) console.log(`  ·  ${rel} — sudah sama`); continue; }

    t.berubah++;
    total.bacaanBaru += d.bacaanBaru;
    total.opsiBeda += d.opsiBeda;
    total.dibuang += d.dibuang;

    const rincian = [
      d.soalLama !== d.soalBaru ? `${d.soalLama}→${d.soalBaru} soal` : null,
      d.bacaanBaru ? `+${d.bacaanBaru} bacaan` : null,
      d.opsiBeda ? `${d.opsiBeda} opsi diperbaiki` : null,
    ].filter(Boolean).join(", ") || "isi berubah";
    console.log(`  ✎  ${rel} — ${rincian}`);

    if (!APPLY) continue;

    // Simpan isi lama SEBELUM ditimpa. Supabase gak punya undo, dan sesi ini
    // hasil kerja berbulan-bulan — satu file JSON per sesi itu ongkos murah
    // buat bisa balikin.
    await mkdir(BACKUP_DIR, { recursive: true });
    await writeFile(
      join(BACKUP_DIR, `${sessionId}.json`),
      JSON.stringify({ file: rel, session_id: sessionId, total: sesi.total, ai_result: sesi.ai_result }, null, 2),
      "utf8",
    );

    const { error: upErr } = await supabase
      .from("sessions")
      .update({ ai_result: baru, total: baru.questions.length })
      .eq("id", sessionId);
    if (upErr) { console.log(`     ❌ gagal update sesi: ${upErr.message}`); t.gagal++; continue; }

    // Tabel questions cuma ditulis, gak pernah dibaca app (app baca ai_result),
    // tapi tetap disegarkan biar gak nyisain cermin yang isinya beda.
    const { error: delErr } = await supabase.from("questions").delete().eq("session_id", sessionId);
    if (delErr) { console.log(`     ⚠️  questions lama gak kehapus: ${delErr.message}`); continue; }

    if (baru.questions.length > 0) {
      const { error: insErr } = await supabase.from("questions").insert(
        baru.questions.map(q => ({
          session_id: sessionId,
          user_id: sesi.user_id,
          question: q.question,
          options: q.options,
          correct_ans: q.correct,
          explanation: q.explanation,
        })),
      );
      if (insErr) console.log(`     ⚠️  questions baru gak kemasukan: ${insErr.message}`);
    }
  }

  console.log(`\nRingkasan`);
  console.log(`  Sesi sudah sama   : ${t.sama}`);
  console.log(`  Sesi perlu diubah : ${t.berubah}`);
  console.log(`  Sesi dilindungi   : ${t.dilindungi} (choukai / ada audio)`);
  console.log(`  Sesi gak ketemu   : ${t.hilang}`);
  console.log(`  Gagal             : ${t.gagal}`);
  console.log(`  Bacaan 読解 pulih : ${total.bacaanBaru}`);
  console.log(`  Opsi diperbaiki   : ${total.opsiBeda}`);
  console.log(`  Soal sampah dibuang: ${total.dibuang}`);
  if (!APPLY && t.berubah > 0) console.log(`\n  Jalankan lagi dengan --apply buat nulis.`);
  if (APPLY && t.berubah > 0) console.log(`\n  Isi lama tersimpan di ${BACKUP_DIR}/`);
}

main().catch(e => { console.error("❌", e); process.exit(1); });
