#!/usr/bin/env node
/**
 * Benerin soal 文字 yang punya pengecoh kembar.
 *
 * Contoh rusak:  「共通」の読み方は？ → きょうつう / こうつう / きょうつう / こうつう
 * Opsi 3 & 4 cuma ngulang 1 & 2, jadi user cuma milih dari 2 pilihan.
 *
 * Pengecoh pengganti dipilih mengikuti gaya distraktor JLPT asli: kanji yang
 * beda satu radikal (暮/募/慕/墓), atau bacaan yang beda panjang vokal
 * (きょうつう/こうつう/きょうづう/こうづう). Jawaban benar TIDAK pernah dipindah
 * atau diubah — cuma slot yang kembar yang diganti.
 *
 * Cara pakai:
 *   node scripts/fix-opsi-duplikat.mjs            # dry-run
 *   node scripts/fix-opsi-duplikat.mjs --apply
 *
 * Dicocokin lewat isi array opsi, bukan nomor baris — jadi soal yang sama di
 * file individual maupun di N3_ALL_combined.json kena dua-duanya sekaligus.
 */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, extname } from "node:path";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const dirIdx = args.indexOf("--dir");
const ROOT = dirIdx !== -1 ? args[dirIdx + 1] : "materi/import";

/** [opsi lama] → [opsi baru]. Kunci jawaban tetap di posisi semula. */
const PERBAIKAN = [
  { // れいぎ → 礼儀 ／ pola 礼・札 × 儀・義
    dari: ["1. 札義", "2. 礼儀", "3. 礼義", "4. 礼儀"],
    jadi: ["1. 札義", "2. 礼儀", "3. 礼義", "4. 札儀"],
  },
  { // くらして → 暮らして ／ pola 莫: 暮・募・慕・墓
    dari: ["1. 暮らして", "2. 募らして", "3. 暮らして", "4. 墓らして"],
    jadi: ["1. 暮らして", "2. 募らして", "3. 慕らして", "4. 墓らして"],
  },
  { // とうろん → 討論 ／ pola 討・投 × 論・輪
    dari: ["1. 討論", "2. 討論", "3. 投論", "4. 投論"],
    jadi: ["1. 討論", "2. 討輪", "3. 投論", "4. 投輪"],
  },
  { // そんしつ → 損失 ／ pengecoh berimbuhan 失
    dari: ["1. 消失", "2. 限失", "3. 消失", "4. 損失"],
    jadi: ["1. 消失", "2. 限失", "3. 慎失", "4. 損失"],
  },
  { // げんざい → 現在 ／ pola 現・視 × 在・存
    dari: ["1. 視在", "2. 現存", "3. 現在", "4. 視在"],
    jadi: ["1. 視在", "2. 現存", "3. 現在", "4. 視存"],
  },
  { // あたためました → 温めました ／ 暖める pengecoh kuat (sama-sama 'menghangatkan')
    dari: ["1. 温めました", "2. 湯めました", "3. 熱めました", "4. 熱めました"],
    jadi: ["1. 温めました", "2. 湯めました", "3. 熱めました", "4. 暖めました"],
  },
  { // 共通 → きょうつう ／ pola きょう・こう × つう・づう
    dari: ["1. きょうつう", "2. こうつう", "3. きょうつう", "4. こうつう"],
    jadi: ["1. きょうつう", "2. こうつう", "3. きょうづう", "4. こうづう"],
  },
  { // ゆしゅつ → 輸出 ／ 輪 mirip 輸
    dari: ["1. 輸出", "2. 諭出", "3. 輸出", "4. 論出"],
    jadi: ["1. 輪出", "2. 諭出", "3. 輸出", "4. 論出"],
  },
  { // ねむって → 眠って ／ 眼 mirip 眠
    dari: ["1. 寝って", "2. 宿って", "3. 眠って", "4. 眠って"],
    jadi: ["1. 寝って", "2. 宿って", "3. 眼って", "4. 眠って"],
  },
  { // ちがいます → 違います ／ semua ber-radikal 辶
    dari: ["1. 遣います", "2. 違います", "3. 遅います", "4. 違います"],
    jadi: ["1. 遣います", "2. 違います", "3. 遅います", "4. 遠います"],
  },
  { // 未来 → みらい ／ 未 punya on-yomi ミ dan ビ
    dari: ["1. しょらい", "2. しょうらい", "3. みらい", "4. みらい"],
    jadi: ["1. しょらい", "2. しょうらい", "3. みらい", "4. びらい"],
  },
  { // いっぱんてき → 一般的 ／ pola 般・股・船・搬
    dari: ["1. 一般的", "2. 一股的", "3. 一般的", "4. 一股的"],
    jadi: ["1. 一船的", "2. 一股的", "3. 一般的", "4. 一搬的"],
  },
  { // かいが → 絵画 ／ 図画(ずが) pengecoh kuat karena kata beneran
    dari: ["1. 絵面", "2. 図面", "3. 絵画", "4. 図面"],
    jadi: ["1. 絵面", "2. 図面", "3. 絵画", "4. 図画"],
  },
];

