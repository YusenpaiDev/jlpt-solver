#!/usr/bin/env node
/**
 * Bangun isi tabel `bank_soal` dari sesi materi di Supabase.
 *
 * Jalanin tiap habis `npm run import` atau `sync-bank-supabase`. Aman diulang:
 * upsert lewat kolom sidik_jari, jadi soal yang sama gak numpuk.
 *
 * Ini sekaligus GERBANG MUTU — soal yang gak lolos pemeriksaan gak masuk tabel,
 * jadi Lembar Tugas mustahil nyajiin soal rusak walau banknya masih ada cacat.
 *
 * Prasyarat: jalanin materi/MIGRATION-BANK-SOAL.sql di SQL editor Supabase.
 *
 * Cara pakai:
 *   node scripts/build-bank-soal.mjs              # dry-run
 *   node scripts/build-bank-soal.mjs --apply
 *   node scripts/build-bank-soal.mjs --apply --reset   # kosongin dulu, bangun ulang
 */

import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

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
const RESET = args.includes("--reset");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !key) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY gak ada di .env.local");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const KATEGORI = ["文法", "語彙", "文字", "読解"];

/** Samain perlakuan opsi kayak src/lib/soal-validate.ts */
const badan = s => String(s)
  .normalize("NFKC")
  .replace(/^[1-4][．.、:：)）\s]*/u, "")
  .replace(/[\s　]+/gu, "")
  .replace(/[。、．,.]+$/u, "")
  .toLowerCase();

const PENANDA = /\[[^\]]*(KOSONG|belum diisi|tidak ada di exam asli|SOURCE MISSING|TODO|placeholder)[^\]]*\]/i;

/** Penjelasan yang ditulis full bahasa Jepang punya NOL huruf latin; gaya
 *  Indonesia sepadat apa pun ("対抗心 = jiwa kompetisi") selalu nyisain beberapa. */
const hurufLatin = s => (String(s).match(/[A-Za-z]/g) ?? []).length;

/** Soal 読解 nanya isi bacaan. Tanpa `passage`, user disuruh jawab soal tentang
 *  teks yang gak pernah dia lihat — lebih baik gak usah disajikan. */
function tolak(q, kategori) {
  const opsi = Array.isArray(q.options) ? q.options : [];
  const blob = [q.question, ...opsi].join(" ");

  if (!String(q.question ?? "").trim()) return "pertanyaan kosong";
  if (PENANDA.test(blob)) return "baris pengganjal";
  if (opsi.length !== 4) return `opsi ${opsi.length}`;
  if (opsi.some(o => !badan(o))) return "ada opsi kosong";
  if (new Set(opsi.map(badan)).size !== 4) return "opsi duplikat";

  const k = parseInt(q.correct, 10);
  if (!(k >= 1 && k <= 4)) return "kunci jawaban invalid";

  if (!String(q.explanation ?? "").trim()) return "penjelasan kosong";
  if (hurufLatin(`${q.explanation} ${q.why_wrong ?? ""} ${q.tip ?? ""}`) < 3) {
    return "penjelasan full bahasa Jepang";
  }

  if (kategori === "読解" && !String(q.passage ?? "").trim()) return "読解 tanpa bacaan";

  return null;
}

/** "聴解-課題理解" → null (dibuang), "文字・語彙" → 文字. */
function petakanKategori(raw) {
  const c = String(raw ?? "");
  if (c.startsWith("聴解")) return null;
  return KATEGORI.find(k => c.includes(k)) ?? null;
}

function sidikJari(q) {
  const bahan = badan(q.question) + "|" + (q.options ?? []).map(badan).join("|");
  return createHash("md5").update(bahan).digest("hex");
}

