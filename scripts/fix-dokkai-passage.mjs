#!/usr/bin/env node
/**
 * Pulihin bacaan 読解 yang "hilang" di JSON bank soal.
 *
 * Bukan hilang beneran: di JLPT satu bacaan dipakai 2–4 soal, dan generator
 * cuma nempelin `passage` di soal PERTAMA tiap kelompok. Soal ke-2 dst.
 * passage-nya null, jadi kebaca kayak soal rusak padahal cuma perlu diwarisin.
 *
 * Cara pakai:
 *   node scripts/fix-dokkai-passage.mjs              # dry-run, cuma laporan
 *   node scripts/fix-dokkai-passage.mjs --apply      # tulis ke file
 *   node scripts/fix-dokkai-passage.mjs --apply --dir materi/import
 *
 * Backup dulu sebelum --apply — folder materi/ gak dilacak git.
 */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, extname } from "node:path";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const VERBOSE = args.includes("--verbose");
const dirIdx = args.indexOf("--dir");
const ROOT = dirIdx !== -1 ? args[dirIdx + 1] : "materi/import";

/** Kelompok 読解 terpanjang di JLPT itu クローズ (1 bacaan, 5 rumpang).
 *  Lebih dari ini hampir pasti kelompok baru yang bacaannya emang gak kerekam. */
const MAX_ANAK = 5;

/** Token khas buat ngecek soal beneran ngomongin bacaan induknya: rentetan
 *  kanji (≥2) atau katakana (≥2). Partikel & hiragana umum sengaja diabaikan
 *  karena muncul di mana-mana dan bikin semua soal kelihatan "nyambung". */
function tokens(s) {
  return new Set(String(s ?? "").match(/[一-龯]{2,}|[ァ-ヶー]{2,}/g) ?? []);
}

/** Istilah yang dikutip di pertanyaan — 「貸し傘」「いいところ探し」. Campuran
 *  kanji-hiragana kayak gini gak pernah kebentuk jadi token (gak ada rentetan
 *  kanji ≥2), padahal justru ini rujukan paling kuat ke bacaannya. */
function kutipan(s) {
  return [...String(s ?? "").matchAll(/[「『]([^」』]{2,20})[」』]/g)].map(m => m[1]);
}

/** Soal yang secara bentuk JELAS nunjuk ke bacaan induknya, walau gak sekata pun
 *  sama isi bacaannya. Ini yang bikin cocok-kata doang gak cukup:
 *
 *    ①これまではそうでなかったとは、どういう意味か   → nunjuk penanda ① di bacaan
 *    この文章で筆者が言いたいことは何か              → soal penutup kelompok
 *    （51）に入る最もよい言葉は？                    → rumpang クローズ di bacaan
 *    AとBで共通して述べられていることは何か          → soal 統合理解 A/B
 *
 *  Kosakatanya kosakata ujian (文章・筆者・意味), bukan kosakata bacaannya —
 *  makanya gak pernah ketemu waktu dicocokin kata. */
const RUJUK_BACAAN = new RegExp([
  "[①-⑩]", "傍線", "下線", "とあるが", "この文章", "本文", "筆者", "作者",
  "ここでいう", "どういう意味", "何を指し", "[AＡ]と[BＢ]",
  "この(メール|お知らせ|文書|グラフ|表|案内)",
  "[（(]\\s*\\d+\\s*[）)]\\s*に入る", "に入る(最もよい|文として)",
].join("|"));

function isDokkai(q) {
  return typeof q?.category === "string" && q.category.includes("読解");
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

/** Jalanin satu file. Balik statistik + daftar soal yang gak bisa dipulihin. */
function repairFile(questions) {
  const stat = { diwarisin: 0, ragu: 0, yatim: 0 };
  const sisa = [];

  let induk = null;   // bacaan kelompok yang lagi jalan
  let anak = 0;       // soal ke-berapa dalam kelompok ini

  for (const q of questions) {
    if (!isDokkai(q)) { induk = null; anak = 0; continue; }

    if (q.passage) { induk = q.passage; anak = 0; continue; }

    if (!induk) {
      stat.yatim++;
      sisa.push({ alasan: "yatim", question: q.question });
      continue;
    }

    anak++;
    if (anak > MAX_ANAK) {
      stat.ragu++;
      sisa.push({ alasan: `grup >${MAX_ANAK}`, question: q.question });
      continue;
    }

    // Empat jalur penerimaan: soal pakai kata dari bacaannya, soal ngutip
    // istilah yang ada di bacaannya, soal gak punya token sama sekali (ciri
    // soal penutup kelompok), atau soal berbentuk rujukan (傍線・クローズ・AとB).
    const t = tokens(q.question);
    const nyambung = t.size === 0
      || [...t].some(x => tokens(induk).has(x))
      || kutipan(q.question).some(k => induk.includes(k))
      || RUJUK_BACAAN.test(q.question ?? "");
    if (!nyambung) {
      stat.ragu++;
      sisa.push({ alasan: "gak nyambung", question: q.question });
      continue;
    }

    q.passage = induk;
    stat.diwarisin++;
  }

  return { stat, sisa };
}

async function main() {
  const files = await walkJsons(ROOT);
  const total = { diwarisin: 0, ragu: 0, yatim: 0 };
  const semuaSisa = [];
  let fileDiubah = 0;

  for (const f of files) {
    let data;
    try {
      data = JSON.parse(await readFile(f, "utf8"));
    } catch {
      console.warn(`⚠️  ${f} — JSON rusak, dilewati`);
      continue;
    }
    if (!Array.isArray(data.questions)) continue;

    const { stat, sisa } = repairFile(data.questions);
    for (const k of Object.keys(total)) total[k] += stat[k];
    semuaSisa.push(...sisa.map(s => ({ ...s, file: f })));

    if (stat.diwarisin > 0) {
      fileDiubah++;
      if (VERBOSE) console.log(`  ${stat.diwarisin.toString().padStart(3)}x  ${f}`);
      if (APPLY) await writeFile(f, JSON.stringify(data, null, 2) + "\n", "utf8");
    }
  }

  console.log(`\n${APPLY ? "DITULIS" : "DRY-RUN (pakai --apply buat nulis)"}`);
  console.log(`File diperiksa   : ${files.length}`);
  console.log(`File berubah     : ${fileDiubah}`);
  console.log(`Bacaan diwarisin : ${total.diwarisin}`);
  console.log(`Ragu (dilewati)  : ${total.ragu}`);
  console.log(`Yatim (dilewati) : ${total.yatim}`);

  if (semuaSisa.length && VERBOSE) {
    console.log(`\nYang gak dipulihin:`);
    for (const s of semuaSisa) {
      console.log(`  [${s.alasan}] ${s.file.replace(ROOT + "/", "")} — ${(s.question ?? "").slice(0, 44)}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
