#!/usr/bin/env node
/**
 * Buang baris pengganjal di JSON bank soal.
 *
 * Waktu generate awal, kalau ujian aslinya punya soal lebih sedikit dari yang
 * diharapkan, generator nambahin baris kosong biar jumlahnya "genap":
 *
 *   question : "[KOSONG - Q14 接頭辞・接尾辞 artifak - exam aslinya hanya punya 3 word...]"
 *   options  : ["1. [tidak ada di exam asli]", "2. [tidak ada di exam asli]", ...]
 *
 * Itu bukan soal rusak — itu bukan soal. Kalau kesajiin ke user, dia lihat
 * pertanyaan kosong dengan empat pilihan identik.
 *
 * Cara pakai:
 *   node scripts/drop-soal-sampah.mjs            # dry-run
 *   node scripts/drop-soal-sampah.mjs --apply
 */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, extname } from "node:path";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const dirIdx = args.indexOf("--dir");
const ROOT = dirIdx !== -1 ? args[dirIdx + 1] : "materi/import";

/** Penanda di kolom pertanyaan. Sengaja diikat ke awal string biar soal yang
 *  kebetulan NGOMONGIN kata "kosong" di dalam kalimatnya gak ikut kebuang. */
const PENANDA_SOAL = /^\s*\[?\s*KOSONG\b/i;

/** Penanda di kolom opsi. Penandanya boleh nyempil di antara teks lain di dalam
 *  kurung — bunyinya beda-beda tergantung batch generate-nya:
 *    "[belum diisi]"  "[SOURCE MISSING]"  "[KOSONG - pilihan 3 belum diisi - ...]"
 *  Tetap diikat ke dalam kurung siku biar opsi Jepang beneran gak kena. */
const PENANDA_OPSI = /\[[^\]]*(KOSONG|belum diisi|tidak ada di exam asli|SOURCE MISSING|TODO|placeholder)[^\]]*\]/i;

/** Dua bentuk yang sama-sama gak layak tayang:
 *
 *  "pengganjal" — pertanyaan DAN semua opsinya penanda. Bukan soal sama sekali.
 *  "rusak"      — pertanyaannya asli tapi ada opsi yang penanda. Kelihatannya
 *                 bisa dijawab, padahal user disuguhi "[KOSONG - ...]" sebagai
 *                 pilihan. Distraktornya gak bisa dipulihin (soal 真題, ngarang
 *                 pengganti bikin soalnya bukan soal asli lagi), jadi dibuang.
 */
function klasifikasi(q) {
  const opsi = Array.isArray(q?.options) ? q.options : [];
  const adaOpsiKosong = opsi.some(o => PENANDA_OPSI.test(String(o)));
  const semuaOpsiKosong = opsi.length > 0 && opsi.every(o => PENANDA_OPSI.test(String(o)));
  const tanyaKosong = PENANDA_SOAL.test(String(q?.question ?? ""));

  if (tanyaKosong && semuaOpsiKosong) return "pengganjal";
  if (adaOpsiKosong || tanyaKosong) return "rusak";
  return null;
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
  const files = await walkJsons(ROOT);
  let fileDiubah = 0;
  const jumlah = { pengganjal: 0, rusak: 0 };
  const daftarRusak = [];

  for (const f of files) {
    let data;
    try { data = JSON.parse(await readFile(f, "utf8")); } catch { continue; }
    if (!Array.isArray(data.questions)) continue;

    const sebelum = data.questions.length;
    const simpan = [];

    for (const q of data.questions) {
      const jenis = klasifikasi(q);
      if (!jenis) { simpan.push(q); continue; }
      jumlah[jenis]++;
      if (jenis === "rusak") {
        daftarRusak.push({ f, q: String(q?.question ?? "").slice(0, 46) });
      }
    }

    const buang = sebelum - simpan.length;
    if (buang === 0) continue;

    data.questions = simpan;
    fileDiubah++;
    console.log(`  ${String(buang).padStart(2)}x  ${f.replace(ROOT + "/", "")}  (${sebelum} → ${simpan.length} soal)`);
    if (APPLY) await writeFile(f, JSON.stringify(data, null, 2) + "\n", "utf8");
  }

  console.log(`\n${APPLY ? "DITULIS" : "DRY-RUN (pakai --apply buat nulis)"}`);
  console.log(`Baris pengganjal   : ${jumlah.pengganjal}`);
  console.log(`Soal rusak sebagian: ${jumlah.rusak}`);
  console.log(`Total dibuang      : ${jumlah.pengganjal + jumlah.rusak} (di ${fileDiubah} file)`);

  if (daftarRusak.length) {
    console.log(`\nSoal rusak sebagian yang ikut dibuang (pertanyaannya asli, opsinya bolong):`);
    for (const r of daftarRusak) console.log(`   ${r.f.replace(ROOT + "/", "")} — ${r.q}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
