#!/usr/bin/env node
/**
 * Enrich pola bunpou (dari materi/import-bunpou/{level}-bunpou.json) dengan field
 * yang dibutuhin halaman Bunpou v3:
 *   functionGroup, confusableWith (simetris), discriminator, quickTip
 * + turunan lokal (tanpa API): setsuzoku[], nuance, examples[{jp,highlight,id}]
 *
 * Output: src/data/bunpou/{level}.json  (di-bundle ke app, bukan DB)
 *
 *   node scripts/enrich-bunpou.mjs N2
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LEVEL = (process.argv[2] || "N2").toUpperCase();
const SRC = join(ROOT, "materi", "import-bunpou", `${LEVEL.toLowerCase()}-bunpou.json`);
const OUT_DIR = join(ROOT, "src", "data", "bunpou");
const MODEL = "claude-haiku-4-5";
const BATCH = 25;

function loadEnv() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const GROUPS = [
  { key: "kekka",     name: "Hasil & akibat",            jp: "結果" },
  { key: "gyakusetsu",name: "Pertentangan & kontras",    jp: "逆接" },
  { key: "jikan",     name: "Waktu & urutan",            jp: "時間" },
  { key: "gen_in",    name: "Sebab & alasan",            jp: "原因" },
  { key: "gimu",      name: "Keharusan & larangan",      jp: "義務" },
  { key: "suiryou",   name: "Perkiraan & kemungkinan",   jp: "推量" },
  { key: "han_i",     name: "Batas & cakupan",           jp: "範囲" },
  { key: "hyougen",   name: "Ungkapan & penekanan",      jp: "表現" },
  { key: "lainnya",   name: "Lainnya",                   jp: "その他" },
];
const GROUP_KEYS = GROUPS.map(g => g.key);

/* connects_to "動詞た形 / 名詞＋の (Verb…)" → ["動詞た形","名詞＋の"] (buang terjemahan dalam kurung) */
function toSetsuzoku(connects_to) {
  if (!connects_to) return [];
  const noParen = String(connects_to).replace(/[（(][^）)]*[）)]/g, "").trim();
  return noParen.split(/\s*[\/、]\s*/).map(s => s.trim()).filter(Boolean).slice(0, 3);
}
/* highlight = potongan pola (tanpa 〜) yang muncul di contoh */
function makeExample(jp, id, pattern) {
  if (!jp) return null;
  const core = String(pattern).replace(/[〜~]/g, "").trim();
  let highlight = "";
  if (core && jp.includes(core)) highlight = core;
  else { const m = core.match(/[ぁ-んァ-ン一-龯]+/); if (m && jp.includes(m[0])) highlight = m[0]; }
  return { jp, highlight, id: id || "" };
}

const SYSTEM = `Kamu ahli tata bahasa Jepang (JLPT) + pengajar untuk pelajar Indonesia.
Tugas: klasifikasi tiap pola grammar ke KELOMPOK FUNGSI, tulis PEMBEDA singkat, dan tandai pola yang GAMPANG KETUKER.
Bahasa penjelasan: Indonesia casual. Istilah grammar tetap Jepang.
Balas HANYA JSON array valid, tanpa markdown.`;

function buildPrompt(refList, batch) {
  const groupDesc = GROUPS.map(g => `  "${g.key}" = ${g.name} (${g.jp})`).join("\n");
  const ref = refList.map(r => `${r.id}\t${r.pattern}\t${r.meaning}`).join("\n");
  const items = batch.map(r => `${r.id}\t${r.pattern}\t${r.meaning}`).join("\n");
  return `KELOMPOK FUNGSI (pilih SATU key per pola):
${groupDesc}

DAFTAR SEMUA POLA (id \\t pola \\t arti) — pakai id ini buat confusableWith:
${ref}

Enrich pola berikut. Untuk TIAP pola balas objek:
{
  "id": "<id>",
  "functionGroup": "<salah satu key di atas>",
  "discriminator": "<1 kalimat singkat: apa yang bikin pola ini beda dari yang mirip, mis. 'Hasil negatif — pasti buruk/kecewa'>",
  "quickTip": "<trik cepat milih pola ini, mis. 'kalau berakhir buruk → あげく'>",
  "confusableWith": ["<id pola lain yang FUNGSINYA sama & gampang ketuker>", ...]
}

Aturan confusableWith: HANYA id dari daftar di atas, HANYA yang beneran mirip fungsi/makna (biasanya 1-3, boleh kosong []). Jangan masukin id-nya sendiri.

POLA YANG DIENRICH:
${items}

Balas JSON array [...] aja.`;
}

