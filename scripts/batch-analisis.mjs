#!/usr/bin/env node
/**
 * Batch analisis PDF soal JLPT — outputs JSON sama persis dengan format
 * Analisis Foto di app (title + vocabulary[] + questions[]).
 *
 * Cara pakai:
 *   1. Drop PDF ke folder materi/
 *   2. Pastikan ANTHROPIC_API_KEY ada di .env.local
 *   3. Jalankan:
 *        node scripts/batch-analisis.mjs              # default N2, AI auto-detect category
 *        node scripts/batch-analisis.mjs --level N1
 *        node scripts/batch-analisis.mjs --category 文法
 *        node scripts/batch-analisis.mjs materi/foo.pdf  # specific file
 *
 * Output: materi/output/<filename>.json
 */

import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join, basename, extname } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/* ────────────────────────────────────────────────────────────────
   .env.local loader (no dep on dotenv)
   ──────────────────────────────────────────────────────────────── */
function loadEnvLocal() {
  const path = ".env.local";
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
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

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY tidak ditemukan di .env.local");
  process.exit(1);
}

/* ────────────────────────────────────────────────────────────────
   CLI args
   ──────────────────────────────────────────────────────────────── */
const args = process.argv.slice(2);
let level = "N2";
let category = ""; // empty = AI auto-detect
let outDir = "materi/output";
let userEmail = "yusufnashirsyarifuddin@gmail.com";
let noPush = false;
let retryFailed = false;
const positional = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--level") { level = args[++i]; }
  else if (a === "--category") { category = args[++i]; }
  else if (a === "--out") { outDir = args[++i]; }
  else if (a === "--user-email") { userEmail = args[++i]; }
  else if (a === "--no-push") { noPush = true; }
  else if (a === "--retry-failed") { retryFailed = true; }
  else if (a === "--help" || a === "-h") {
    console.log("Usage: node scripts/batch-analisis.mjs [--level N2] [--category 文法] [--out materi/output] [--user-email you@x.com] [--no-push] [--retry-failed] [file.pdf ...]");
    process.exit(0);
  }
  else positional.push(a);
}

/* ────────────────────────────────────────────────────────────────
   Discover input PDFs
   ──────────────────────────────────────────────────────────────── */
const SUPPORTED_EXT = new Set([".pdf", ".docx", ".png", ".jpg", ".jpeg", ".webp", ".gif"]);

async function walkFiles(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "output" || e.name.startsWith(".")) continue;
      out.push(...await walkFiles(full));
    } else if (
      e.isFile() &&
      SUPPORTED_EXT.has(extname(e.name).toLowerCase()) &&
      !e.name.startsWith("~$") &&     // Word lock file
      !e.name.startsWith(".")          // hidden / macOS resource fork (._)
    ) {
      out.push(full);
    }
  }
  return out;
}

async function discoverInputs() {
  if (positional.length > 0) {
    return positional.filter(p => SUPPORTED_EXT.has(extname(p).toLowerCase()));
  }
  if (!existsSync("materi")) {
    console.error("❌ Folder materi/ tidak ada. Drop file kamu ke folder materi/ dulu.");
    process.exit(1);
  }
  return await walkFiles("materi");
}

/* ────────────────────────────────────────────────────────────────
   Split PDF jadi chunks 2-halaman (sama kayak frontend)
   ──────────────────────────────────────────────────────────────── */
async function splitPdfIntoChunks(buffer, pagesPerChunk = 2) {
  const pdf = await PDFDocument.load(buffer);
  const total = pdf.getPageCount();

  if (total <= pagesPerChunk) {
    return [{ base64: Buffer.from(buffer).toString("base64"), label: `hal 1-${total}` }];
  }

  const chunks = [];
  for (let i = 0; i < total; i += pagesPerChunk) {
    const newPdf = await PDFDocument.create();
    const count = Math.min(pagesPerChunk, total - i);
    const indices = Array.from({ length: count }, (_, j) => i + j);
    const copied = await newPdf.copyPages(pdf, indices);
    copied.forEach(p => newPdf.addPage(p));
    const bytes = await newPdf.save();
    chunks.push({
      base64: Buffer.from(bytes).toString("base64"),
      label: `hal ${i + 1}-${i + count}`,
    });
  }
  return chunks;
}

/* ────────────────────────────────────────────────────────────────
   Prompt (sama persis dengan /api/analisis/route.ts)
   ──────────────────────────────────────────────────────────────── */
