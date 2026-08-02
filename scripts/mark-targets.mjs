#!/usr/bin/env node
/**
 * Tandai kata TARGET di soal 文字 (漢字読み) & 語彙 (漢字表記/言い換え/用法) pakai
 * Claude Haiku, biar jelas kata mana yang ditanya (digarisbawahi di app).
 * Nambah field `target` (substring PERSIS dari kalimat) ke tiap soal.
 *
 *   node scripts/mark-targets.mjs --dry           # preview sampel, gak nulis
 *   node scripts/mark-targets.mjs --dry --limit 3 # cuma 3 sesi
 *   node scripts/mark-targets.mjs                 # eksekusi + tulis ke DB
 *
 * Idempotent: soal yang udah punya `target` di-skip. Soal yang udah ada blank
 * （　） atau 読解/文法 di-skip (nggak butuh garis).
 */
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

function loadEnv() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}
loadEnv();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL.trim(), process.env.SUPABASE_SECRET_KEY.trim(), { auth: { persistSession: false } });
const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5-20251001";
const DRY = process.argv.includes("--dry");
const LIMIT = (() => { const i = process.argv.indexOf("--limit"); return i >= 0 ? +process.argv[i + 1] : 0; })();

const BLANK = /（[\s　]*）|\(\s*\)/;   // soal 文脈規定 udah punya blank → skip
const NEEDS = new Set(["文字", "語彙"]);

const SYS = `あなたはJLPTの問題整形の専門家です。各問題について、文中で「下線を引くべき対象語」を、文からそのままコピーした部分文字列として返します。

ルール:
- 漢字読み（選択肢がひらがな読み）: 読みが答えになっている漢字語（送り仮名含む）を返す。例: 文「紙で包んであった」答「つつんで」→ target「包んで」。
- 漢字表記（選択肢が漢字、文中にひらがな）: 漢字で書くべきひらがな部分を返す。例: 文「せいじょうかどうか」答「正常」→ target「せいじょう」。
- 言い換え・類義: 言い換えの対象語を返す。
- 用法・文脈規定・（　）が既にある・判断不能: target は空文字 "" を返す。
- target は必ず文中に「そのまま」存在する部分文字列にすること（1文字も変えない）。
出力は JSON 配列のみ: [{"i":<番号>,"target":"<部分文字列>"}]。他の文章は一切書かない。`;

async function markBatch(items) {
  const payload = items.map(it => ({ i: it.i, category: it.category, sentence: it.question, options: it.options, answer: it.options[+it.correct - 1] ?? it.correct }));
  const msg = await ai.messages.create({
    model: MODEL, max_tokens: 2000,
    system: SYS,
    messages: [{ role: "user", content: JSON.stringify(payload) }],
  });
  const txt = msg.content.map(b => (b.type === "text" ? b.text : "")).join("");
  const m = txt.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try { return JSON.parse(m[0]); } catch { return []; }
}

async function pool(tasks, size) {
  const out = []; let idx = 0;
  async function worker() { while (idx < tasks.length) { const my = idx++; out[my] = await tasks[my]().catch(() => null); } }
  await Promise.all(Array.from({ length: Math.min(size, tasks.length) }, worker));
  return out;
}

async function main() {
  let q = sb.from("sessions").select("id, title, ai_result").eq("ai_result->>kind", "materi").order("created_at", { ascending: false });
  if (LIMIT) q = q.limit(LIMIT);
  const { data, error } = await q;
  if (error) throw error;

  // kumpulin soal yang butuh target
  const items = []; // {sid, qi, i, question, options, correct, category}
  let globalI = 0;
  for (const s of data ?? []) {
    (s.ai_result?.questions ?? []).forEach((qq, qi) => {
      if (!NEEDS.has(qq.category)) return;
      if (typeof qq.target === "string") return;          // udah ditandai
      if (BLANK.test(qq.question ?? "")) return;           // udah ada blank
      if (!qq.question || !(qq.options?.length)) return;
      items.push({ sid: s.id, qi, i: globalI++, question: qq.question, options: qq.options, correct: qq.correct, category: qq.category });
    });
  }
  console.log(`\n🖊  ${items.length} soal 文字/語彙 perlu target (dari ${data?.length ?? 0} sesi)${DRY ? "  [DRY]" : ""}`);
  if (!items.length) return;

  // chunk 12/call
  const chunks = [];
  for (let k = 0; k < items.length; k += 12) chunks.push(items.slice(k, k + 12));
  console.log(`   ${chunks.length} batch × ~12 soal → Haiku…\n`);

  const results = await pool(chunks.map((ch, ci) => async () => {
    const res = await markBatch(ch);
    if ((ci + 1) % 10 === 0 || ci === chunks.length - 1) console.log(`   batch ${ci + 1}/${chunks.length}`);
    return res;
  }), 6);

  // map i → target, validasi substring
  const byI = new Map(items.map(it => [it.i, it]));
  const targetOf = new Map(); // i → target
  let ok = 0, empty = 0, invalid = 0;
  for (const arr of results) {
    for (const r of arr ?? []) {
      const it = byI.get(r.i); if (!it) continue;
      const t = (r.target ?? "").trim();
      if (!t) { empty++; continue; }
      if (!it.question.includes(t)) { invalid++; continue; } // bukan substring persis → buang
      targetOf.set(r.i, t); ok++;
    }
  }
  console.log(`\n✅ valid: ${ok} · kosong: ${empty} · gak match (dibuang): ${invalid}`);

  if (DRY) {
    console.log("\n— contoh (15) —");
    let n = 0;
    for (const [i, t] of targetOf) { if (n++ >= 15) break; const it = byI.get(i); console.log(`  [${it.category}] ${it.question}\n     → target: 「${t}」  (jawab: ${it.options[+it.correct - 1] ?? it.correct})`); }
    console.log("\n[DRY] belum nulis. Jalankan tanpa --dry buat simpan.");
    return;
  }

  // apply per sesi
  const bySid = new Map();
  for (const [i, t] of targetOf) { const it = byI.get(i); (bySid.get(it.sid) ?? bySid.set(it.sid, []).get(it.sid)).push({ qi: it.qi, t }); }
  const sessMap = new Map((data ?? []).map(s => [s.id, s]));
  let updated = 0;
  for (const [sid, patches] of bySid) {
    const s = sessMap.get(sid); const aiR = s.ai_result;
    for (const p of patches) aiR.questions[p.qi].target = p.t;
    const { error: ue } = await sb.from("sessions").update({ ai_result: aiR }).eq("id", sid);
    if (ue) { console.log(`  ❌ ${s.title}: ${ue.message}`); continue; }
    updated++;
  }
  console.log(`\n🎉 Selesai. ${ok} target ditulis ke ${updated} sesi.`);
}
main().catch(e => { console.error("❌", e.message ?? e); process.exit(1); });
