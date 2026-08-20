#!/usr/bin/env node
/**
 * Build deck Kotoba multi-level buat halaman /materi/kotoba.
 *
 * Sumber:
 *   - kotoba-generator/output/kotoba-{N5..N1}.json  (hasil generate Haiku)
 *   - src/data/kotoba-n2.json                        (deck Nihongo no Mori, 585 kata)
 *
 * Aturan:
 *   - N1/N3/N4/N5  : full dari generate, dikelompokin per baris gojūon (あ行, か行…).
 *   - N2           : deck Nihongo no Mori (unit aslinya) jadi BASIS, lalu ditambah
 *                    kata inti dari N2 generate yang belum ada (dedup by `word`),
 *                    kata tambahan itu dikelompokin per baris gojūon juga.
 *
 * Output:
 *   - src/data/kotoba/{N5..N1}.json  { level, title, source, count, groupOrder, vocabulary }
 *   - src/data/kotoba/index.json     { levels: [{ level, count, title, source }] }
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const GEN = join(ROOT, "kotoba-generator", "output");
const OUT_DIR = join(ROOT, "src", "data", "kotoba");

const LEVELS = ["N5", "N4", "N3", "N2", "N1"];

/* ── Baris gojūon ─────────────────────────────────────────────── */
const ROW_ORDER = ["あ行", "か行", "さ行", "た行", "な行", "は行", "ま行", "や行", "ら行", "わ行", "その他"];
const ROW_OF = {
  あ: "あ行", い: "あ行", う: "あ行", え: "あ行", お: "あ行",
  か: "か行", き: "か行", く: "か行", け: "か行", こ: "か行", が: "か行", ぎ: "か行", ぐ: "か行", げ: "か行", ご: "か行",
  さ: "さ行", し: "さ行", す: "さ行", せ: "さ行", そ: "さ行", ざ: "さ行", じ: "さ行", ず: "さ行", ぜ: "さ行", ぞ: "さ行",
  た: "た行", ち: "た行", つ: "た行", て: "た行", と: "た行", だ: "た行", ぢ: "た行", づ: "た行", で: "た行", ど: "た行", っ: "た行",
  な: "な行", に: "な行", ぬ: "な行", ね: "な行", の: "な行",
  は: "は行", ひ: "は行", ふ: "は行", へ: "は行", ほ: "は行", ば: "は行", び: "は行", ぶ: "は行", べ: "は行", ぼ: "は行", ぱ: "は行", ぴ: "は行", ぷ: "は行", ぺ: "は行", ぽ: "は行",
  ま: "ま行", み: "ま行", む: "ま行", め: "ま行", も: "ま行",
  や: "や行", ゆ: "や行", よ: "や行", ゃ: "や行", ゅ: "や行", ょ: "や行",
  ら: "ら行", り: "ら行", る: "ら行", れ: "ら行", ろ: "ら行",
  わ: "わ行", を: "わ行", ん: "わ行", ゐ: "わ行", ゑ: "わ行",
};
function kataToHira(ch) {
  const c = ch.charCodeAt(0);
  return c >= 0x30a1 && c <= 0x30f6 ? String.fromCharCode(c - 0x60) : ch;
}
function rowOf(reading) {
  if (!reading) return "その他";
  const first = kataToHira([...reading][0]);
  return ROW_OF[first] || "その他";
}

/* ── Jenis kata (POS) → label filter ──────────────────────────── */
const POS_MAP = {
  noun: "名詞", verb: "動詞",
  "i-adjective": "形容詞", "na-adjective": "形容詞",
  adverb: "副詞", conjunction: "接続詞",
};
function posLabel(raw) {
  return POS_MAP[raw] || "その他";
}

const NON_N2 = /\bN[1345]\b/; // grup yang sebenernya bukan N2 di file NnM

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

/* Ubah 1 kata hasil generate → bentuk terpadu halaman. */
function fromGenerated(w, level) {
  return {
    word: w.word,
    reading: w.reading || "",
    meaning: w.meaning_id || "",
    group: rowOf(w.reading),
    example: w.example || "",
    example_id: w.example_id || "",
    pos: posLabel(w.part_of_speech),
    jlpt_level: level,
    note: "",
  };
}

/* Urutan grup: NnM unit (urut kemunculan) dulu, baru baris gojūon. */
function buildGroupOrder(vocab, unitFirst) {
  const seenUnits = [];
  if (unitFirst) {
    for (const w of vocab) {
      if (!ROW_ORDER.includes(w.group) && !seenUnits.includes(w.group)) seenUnits.push(w.group);
    }
  }
  const rows = ROW_ORDER.filter((r) => vocab.some((w) => w.group === r));
  return [...seenUnits, ...rows];
}

/* Urutin vocab: per grup (sesuai groupOrder), di dalam grup by reading. */
function sortVocab(vocab, groupOrder) {
  const idx = new Map(groupOrder.map((g, i) => [g, i]));
  return vocab.slice().sort((a, b) => {
    const ga = idx.get(a.group) ?? 999, gb = idx.get(b.group) ?? 999;
    if (ga !== gb) return ga - gb;
    return (a.reading || "").localeCompare(b.reading || "", "ja");
  });
}

mkdirSync(OUT_DIR, { recursive: true });
const indexLevels = [];

for (const level of LEVELS) {
  const gen = readJson(join(GEN, `kotoba-${level}.json`)).words;
  let vocab, source, title;

  if (level === "N2") {
    // Basis = Nihongo no Mori (buang grup ber-tag N1345), pertahankan unit aslinya.
    const nnm = readJson(join(ROOT, "src", "data", "kotoba-n2.json")).vocabulary
      .filter((w) => w.word && !NON_N2.test(w.group || ""));
    const baseWords = new Set(nnm.map((w) => w.word));
    // Tambahan = N2 generate yang katanya belum ada di basis (dedup by word).
    const extra = gen.filter((w) => !baseWords.has(w.word)).map((w) => fromGenerated(w, "N2"));
    vocab = [...nnm.map((w) => ({ ...w, jlpt_level: w.jlpt_level || "N2" })), ...extra];
    source = "Nihongo no Mori + kosakata inti N2";
    title = `JLPT N2 — Kotoba (${vocab.length} kata)`;
    console.log(`  N2: basis NnM ${nnm.length} + tambahan ${extra.length} = ${vocab.length}`);
  } else {
    vocab = gen.map((w) => fromGenerated(w, level));
    source = `Kosakata inti JLPT ${level}`;
    title = `JLPT ${level} — Kotoba (${vocab.length} kata)`;
  }

  const groupOrder = buildGroupOrder(vocab, level === "N2");
  vocab = sortVocab(vocab, groupOrder);

  const payload = { level, title, source, count: vocab.length, groupOrder, vocabulary: vocab };
  writeFileSync(join(OUT_DIR, `${level}.json`), JSON.stringify(payload));
  indexLevels.push({ level, count: vocab.length, title, source });
  console.log(`✅ ${level}: ${vocab.length} kata, ${groupOrder.length} grup → src/data/kotoba/${level}.json`);
}

// index urut N5→N1 (buat badge selector tanpa import semua data)
writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify({ levels: indexLevels }, null, 2));
console.log(`\n📦 index.json: ${indexLevels.map((l) => `${l.level}(${l.count})`).join(" · ")}`);