function buildPrompt(level, category) {
  const categoryLabel =
    category === "文法" ? "tata bahasa (文法/bunpou)"
    : category === "語彙" ? "kosakata (語彙/goi)"
    : category === "文字" ? "kanji & huruf (文字/moji)"
    : category === "読解" ? "membaca (読解/dokkai)"
    : "semua kategori (AI akan menentukan sendiri)";

  return `Kamu adalah Sensei JLPT, guru bahasa Jepang yang sangat ahli dalam membaca, menganalisis soal ujian JLPT, dan mengekstrak kosakata penting.

Foto ini berisi soal ujian JLPT level ${level}, kategori ${categoryLabel}.

TUGAS UTAMA:
Baca SELURUH teks dalam foto dengan sangat teliti. Ekstrak SEMUA soal yang ada persis seperti tertulis. Jangan buat soal baru, jangan kurangi.

Untuk setiap soal berikan analisis LENGKAP:
1. Teks soal PERSIS dari foto (dalam huruf Jepang) — HANYA pertanyaan saja, JANGAN ikut sertakan teks pilihan jawaban di field "question".
2. Semua pilihan jawaban PERSIS dari foto → format "1. xxx", "2. xxx", "3. xxx", "4. xxx"
3. Jawaban benar ("1"/"2"/"3"/"4")
4. Penjelasan kenapa jawaban itu BENAR
5. Penjelasan kenapa pilihan LAIN salah (sebutkan per nomor)
6. Poin grammar/kosakata: kata kunci Jepang + furigana + arti Indonesia
7. Tips ujian singkat
8. Kategori soal: "文法"/"語彙"/"文字"/"読解"
9. Jika soal ini 読解: sertakan TEKS BACAAN LENGKAP di field "passage". Jika soal 読解 lanjutan yang bacaannya sama dengan soal sebelumnya, isi "passage" dengan null.

BAHASA YANG WAJIB DIGUNAKAN:
- Field "explanation", "why_wrong", dan "tip" HARUS SELURUHNYA dalam Bahasa Indonesia.
- DILARANG KERAS menggunakan bahasa Jepang di dalam field explanation, why_wrong, dan tip.
- Jika ingin menyebut kata/frasa Jepang dalam penjelasan, tulis dulu kata Jepangnya lalu langsung beri artinya dalam kurung. Contoh: 「〜ないうちに」(sebelum sempat ~).
- Field "grammar_points[].id" juga harus dalam Bahasa Indonesia.

PENTING:
- Ekstrak SEMUA soal, jangan dibatasi jumlahnya
- Teks soal dan pilihan harus PERSIS dari foto
- Format "correct" isi angka: "1", "2", "3", atau "4"
- PEMISAHAN SOAL vs OPSI: Field "question" HANYA berisi kalimat/teks pertanyaan. JANGAN PERNAH menggabungkan baris "1...　2...　3...　4..." atau pilihan jawaban ke dalam "question". Pilihan jawaban HARUS hanya ada di array "options". Ini berlaku khusus untuk soal 読解 di mana opsi sering berdekatan dengan pertanyaan di foto.

EKSTRAK KOSAKATA:
Selain soal, ekstrak kosakata penting dari foto ke field "vocabulary" (maks 10 kata):
- "word": kata dalam kanji/hiragana persis dari foto
- "reading": furigana lengkap dalam hiragana
- "meaning": arti dalam Bahasa Indonesia
- "example": kalimat pendek dari foto yang mengandung kata ini (boleh kosong "")
- "jlpt_level": perkiraan level JLPT ("N1"/"N2"/"N3"/"N4"/"N5")
Hanya kata yang BENAR-BENAR muncul di foto. Jika tidak ada kosakata menarik, isi array kosong [].

Balas HANYA dengan JSON ini (tanpa markdown, tanpa komentar):
{
  "title": "judul singkat berdasarkan konten foto",
  "vocabulary": [
    {
      "word": "装置",
      "reading": "そうち",
      "meaning": "perangkat, alat",
      "example": "水をきれいにする装置です。",
      "jlpt_level": "N2"
    }
  ],
  "questions": [
    {
      "question": "teks soal persis dari foto",
      "options": ["1. ...", "2. ...", "3. ...", "4. ..."],
      "correct": "2",
      "explanation": "penjelasan kenapa benar — WAJIB Bahasa Indonesia",
      "why_wrong": "kenapa pilihan 1 salah: ... Kenapa pilihan 3 salah: ... — WAJIB Bahasa Indonesia",
      "grammar_points": [{"jp": "単語", "reading": "たんご", "id": "arti dalam Bahasa Indonesia"}],
      "tip": "tips ujian — WAJIB Bahasa Indonesia",
      "category": "文法",
      "passage": null
    }
  ]
}`;
}

