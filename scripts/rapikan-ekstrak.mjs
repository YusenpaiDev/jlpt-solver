#!/usr/bin/env node
/**
 * Rapikan hasil ekstraksi mentah di `ekstrak/` → struktur `materi/import/`.
 *
 * Yang dikerjain:
 *
 *   1. Pindah + rename ke konvensi repo
 *        筆記  → materi/import/<LV>/<LV>_JLPT_JSON/<LV>_YYYY_MM.json
 *        聴解  → materi/import/<LV>/CHOUKAI/YYYY_MM_聴解.json   (ikut pola N2)
 *
 *   2. Buang soal 聴解 yang opsinya gak tercetak (問題3/4/5 = 概要理解・統合理解・
 *      即時応答, plus 問題1 yang opsinya gambar). Di ujian asli opsinya cuma
 *      dibacain lewat audio — tanpa audio + transkrip soalnya gak bisa dijawab,
 *      jadi mendingan gak usah masuk daripada jadi soal buntu.
 *
 *   3. Angkat catatan ekstraksi keluar dari teks soal. Ekstraktor nulis
 *      peringatan langsung di dalam `question` ("※CATATAN PENTING: … REKONSTRUKSI
 *      Claude …"). Itu pesan buat kita, bukan buat yang lagi latihan — kalau
 *      dibiarin bakal kebaca mentah di layar. Dipindah ke `catatan`, dan soal
 *      yang isinya rekonstruksi ditandai `rekonstruksi: true` biar provenance-nya
 *      gak ilang dan gampang dicari lagi kalau mau ekstrak ulang.
 *
 *   4. Buang soal yang catatannya bilang datanya emang gak bisa dipercaya:
 *        - kunci jawaban TEBAKAN (gak ada kunci resmi di sumber) → salah-ngajarin
 *        - bacaan hilang total gara-gara OCR → gak mungkin dijawab
 *
 *   5. Skip file 聴解 yang sisa soal kepakenya < MIN_SOAL_CHOUKAI — sesi isi 2
 *      soal bukan latihan, cuma bikin /materi kelihatan penuh padahal kosong.
 *
 * Idempoten: aman dijalanin ulang, nulis ulang dari `ekstrak/` tiap kali.
 *
 *   node scripts/rapikan-ekstrak.mjs            # dry-run, cuma laporan
 *   node scripts/rapikan-ekstrak.mjs --apply
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, basename } from "node:path";

const APPLY = process.argv.includes("--apply");
const SRC = "ekstrak";
const DEST = "materi/import";
const MIN_SOAL_CHOUKAI = 5;

/* Opsi dianggap "gak kepake" kalau cuma placeholder — semua varian yang ada di
 * hasil ekstraksi berbentuk array 1 elemen, jadi jumlah opsi udah cukup jadi
 * penanda. Ambang 3 (bukan 4) karena 即時応答 emang cuma 3 pilihan. */
const opsiNyata = q => Array.isArray(q.options) && q.options.length >= 3;

const BUANG = /TEBAKAN|OCR\s*で欠落/;
const REKONSTRUKSI = /REKONSTRUKSI|rekonstruksi/;

/* Catatan ekstraksi selalu nempel di ekor `question`, dipisah baris kosong dan
 * dibuka ※ atau ⚠️. Yang gak ikut pola itu (satu kasus: catatan inline dalam
 * kurung) kena BUANG duluan, jadi gak perlu ditangani di sini. */
function pisahCatatan(teks) {
  const t = String(teks ?? "");
  const i = t.search(/\n\s*\n\s*(※|⚠)/);
  return i === -1
    ? { question: t.trim(), catatan: null }
    : { question: t.slice(0, i).trim(), catatan: t.slice(i).trim() };
}

/* jlpt-n3-2020-12-chokai.json → { level:"N3", tahun:"2020", bulan:"12", chokai:true } */
function bedah(nama) {
  const m = basename(nama).match(/^jlpt-(n[1-5])-(\d{4})-(\d{2})(-chokai)?/i);
  if (!m) return null;
  return { level: m[1].toUpperCase(), tahun: m[2], bulan: m[3], chokai: Boolean(m[4]) };
}

const nomorMondai = teks => {
  const m = String(teks ?? "").match(/問題\s*(\d+)/);
  return m ? Number(m[1]) : null;
};