async function main() {
  const { data: sesi, error } = await supabase
    .from("sessions")
    .select("id, level, ai_result")
    .eq("ai_result->>kind", "materi");
  if (error) { console.error("❌", error.message); process.exit(1); }

  const baris = [];
  const kunciTerpakai = new Set();
  const ditolak = {};
  let mentah = 0, kembar = 0;

  for (const s of sesi ?? []) {
    for (const q of s.ai_result?.questions ?? []) {
      mentah++;

      const kategori = petakanKategori(q.category);
      if (!kategori) { ditolak["聴解 / kategori gak dikenal"] = (ditolak["聴解 / kategori gak dikenal"] ?? 0) + 1; continue; }

      const alasan = tolak(q, kategori);
      if (alasan) { ditolak[alasan] = (ditolak[alasan] ?? 0) + 1; continue; }

      // Dedup di sisi skrip juga, bukan cuma andelin unique constraint —
      // satu batch upsert yang isinya dua baris ber-sidik-jari sama ditolak
      // Postgres sekaligus ("ON CONFLICT DO UPDATE tidak bisa dua kali").
      const sj = sidikJari(q);
      if (kunciTerpakai.has(sj)) { kembar++; continue; }
      kunciTerpakai.add(sj);

      baris.push({
        session_id: s.id,
        level: s.level,
        category: kategori,
        question: q.question,
        options: q.options,
        correct: String(q.correct),
        explanation: q.explanation ?? null,
        why_wrong: q.why_wrong ?? null,
        grammar_points: Array.isArray(q.grammar_points) ? q.grammar_points : null,
        tip: q.tip ?? null,
        passage: q.passage ?? null,
        sidik_jari: sj,
      });
    }
  }

  const perLevel = {};
  for (const b of baris) {
    perLevel[b.level] ??= {};
    perLevel[b.level][b.category] = (perLevel[b.level][b.category] ?? 0) + 1;
  }

  console.log(`\n${APPLY ? "🔴 APPLY" : "🔍 DRY-RUN"}${RESET ? " + RESET" : ""}`);
  console.log(`Sesi materi   : ${sesi?.length ?? 0}`);
  console.log(`Soal mentah   : ${mentah}`);
  console.log(`Kembar dibuang: ${kembar}`);
  console.log(`Lolos ke bank : ${baris.length}\n`);

  console.log("Ditolak:");
  for (const [k, v] of Object.entries(ditolak).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(4)}x  ${k}`);
  }

  console.log("\nStok per level:");
  console.log("       " + KATEGORI.map(k => k.padStart(7)).join("") + "    TOTAL");
  for (const lv of ["N1", "N2", "N3", "N4", "N5"]) {
    const r = perLevel[lv] ?? {};
    const t = KATEGORI.reduce((a, k) => a + (r[k] ?? 0), 0);
    console.log(lv.padEnd(7) + KATEGORI.map(k => String(r[k] ?? 0).padStart(7)).join("") + String(t).padStart(9));
  }

  if (!APPLY) { console.log(`\nJalankan lagi dengan --apply buat nulis.`); return; }

  if (RESET) {
    const { error: delErr } = await supabase.from("bank_soal").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (delErr) { console.error("❌ gagal ngosongin:", delErr.message); process.exit(1); }
    console.log("\nTabel dikosongkan.");
  }

  // Dipotong-potong biar gak kena batas ukuran request.
  const UKURAN = 500;
  let masuk = 0;
  for (let i = 0; i < baris.length; i += UKURAN) {
    const potongan = baris.slice(i, i + UKURAN);
    const { error: upErr } = await supabase
      .from("bank_soal")
      .upsert(potongan, { onConflict: "sidik_jari" });
    if (upErr) { console.error(`❌ batch ${i / UKURAN + 1}:`, upErr.message); process.exit(1); }
    masuk += potongan.length;
    process.stdout.write(`\r  ${masuk}/${baris.length} soal…`);
  }

  const { count } = await supabase.from("bank_soal").select("*", { count: "exact", head: true });
  console.log(`\n\n✅ Selesai. Isi tabel bank_soal sekarang: ${count} soal.`);
}

main().catch(e => { console.error("❌", e); process.exit(1); });