/* ────────────────────────────────────────────────────────────────
   JSON extraction + repair (port dari route.ts)
   ──────────────────────────────────────────────────────────────── */
function extractJsonBlock(text) {
  let s = text.trim()
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
  if (s.startsWith("{")) return s;
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return s;
}

function repairJson(raw) {
  const s = raw.replace(/,\s*$/, "").replace(/"[^"]*$/, '"...');
  const closings = ["}", "}]", "}]}", "]}", "}]}]", "}]}]}", "]}]}", "}]}]}]"];
  for (const tail of closings) {
    try { return JSON.parse(s + tail); } catch { /* keep trying */ }
  }
  return null;
}

/* ────────────────────────────────────────────────────────────────
   Call Claude per chunk — dengan retry exponential backoff
   ──────────────────────────────────────────────────────────────── */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function callClaudeOnce(client, prompt, payload) {
  const cachedPromptBlock = {
    type: "text",
    text: prompt,
    cache_control: { type: "ephemeral" },
  };

  let contentBlock;
  if (payload.kind === "pdf") {
    contentBlock = {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: payload.base64 },
    };
  } else if (payload.kind === "docx") {
    contentBlock = {
      type: "text",
      text: `Berikut adalah isi dokumen Word yang berisi soal JLPT:\n\n${payload.text}`,
    };
  } else if (payload.kind === "image") {
    contentBlock = {
      type: "image",
      source: { type: "base64", media_type: payload.mediaType, data: payload.base64 },
    };
  } else {
    throw new Error(`Unsupported payload kind: ${payload.kind}`);
  }

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 64000,
    messages: [{ role: "user", content: [cachedPromptBlock, contentBlock] }],
  });

  const finalMessage = await stream.finalMessage();
  const textBlock = finalMessage.content.find(b => b.type === "text");
  if (!textBlock) throw new Error("Tidak ada respons teks dari Claude");

  const raw = extractJsonBlock(textBlock.text);
  try {
    return JSON.parse(raw);
  } catch {
    const repaired = repairJson(raw);
    if (repaired) {
      console.warn("    ⚠️  JSON di-repair (truncated response)");
      return repaired;
    }
    throw new Error("Gagal parse JSON dari Claude");
  }
}

function isRetryable(err) {
  const status = err?.status ?? err?.response?.status;
  if (status === 429 || status === 529 || status === 503 || status === 502 || status === 500) return true;
  const msg = String(err?.message ?? "");
  if (/overload|rate.?limit|timeout|ECONNRESET|ETIMEDOUT|fetch failed|socket hang up/i.test(msg)) return true;
  return false;
}

async function analyzeChunk(client, prompt, payload, maxAttempts = 4) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await callClaudeOnce(client, prompt, payload);
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts || !isRetryable(err)) throw err;
      const wait = Math.min(30000, 2000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 500);
      process.stdout.write(`(retry ${attempt}/${maxAttempts - 1} in ${(wait / 1000).toFixed(1)}s) `);
      await sleep(wait);
    }
  }
  throw lastErr;
}

/* ────────────────────────────────────────────────────────────────
   Process satu PDF — split + analyze + merge
   ──────────────────────────────────────────────────────────────── */
/* Split docx text jadi chunks ~3500 char. Pecah di boundary "問題N"
   biar instruksi soal tetap utuh per chunk. Kalau satu 問題 > target,
   biarin aja (gak split mid-question). */
function chunkDocxText(text, targetSize = 3500) {
  // Split di setiap 問題 marker (keep marker as start of next section)
  const sections = text.split(/(?=問題\s*\d+)/);
  if (sections.length === 1) {
    // Gak ada marker 問題 → fallback split per ~targetSize char (di newline boundary)
    return splitByChars(text, targetSize);
  }
  const chunks = [];
  let buffer = "";
  for (const section of sections) {
    if (buffer.length + section.length <= targetSize) {
      buffer += section;
    } else {
      if (buffer.trim()) chunks.push(buffer);
      if (section.length > targetSize * 2) {
        // Section satu sendiri kegedean — pecah lebih kecil
        chunks.push(...splitByChars(section, targetSize));
        buffer = "";
      } else {
        buffer = section;
      }
    }
  }
  if (buffer.trim()) chunks.push(buffer);
  return chunks;
}