function extractJson(txt) {
  const m = txt.match(/\[[\s\S]*\]/);
  if (!m) throw new Error("no JSON array");
  return JSON.parse(m[0]);
}

async function callHaiku(refList, batch) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await client.messages.create({
        model: MODEL, max_tokens: 4000, system: SYSTEM,
        messages: [{ role: "user", content: buildPrompt(refList, batch) }],
      });
      const txt = res.content.filter(c => c.type === "text").map(c => c.text).join("");
      return extractJson(txt);
    } catch (e) {
      console.warn(`  batch retry ${attempt}: ${e.message}`);
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
}

async function main() {
  if (!existsSync(SRC)) { console.error("❌ sumber ga ada:", SRC); process.exit(1); }
  const raw = JSON.parse(readFileSync(SRC, "utf8"));
  const src = (raw.patterns || []).filter(p => p.pattern && p.meaning);
  // id stabil
  const pats = src.map((p, i) => ({ ...p, id: `${LEVEL.toLowerCase()}-${String(i + 1).padStart(3, "0")}` }));
  const refList = pats.map(p => ({ id: p.id, pattern: p.pattern, meaning: p.meaning }));
  const byId = new Map(pats.map(p => [p.id, p]));

  console.log(`\n▶️  Enrich ${LEVEL}: ${pats.length} pola (batch ${BATCH})`);
  const enriched = new Map();
  for (let i = 0; i < pats.length; i += BATCH) {
    const batch = refList.slice(i, i + BATCH);
    const arr = await callHaiku(refList, batch);
    for (const o of arr) {
      if (!byId.has(o.id)) continue;
      const fg = GROUP_KEYS.includes(o.functionGroup) ? o.functionGroup : "lainnya";
      const cw = Array.isArray(o.confusableWith) ? o.confusableWith.filter(x => byId.has(x) && x !== o.id) : [];
      enriched.set(o.id, { functionGroup: fg, discriminator: (o.discriminator || "").trim(), quickTip: (o.quickTip || "").trim(), confusableWith: cw });
    }
    console.log(`  ${Math.min(i + BATCH, pats.length)}/${pats.length}`);
  }

  // simetri confusableWith
  for (const [id, e] of enriched) {
    for (const other of e.confusableWith) {
      const oe = enriched.get(other);
      if (oe && !oe.confusableWith.includes(id)) oe.confusableWith.push(id);
    }
  }

  // rakit output
  const patterns = pats.map(p => {
    const e = enriched.get(p.id) || { functionGroup: "lainnya", discriminator: "", quickTip: "", confusableWith: [] };
    const ex = makeExample(p.example_jp, p.example_id, p.pattern);
    return {
      id: p.id, pattern: p.pattern, meaning: p.meaning, level: p.level || LEVEL,
      functionGroup: e.functionGroup,
      setsuzoku: toSetsuzoku(p.connects_to),
      nuance: p.notes || "",
      examples: ex ? [ex] : [],
      confusableWith: e.confusableWith,
      discriminator: e.discriminator,
      quickTip: e.quickTip,
    };
  });

  // urutan grup: sesuai GROUPS, cuma yang kepakai
  const used = new Set(patterns.map(p => p.functionGroup));
  const groups = GROUPS.filter(g => used.has(g.key));

  mkdirSync(OUT_DIR, { recursive: true });
  const payload = { level: LEVEL, count: patterns.length, groups, patterns };
  writeFileSync(join(OUT_DIR, `${LEVEL}.json`), JSON.stringify(payload));

  // ringkasan
  const perGroup = {};
  for (const p of patterns) perGroup[p.functionGroup] = (perGroup[p.functionGroup] || 0) + 1;
  const confusable = patterns.filter(p => p.confusableWith.length > 0).length;
  console.log(`\n✅ ${LEVEL}.json — ${patterns.length} pola`);
  console.log("   grup:", groups.map(g => `${g.jp}:${perGroup[g.key] || 0}`).join(" · "));
  console.log("   punya confusableWith:", confusable, "| punya discriminator:", patterns.filter(p => p.discriminator).length);
}
main().catch(e => { console.error(e); process.exit(1); });
