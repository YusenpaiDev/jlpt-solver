#!/usr/bin/env node
/**
 * Import JSON soal (generated via Claude.ai chat) ke Supabase sebagai sesi.
 *
 * Cara pakai:
 *   1. Generate JSON di Claude.ai pakai prompt di materi/PROMPT.md
 *   2. Save JSON ke materi/import/<nama>.json
 *   3. Jalankan:
 *        npm run import
 *        npm run import -- --level N1
 *        npm run import -- materi/import/foo.json
 *
 * Idempotent — file yang udah punya `.pushed` sentinel di-skip.
 */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { createClient } from "@supabase/supabase-js";

/* .env.local loader */
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

/* CLI */
const args = process.argv.slice(2);
let level = "N2";
let category = "AI";
let userEmail = "yusufnashirsyarifuddin@gmail.com";
let importDir = "materi/import";
const positional = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--level") level = args[++i];
  else if (a === "--category") category = args[++i];
  else if (a === "--user-email") userEmail = args[++i];
  else if (a === "--dir") importDir = args[++i];
  else if (a === "--help" || a === "-h") {
    console.log("Usage: npm run import -- [--level N2] [--category AI|文法|語彙|文字|読解] [--user-email you@x.com] [--dir materi/import] [file.json ...]");
    process.exit(0);
  } else positional.push(a);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !key) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY gak ada di .env.local");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

/* Find user_id by email */
async function findUserId(email) {
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data?.users?.find(u => (u.email ?? "").toLowerCase() === email.toLowerCase());
    if (u) return u.id;
    if (!data?.users?.length || data.users.length < 200) return null;
    page++;
  }
}

/* Choukai ber-key Jepang (試験/年月/問題/質問) → format standar app.
   Future-proof: kalau nanti ada 質問文/スクリプト/解説, ikut ke-ambil. */
const MONDAI_NAME = { 1: "課題理解", 2: "ポイント理解", 3: "概要理解", 4: "即時応答", 5: "統合理解" };
function normalizeTranscript(t) {
  if (!Array.isArray(t)) return null;
  const out = t.map(line => {
    if (line && typeof line === "object") return { sp: line.sp ?? line["話者"] ?? "", jp: line.jp ?? line["日本語"] ?? "", id: line.id ?? line["訳"] ?? "" };
    return { sp: "", jp: String(line), id: "" };
  });
  return out.length ? out : null;
}
function convertChoukaiRaw(raw) {
  const shiken = raw["試験"] ?? "N2";
  const nengetsu = raw["年月"] ?? "";
  const questions = [];
  for (const m of (raw["問題"] ?? [])) {
    const num = m["問題番号"];
    const shiji = m["指示"] ?? "";
    const script = normalizeTranscript(m["スクリプト"] ?? m["台本"] ?? m["本文"]);
    const cat = "聴解-" + (MONDAI_NAME[num] ?? "");
    for (const q of (m["質問"] ?? [])) {
      const qText = q["質問文"] ?? q["問い"] ?? "";
      questions.push({
        mondai: num,
        category: cat,
        prompt: shiji,
        question: qText || `問題${num}（${q["番号"]}）`,
        options: (q["選択肢"] ?? []).map((o, i) => `${i + 1}. ${o}`),
        correct: String(q["正解"] ?? "1"),
        explanation: q["解説"] ?? `Jawaban benar: pilihan ${q["正解"]}.`,
        transcript: normalizeTranscript(q["スクリプト"] ?? q["台本"]) ?? script,
        audio: null,
        image: typeof q["image"] === "number" || typeof q["image"] === "string" ? q["image"] : null,
      });
    }
  }
  return { title: raw.title || `JLPT ${shiken} ${nengetsu} 聴解`.trim(), section: "choukai", vocabulary: [], questions };
}

/* Normalize: pastikan field yang dipake app ada, fill default kalau missing */
function normalizeResult(raw, fallbackTitle) {
  // Auto-convert format choukai ber-key Jepang sebelum normalisasi standar.
  if (Array.isArray(raw["問題"]) && !Array.isArray(raw.questions)) {
    raw = convertChoukaiRaw(raw);
  }
  const title = (raw.title || fallbackTitle || "Soal JLPT").toString();
  const section = raw.section ?? null;
  const vocabulary = Array.isArray(raw.vocabulary) ? raw.vocabulary.map(v => ({
    word: v.word ?? v.kanji ?? "",
    reading: v.reading ?? "",
    meaning: v.meaning ?? "",
    example: v.example ?? "",
    jlpt_level: v.jlpt_level ?? v.level ?? null,
  })).filter(v => v.word) : [];

  const questions = Array.isArray(raw.questions) ? raw.questions.map(q => ({
    question: q.question ?? "",
    options: Array.isArray(q.options) ? q.options : [],
    correct: String(q.correct ?? q.correct_ans ?? "1"),
    explanation: q.explanation ?? "",
    why_wrong: q.why_wrong ?? "",
    grammar_points: Array.isArray(q.grammar_points) ? q.grammar_points : [],
    tip: q.tip ?? "",
    category: q.category ?? "AI",
    passage: q.passage ?? null,
    // choukai-specific (null-able, kept verbatim so player can read them from ai_result)
    audio: q.audio ?? null,
    image: q.image ?? null,
    mondai: typeof q.mondai === "number" ? q.mondai : null,
    transcript: Array.isArray(q.transcript) ? q.transcript : null,
    prompt: q.prompt ?? null,
  })).filter(q => q.question && q.options.length > 0) : [];

  return { title, section, vocabulary, questions };
}