function splitByChars(text, targetSize) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + targetSize, text.length);
    if (end < text.length) {
      // Cari newline terdekat ke belakang biar gak putus di tengah baris
      const nl = text.lastIndexOf("\n", end);
      if (nl > i + targetSize / 2) end = nl;
    }
    out.push(text.slice(i, end));
    i = end;
  }
  return out;
}

function imageMediaType(path) {
  const ext = extname(path).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

async function buildPayloads(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".pdf") {
    const buffer = await readFile(filePath);
    const chunks = await splitPdfIntoChunks(buffer);
    return chunks.map(c => ({ kind: "pdf", base64: c.base64, label: c.label }));
  }
  if (ext === ".docx") {
    const mammoth = (await import("mammoth")).default;
    const buffer = await readFile(filePath);
    const ext2 = await mammoth.extractRawText({ buffer });
    if (!ext2.value.trim()) throw new Error("Dokumen Word kosong / tidak ada teks");
    return chunkDocxText(ext2.value).map((text, i, arr) => ({
      kind: "docx",
      text,
      label: `bagian ${i + 1}/${arr.length}`,
    }));
  }
  // image
  const buffer = await readFile(filePath);
  return [{
    kind: "image",
    base64: Buffer.from(buffer).toString("base64"),
    mediaType: imageMediaType(filePath),
    label: "image",
  }];
}

async function processFile(client, filePath, prompt, fallbackTitle) {
  const payloads = await buildPayloads(filePath);

  const isPdfMulti = payloads.length > 1;
  console.log(`  📄 ${payloads.length} chunk(s)${isPdfMulti ? " (2-hal per chunk)" : ""}`);

  let title = "";
  const allQuestions = [];
  const allVocab = [];
  const failedChunks = [];

  for (let i = 0; i < payloads.length; i++) {
    const p = payloads[i];
    process.stdout.write(`  ⏳ Chunk ${i + 1}/${payloads.length} (${p.label})... `);
    const t0 = Date.now();
    try {
      const result = await analyzeChunk(client, prompt, p);
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      if (!title && result.title) title = result.title;
      const qCount = (result.questions ?? []).length;
      const vCount = (result.vocabulary ?? []).length;
      allQuestions.push(...(result.questions ?? []));
      allVocab.push(...(result.vocabulary ?? []));
      console.log(`✓ ${qCount} soal, ${vCount} kotoba (${dt}s)`);
    } catch (err) {
      console.log(`✗ ${err.message}`);
      failedChunks.push(p.label);
    }
  }

  const uniqueVocab = Array.from(new Map(allVocab.map(v => [v.word, v])).values());
  if (!title) title = fallbackTitle;

  return {
    title: payloads.length > 1 ? `${title} (${payloads.length} chunks)` : title,
    vocabulary: uniqueVocab,
    questions: allQuestions,
    _meta: failedChunks.length > 0 ? { failed_chunks: failedChunks } : undefined,
  };
}

/* ────────────────────────────────────────────────────────────────
   Supabase push — bikin sesi muncul di Riwayat & Analisis Foto
   ──────────────────────────────────────────────────────────────── */
function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) return null;
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

async function findUserIdByEmail(supabase, email) {
  // Paginate auth.users via admin API until we find the email
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

async function pushToSupabase(supabase, userId, result, dbCategory, dbLevel) {
  const { data: session, error: sessErr } = await supabase
    .from("sessions")
    .insert({
      user_id: userId,
      level: dbLevel,
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
        example: v.example || null,
        level: v.jlpt_level || null,
      })),
      { onConflict: "user_id,kanji", ignoreDuplicates: true }
    );
  }

  return session.id;
}

/* Normalize question text untuk deduplikasi */
function normQ(s) {
  return (s ?? "").replace(/\s+/g, "").trim();
}

/* ────────────────────────────────────────────────────────────────
   Retry failed chunks dengan sub-chunk lebih kecil
   ──────────────────────────────────────────────────────────────── */