const kunci = a => JSON.stringify(a);
const TABEL = new Map(PERBAIKAN.map(p => [kunci(p.dari), p.jadi]));

/** Isi opsi tanpa nomor depan — "2. 礼儀" dan "4. 礼儀" itu opsi kembar,
 *  jadi pembandingan apa pun harus pakai ini, bukan string mentahnya. */
const badan = s => String(s).replace(/^[1-4][．.、:：)）\s]*/u, "").trim();

/* Pengaman: tiap entri wajib bikin 4 opsi unik, dan tiap slot yang diubah
   gak boleh slot jawaban benar mana pun. Kalau tabelnya salah ketik, ketahuan
   di sini — bukan pas user ngerjain soal. */
function periksaTabel() {
  const salah = [];
  for (const { dari, jadi } of PERBAIKAN) {
    const d = dari.map(badan), j = jadi.map(badan);
    if (dari.length !== 4 || jadi.length !== 4) salah.push(`panjang != 4: ${dari[0]}`);
    if (new Set(j).size !== 4) salah.push(`hasil masih duplikat: ${j.join(" / ")}`);
    // Opsi yang di versi lama cuma muncul sekali gak boleh ikut kebuang —
    // salah satunya pasti jawaban benar. Yang boleh diganti cuma slot kembar.
    for (const t of d) {
      if (d.filter(x => x === t).length === 1 && !j.includes(t)) {
        salah.push(`opsi unik hilang: ${t}`);
      }
    }
  }
  return salah;
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
  const salahTabel = periksaTabel();
  if (salahTabel.length) {
    console.error("❌ Tabel perbaikan gak lolos pemeriksaan:");
    salahTabel.forEach(s => console.error("   " + s));
    process.exit(1);
  }

  const files = await walkJsons(ROOT);
  let diperbaiki = 0, fileDiubah = 0;

  for (const f of files) {
    let data;
    try { data = JSON.parse(await readFile(f, "utf8")); } catch { continue; }
    if (!Array.isArray(data.questions)) continue;

    let ubah = 0;
    for (const q of data.questions) {
      const baru = TABEL.get(kunci(q.options ?? []));
      if (!baru) continue;

      // jawaban benar harus nunjuk teks yang sama sebelum & sesudah
      const idx = parseInt(q.correct, 10) - 1;
      if (!(idx >= 0 && idx < 4) || q.options[idx] !== baru[idx]) {
        console.warn(`⚠️  ${f} — kunci jawaban bergeser, dilewati: ${q.question?.slice(0, 30)}`);
        continue;
      }

      q.options = [...baru];
      ubah++;
    }

    if (ubah > 0) {
      diperbaiki += ubah;
      fileDiubah++;
      console.log(`  ${String(ubah).padStart(2)}x  ${f.replace(ROOT + "/", "")}`);
      if (APPLY) await writeFile(f, JSON.stringify(data, null, 2) + "\n", "utf8");
    }
  }

  console.log(`\n${APPLY ? "DITULIS" : "DRY-RUN (pakai --apply buat nulis)"}`);
  console.log(`Entri di tabel   : ${PERBAIKAN.length}`);
  console.log(`Soal diperbaiki  : ${diperbaiki} (di ${fileDiubah} file)`);
}

main().catch(e => { console.error(e); process.exit(1); });