/* Auto-detect kategori session: choukai kalau ada 聴解-* questions atau section=choukai */
function detectCategory(result, fallback) {
  if (result.section === "choukai") return "聴解";
  if (result.questions.some(q => typeof q.category === "string" && q.category.startsWith("聴解"))) return "聴解";
  return fallback;
}

/* Discover JSON files — rekursif (masuk subfolder) */
async function walkJsons(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.startsWith(".")) continue;
      out.push(...await walkJsons(full));
    } else if (e.isFile() && extname(e.name).toLowerCase() === ".json" && !e.name.startsWith(".")) {
      out.push(full);
    }
  }
  return out;
}

async function discoverJsons() {
  if (positional.length > 0) return positional.filter(p => extname(p).toLowerCase() === ".json");
  if (!existsSync(importDir)) {
    console.error(`❌ Folder ${importDir}/ gak ada. Bikin dulu + drop JSON kamu ke situ.`);
    process.exit(1);
  }
  return await walkJsons(importDir);
}

/* Push to Supabase */
async function push(userId, result) {
  const sessionCategory = detectCategory(result, category);
  // DB constraint cuma izinin ('文法','語彙','文字','読解','AI') — '聴解' belum.
  // Halaman Choukai ngenalin sesi via ai_result.section === "choukai", jadi
  // simpan category 'AI' biar lolos constraint tanpa migrasi DB.
  const dbCategory = sessionCategory === "聴解" ? "AI" : sessionCategory;
  const { data: session, error: sessErr } = await supabase
    .from("sessions")
    .insert({
      user_id: userId,
      level,
      category: dbCategory,
      title: result.title,
      total: result.questions.length,
      ai_result: result,
    })
    .select("id")
    .single();
  if (sessErr) throw sessErr;

  if (result.questions.length > 0) {
    const { error: qErr } = await supabase.from("questions").insert(
      result.questions.map(q => ({
        session_id: session.id,
        user_id: userId,
        question: q.question,
        options: q.options,
        correct_ans: q.correct,
        explanation: q.explanation,
      }))
    );
    if (qErr) throw qErr;
  }

  if (result.vocabulary?.length > 0) {
    await supabase.from("saved_words").upsert(
      result.vocabulary.map(v => ({
        user_id: userId,
        kanji: v.word,
        reading: v.reading,
        meaning: v.meaning,
        level: v.jlpt_level || null,
      })),
      { onConflict: "user_id,kanji", ignoreDuplicates: true }
    );
  }

  return session.id;
}

async function main() {
  const userId = await findUserId(userEmail);
  if (!userId) {
    console.error(`❌ User ${userEmail} gak ketemu di Supabase.`);
    process.exit(1);
  }

  const files = await discoverJsons();
  if (files.length === 0) {
    console.log(`⚠️  Gak ada JSON di ${importDir}/. Drop file kamu ke situ dulu.`);
    return;
  }

  console.log(`\n📥 Import JSON ke Supabase`);
  console.log(`   User: ${userEmail}`);
  console.log(`   Level: ${level} · Kategori: ${category}`);
  console.log(`   Files: ${files.length}\n`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const name = basename(file, ".json");
    const sentinel = file + ".pushed";

    console.log(`[${i + 1}/${files.length}] ${file}`);

    if (existsSync(sentinel)) {
      console.log(`  ⏭  Skip — udah pernah di-push (hapus ${basename(sentinel)} buat re-push)\n`);
      continue;
    }

    try {
      const raw = JSON.parse(await readFile(file, "utf8"));
      const result = normalizeResult(raw, name);
      if (result.questions.length === 0) {
        console.log(`  ❌ Skip — JSON gak punya questions yang valid\n`);
        continue;
      }
      const sessionId = await push(userId, result);
      await writeFile(sentinel, sessionId, "utf8");
      console.log(`  ✓ ${result.questions.length} soal, ${result.vocabulary.length} kotoba → session ${sessionId}\n`);
    } catch (err) {
      console.log(`  ❌ Gagal: ${err.message}\n`);
    }
  }

  console.log(`✅ Selesai. Cek di Riwayat Soal app.`);
}

main().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