async function retryFailedChunks(client, sourcePath, result, prompt) {
  const failedLabels = result._meta?.failed_chunks ?? [];
  if (failedLabels.length === 0) return { result, retried: 0, recovered: 0 };

  // Re-chunk source pakai target_size yang sama → cari posisi chunk yang gagal
  const allPayloads = await buildPayloads(sourcePath);

  // Match label kayak "bagian 4/6" → index 3
  const failedPayloads = [];
  for (const label of failedLabels) {
    const m = label.match(/bagian\s+(\d+)\s*\/\s*(\d+)/);
    if (m) {
      const idx = parseInt(m[1], 10) - 1;
      if (allPayloads[idx]) failedPayloads.push({ payload: allPayloads[idx], label });
    } else {
      // PDF / image — gak ada pola "bagian N/M"
      const p = allPayloads.find(x => x.label === label);
      if (p) failedPayloads.push({ payload: p, label });
    }
  }

  if (failedPayloads.length === 0) {
    console.log("  ⚠  Gak bisa cocokkan failed chunks ke source (label berubah?). Skip retry.");
    return { result, retried: 0, recovered: 0 };
  }

  console.log(`  ↻ Retry ${failedPayloads.length} failed chunk(s) dengan sub-chunk lebih kecil...`);
  let recovered = 0;
  const recoveredLabels = new Set();

  // Dedup soal by question text — kalau retry produce soal yg udah ada, skip
  const existingQs = new Set(result.questions.map(q => normQ(q.question)));

  for (const { payload, label } of failedPayloads) {
    let subPayloads;
    if (payload.kind === "docx") {
      // Sub-chunk text dengan target kecil (800 char) — lebih aman dari truncation
      const subTexts = chunkDocxText(payload.text, 800);
      subPayloads = subTexts.map((text, i) => ({ kind: "docx", text, label: `${label}→sub${i + 1}/${subTexts.length}` }));
    } else {
      subPayloads = [{ ...payload, label: `${label}→retry` }];
    }

    let labelRecovered = false;
    for (let i = 0; i < subPayloads.length; i++) {
      const sp = subPayloads[i];
      process.stdout.write(`    ⏳ ${sp.label}... `);
      const t0 = Date.now();
      try {
        const r = await analyzeChunk(client, prompt, sp);
        const dt = ((Date.now() - t0) / 1000).toFixed(1);
        const rawQs = r.questions ?? [];
        const vs = r.vocabulary ?? [];
        // Filter soal yang udah ada
        const newQs = rawQs.filter(q => {
          const k = normQ(q.question);
          if (existingQs.has(k)) return false;
          existingQs.add(k);
          return true;
        });
        result.questions.push(...newQs);
        result.vocabulary.push(...vs);
        console.log(`✓ ${newQs.length} soal baru (${rawQs.length - newQs.length} dup), ${vs.length} kotoba (${dt}s)`);
        labelRecovered = true;
      } catch (err) {
        console.log(`✗ ${err.message}`);
      }
    }
    if (labelRecovered) {
      recovered++;
      recoveredLabels.add(label);
    }
  }

  // Dedupe vocab
  result.vocabulary = Array.from(new Map(result.vocabulary.map(v => [v.word, v])).values());

  // Update _meta
  const stillFailed = failedLabels.filter(l => !recoveredLabels.has(l));
  result._meta = stillFailed.length > 0 ? { failed_chunks: stillFailed } : undefined;

  return { result, retried: failedPayloads.length, recovered };
}

/* ────────────────────────────────────────────────────────────────
   Main
   ──────────────────────────────────────────────────────────────── */