async function main() {
  const files = [];
  for (const d of await readdir(SRC, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith(".")) continue;
    for (const f of await readdir(join(SRC, d.name))) {
      if (f.toLowerCase().endsWith(".json") && !f.startsWith(".")) files.push(join(SRC, d.name, f));
    }
  }
  files.sort();

  const laporan = [];
  const stat = { masuk: 0, buangOpsi: 0, buangRagu: 0, rekon: 0, nimpa: 0, skipFile: 0 };

  for (const f of files) {
    const meta = bedah(f);
    if (!meta) { laporan.push([`⚠️  ${f}`, "nama file gak kebaca — dilewat"]); continue; }
    const raw = JSON.parse(await readFile(f, "utf8"));
    const { level, tahun, bulan, chokai } = meta;

    const asli = raw.questions ?? [];
    const keluar = [];
    let buangOpsi = 0, buangRagu = 0, rekon = 0;

    for (const q of asli) {
      if (chokai && !opsiNyata(q)) { buangOpsi++; continue; }
      if (BUANG.test(q.question ?? "")) { buangRagu++; continue; }

      const { question, catatan } = pisahCatatan(q.question);
      const bersih = { ...q, question, catatan };
      if (catatan && REKONSTRUKSI.test(catatan)) { bersih.rekonstruksi = true; rekon++; }
      if (chokai) Object.assign(bersih, { mondai: nomorMondai(question), audio: null, transcript: null, image: null });
      keluar.push(bersih);
    }

    const dir = chokai ? join(DEST, level, "CHOUKAI") : join(DEST, level, `${level}_JLPT_JSON`);
    const nama = chokai ? `${tahun}_${bulan}_聴解.json` : `${level}_${tahun}_${bulan}.json`;
    const tujuan = join(dir, nama);

    if (chokai && keluar.length < MIN_SOAL_CHOUKAI) {
      stat.skipFile++;
      laporan.push([`⏭️  ${tujuan}`, `dilewat — cuma ${keluar.length} soal kepake dari ${asli.length} (ekstraksi gagal)`]);
      continue;
    }

    const note = [
      raw.note,
      rekon > 0 && `⚠️ ${rekon} soal di file ini isinya REKONSTRUKSI (bukan teks ujian asli) — lihat field "catatan" per soal.`,
      buangRagu > 0 && `${buangRagu} soal dibuang waktu perapian: kunci jawaban gak resmi / bacaan hilang di sumber.`,
      chokai && buangOpsi > 0 && `${buangOpsi} soal 問題3/4/5 dibuang: opsinya cuma lewat audio dan audio N1/N3 belum ada.`,
    ].filter(Boolean).join(" ");

    const hasil = { ...raw, ...(chokai && { section: "choukai" }), ...(note && { note }), questions: keluar };

    const nimpa = existsSync(tujuan);
    if (nimpa) stat.nimpa++;
    stat.masuk += keluar.length; stat.buangOpsi += buangOpsi; stat.buangRagu += buangRagu; stat.rekon += rekon;

    const catatanBuang = [
      buangOpsi && `-${buangOpsi} opsi-audio`,
      buangRagu && `-${buangRagu} diragukan`,
      rekon && `${rekon} rekonstruksi`,
    ].filter(Boolean).join(", ");
    laporan.push([`${nimpa ? "♻️ " : "➕"} ${tujuan}`, `${keluar.length} soal${catatanBuang ? ` (${catatanBuang})` : ""}`]);

    if (APPLY) {
      await mkdir(dir, { recursive: true });
      await writeFile(tujuan, JSON.stringify(hasil, null, 2) + "\n", "utf8");
    }
  }

  for (const [a, b] of laporan) console.log(`${a.padEnd(56)} ${b ?? ""}`);
  console.log(
    `\n${APPLY ? "" : "[DRY-RUN] "}file: ${files.length} · ditulis: ${files.length - stat.skipFile} (nimpa ${stat.nimpa}, skip ${stat.skipFile})\n` +
    `soal masuk: ${stat.masuk} · buang opsi-audio: ${stat.buangOpsi} · buang diragukan: ${stat.buangRagu} · ditandai rekonstruksi: ${stat.rekon}`
  );
  if (!APPLY) console.log("Jalanin lagi dengan --apply buat beneran nulis.");
}

main().catch(e => { console.error(e); process.exit(1); });
