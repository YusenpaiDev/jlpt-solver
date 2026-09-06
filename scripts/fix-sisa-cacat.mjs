#!/usr/bin/env node
/**
 * Beresin sisa cacat di bank soal N1/N3 hasil ekstraksi — yang gak ketangkep
 * fix-dokkai-passage / fix-opsi-duplikat karena polanya beda.
 *
 * Tiga jenis:
 *
 *   1. BUANG soal yang datanya emang gak ada di sumber:
 *        - opsi placeholder ("[belum ada di sumber]", "OCR terpotong")
 *        - kunci jawaban "?" — gak ada kunci resmi, nebak = ngajarin yang salah
 *        - pertanyaan "[BELUM LENGKAP ...]"
 *
 *   2. GANTI pengecoh kembar. Sama kayak fix-opsi-duplikat, tapi tabelnya
 *      dicocokin ke soal-soal baru. Prinsipnya sama persis: jawaban benar
 *      GAK PERNAH dipindah/diubah, cuma slot kembar yang diganti, dan
 *      penggantinya ngikutin gaya distraktor JLPT asli —
 *        表記  : kanji tukar satu komponen (薬局/楽曲/楽局/薬曲)
 *        語彙  : kata yang pas secara tata bahasa tapi jelas salah maknanya
 *
 *   3. WARIS bacaan 読解 yang dilewat fix-dokkai-passage karena dianggap "ragu"
 *      (istilah dalam 「」 gak ketemu di bacaan induk). Diperiksa manual dulu:
 *      soalnya kejepit di antara dua soal yang bacaannya sama.
 *
 *   node scripts/fix-sisa-cacat.mjs            # dry-run
 *   node scripts/fix-sisa-cacat.mjs --apply
 */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const APPLY = process.argv.includes("--apply");
const R = "materi/import";

const PLACEHOLDER_OPSI = /belum ada di sumber|tidak terbaca lengkap|OCR terpotong/i;
const PLACEHOLDER_SOAL = /^\[BELUM LENGKAP/;

/** Pengecoh pengganti, dikunci ke teks soal biar gak salah sasaran.
 *  slot = indeks opsi (0-based) yang kembar dan mau diganti. */
const GANTI = [
  { file: `${R}/N3/N3_JLPT_JSON/N3_2015_12.json`, soal: "家族の幸せを【ねがって】いる。",
    patch: { 1: "2. 順って" } },                       // 願/頼/頻/順 — sama-sama radikal 頁
  { file: `${R}/N3/N3_JLPT_JSON/N3_2015_12.json`, soal: "次の試合で（　　）相手は、去年の優勝者だ。",
    patch: { 2: "3. 投げる" } },                       // kata kerja yang jelas salah konteks
  { file: `${R}/N3/N3_JLPT_JSON/N3_2019_07.json`, soal: "新しい【かぐ】を買いました。",
    patch: { 2: "3. 家貝", 3: "4. 宗具" } },           // tukar satu kanji dari 家具
  { file: `${R}/N3/N3_JLPT_JSON/N3_2020_12.json`, soal: "たくさん買い物したので、買った商品を家まで（　　）してもらった。",
    patch: { 3: "4. 返品" } },                         // se-medan makna, tapi bukan "diantar"
  { file: `${R}/N3/N3_JLPT_JSON/N3_2021_07.json`, soal: "【やっきょく】がなかなか見つかりません。",
    patch: { 3: "4. 薬曲" } },                         // lengkapin kisi 薬/楽 × 局/曲
];

/** Bacaan yang diwarisin manual: soal ke-`idx` ambil passage dari soal ke-`dari`. */
const WARIS = [
  { file: `${R}/N1/N1_JLPT_JSON/N1_2024_07.json`, idx: 62, dari: 61 },
];

const kunciValid = q => {
  const k = parseInt(q.correct, 10);
  return k >= 1 && k <= (q.options?.length ?? 0);
};

const layakBuang = q =>
  PLACEHOLDER_SOAL.test(q.question ?? "") ||
  !kunciValid(q) ||
  (q.options ?? []).some(o => PLACEHOLDER_OPSI.test(String(o)));

async function main() {
  const sentuh = new Map();          // file → objek JSON (dibaca sekali, ditulis sekali)
  const baca = async f => {
    if (!sentuh.has(f)) sentuh.set(f, JSON.parse(await readFile(f, "utf8")));
    return sentuh.get(f);
  };

  /* 1 — buang */
  let dibuang = 0;
  async function walk(d) {
    const out = [];
    for (const e of await readdir(d, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) out.push(...await walk(p));
      else if (e.name.endsWith(".json")) out.push(p);
    }
    return out;
  }
  for (const f of [...await walk(`${R}/N1`), ...await walk(`${R}/N3`)]) {
    const j = await baca(f);
    const sebelum = j.questions?.length ?? 0;
    const sisa = (j.questions ?? []).filter(q => !layakBuang(q));
    if (sisa.length !== sebelum) {
      for (const q of (j.questions ?? []).filter(layakBuang)) {
        console.log(`  🗑️  ${f.replace(R + "/", "")} — ${String(q.question).slice(0, 58)}`);
      }
      dibuang += sebelum - sisa.length;
      j.questions = sisa;
    }
  }

  /* 2 — ganti pengecoh kembar */
  let diganti = 0;
  for (const g of GANTI) {
    const j = await baca(g.file);
    const q = (j.questions ?? []).find(x => x.question === g.soal);
    if (!q) { console.log(`  ⚠️  gak ketemu: ${g.soal.slice(0, 40)}`); continue; }
    const lama = [...q.options];
    for (const [slot, teks] of Object.entries(g.patch)) q.options[+slot] = teks;
    diganti++;
    console.log(`  🔧 ${g.file.replace(R + "/", "")} — ${g.soal.slice(0, 34)}`);
    console.log(`       ${lama.join(" / ")}`);
    console.log(`     → ${q.options.join(" / ")}`);
  }

  /* 3 — waris bacaan */
  let diwarisin = 0;
  for (const w of WARIS) {
    const j = await baca(w.file);
    const src = j.questions[w.dari], dst = j.questions[w.idx];
    if (!src?.passage || dst?.passage) { console.log(`  ⚠️  waris dilewat: ${w.file} #${w.idx}`); continue; }
    dst.passage = src.passage;
    diwarisin++;
    console.log(`  📖 ${w.file.replace(R + "/", "")} #${w.idx} ← bacaan soal #${w.dari} (${src.passage.length} huruf)`);
  }

  if (APPLY) for (const [f, j] of sentuh) await writeFile(f, JSON.stringify(j, null, 2) + "\n", "utf8");

  console.log(`\n${APPLY ? "" : "[DRY-RUN] "}dibuang: ${dibuang} soal · pengecoh diganti: ${diganti} soal · bacaan diwarisin: ${diwarisin}`);
  if (!APPLY) console.log("Jalanin lagi dengan --apply buat beneran nulis.");
}

main().catch(e => { console.error(e); process.exit(1); });