async function main() {
  const pdfs = await discoverInputs();
  if (pdfs.length === 0) {
    console.log("⚠️  Tidak ada file di folder materi/. Drop PDF/DOCX/gambar kamu ke sana dulu.");
    return;
  }

  await mkdir(outDir, { recursive: true });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = buildPrompt(level, category);

  // Supabase setup (opsional)
  let supabase = null;
  let userId = null;
  if (!noPush) {
    supabase = createSupabaseAdmin();
    if (!supabase) {
      console.log("⚠️  NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY gak ada — push ke Supabase di-skip.");
    } else {
      try {
        userId = await findUserIdByEmail(supabase, userEmail);
        if (!userId) {
          console.log(`⚠️  User ${userEmail} gak ketemu di Supabase — push di-skip.`);
          supabase = null;
        }
      } catch (err) {
        console.log(`⚠️  Gagal lookup user (${err.message}) — push di-skip.`);
        supabase = null;
      }
    }
  }

  const dbCategory = category || "AI";
  const pushTarget = supabase ? `Supabase (user ${userEmail})` : "(disabled)";

  console.log(`\n🍵 Sensei JLPT — Batch Analisis`);
  console.log(`   Level: ${level} · Kategori: ${category || "AI auto-detect"}`);
  console.log(`   Output JSON: ${outDir}/`);
  console.log(`   Push ke: ${pushTarget}`);
  console.log(`   PDFs: ${pdfs.length} file\n`);

  for (let i = 0; i < pdfs.length; i++) {
    const pdf = pdfs[i];
    // Mirror folder structure dari materi/ ke outDir, biar gak collision
    const rel = pdf.startsWith("materi/") ? pdf.slice("materi/".length) : pdf;
    const relNoExt = rel.replace(/\.[^.]+$/, "");
    const outPath = join(outDir, `${relNoExt}.json`);
    const pushedSentinel = join(outDir, `${relNoExt}.pushed`);
    const name = basename(pdf, extname(pdf));

    console.log(`[${i + 1}/${pdfs.length}] ${pdf}`);

    let result;
    let didRetry = false;
    if (existsSync(outPath)) {
      console.log(`  ♻  Reuse JSON di ${outPath}`);
      try {
        result = JSON.parse(await readFile(outPath, "utf8"));
      } catch (err) {
        console.log(`  ❌ JSON corrupt: ${err.message}\n`);
        continue;
      }

      // Retry mode: kalau ada _meta.failed_chunks, coba recover
      if (retryFailed && result._meta?.failed_chunks?.length > 0) {
        const before = result.questions.length;
        const r = await retryFailedChunks(client, pdf, result, prompt);
        result = r.result;
        const after = result.questions.length;
        console.log(`  ✓ Retry: ${r.recovered}/${r.retried} chunk recovered, +${after - before} soal (total ${after})`);
        await writeFile(outPath, JSON.stringify(result, null, 2), "utf8");
        didRetry = r.recovered > 0;
      }
    } else {
      const t0 = Date.now();
      try {
        await mkdir(join(outDir, relNoExt.split("/").slice(0, -1).join("/")), { recursive: true });
        result = await processFile(client, pdf, prompt, name);
        await writeFile(outPath, JSON.stringify(result, null, 2), "utf8");
        const dt = ((Date.now() - t0) / 1000).toFixed(1);
        const warn = result._meta?.failed_chunks?.length
          ? ` ⚠ ${result._meta.failed_chunks.length} chunk gagal: ${result._meta.failed_chunks.join(", ")}`
          : "";
        console.log(`  ✓ ${result.questions.length} soal, ${result.vocabulary.length} kotoba → ${outPath} (${dt}s)${warn}`);
      } catch (err) {
        console.log(`  ❌ Analisis gagal: ${err.message}\n`);
        continue;
      }
    }

    // Push ke Supabase (kalau aktif & belum pernah di-push)
    if (supabase && userId) {
      // Kalau retry sukses: hapus sesi lama + sentinel biar push ulang dengan data lengkap
      if (didRetry && existsSync(pushedSentinel)) {
        try {
          const oldSessionId = (await readFile(pushedSentinel, "utf8")).trim();
          await supabase.from("questions").delete().eq("session_id", oldSessionId);
          await supabase.from("sessions").delete().eq("id", oldSessionId);
          await rm(pushedSentinel);
          console.log(`  🗑  Hapus sesi lama ${oldSessionId} buat re-push dengan data lengkap`);
        } catch (err) {
          console.log(`  ⚠  Gagal hapus sesi lama: ${err.message}`);
        }
      }

      if (existsSync(pushedSentinel)) {
        console.log(`  ⏭  Skip push — sudah pernah di-push (hapus ${name}.pushed buat re-push)\n`);
        continue;
      }
      if (result.questions.length === 0) {
        console.log(`  ⏭  Skip push — 0 soal (analisis gagal, gak di-push ke Supabase)\n`);
        continue;
      }
      try {
        const sessionId = await pushToSupabase(supabase, userId, result, dbCategory, level);
        await writeFile(pushedSentinel, sessionId, "utf8");
        console.log(`  ✓ Push ke Supabase → session ${sessionId}\n`);
      } catch (err) {
        console.log(`  ❌ Push gagal: ${err.message}\n`);
      }
    } else {
      console.log("");
    }
  }

  console.log("✅ Selesai.\n");
  if (supabase) {
    console.log(`   Sesi baru muncul di Riwayat Soal app — login sebagai ${userEmail}.`);
  } else {
    console.log("   Output JSON siap di-import manual ke app.");
  }
}

main().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
