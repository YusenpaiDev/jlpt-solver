#!/usr/bin/env node
/**
 * Tandai sesi materi `ai_result.ready`:
 *   ready = true  → semua soal REAL (bukan placeholder "問題1（1）")
 *   ready = false → masih ada placeholder / kosong (belum siap → di-lock "SOON")
 *
 *   node scripts/mark-ready.mjs --dry   # preview
 *   node scripts/mark-ready.mjs         # tulis
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
if (existsSync(".env.local")) for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL.trim(), process.env.SUPABASE_SECRET_KEY.trim(), { auth: { persistSession: false } });
const DRY = process.argv.includes("--dry");
const PLACEHOLDER = /^問題\d+（/;

function isReady(qs) {
  if (!Array.isArray(qs) || qs.length === 0) return false;
  return qs.every(q => q.question && !PLACEHOLDER.test(q.question) && Array.isArray(q.options) && q.options.length > 0);
}

const { data, error } = await sb.from("sessions").select("id, level, title, ai_result").eq("ai_result->>kind", "materi");
if (error) { console.error(error.message); process.exit(1); }
let ready = 0, notReady = 0, changed = 0;
for (const s of data ?? []) {
  const r = isReady(s.ai_result?.questions);
  r ? ready++ : notReady++;
  if (s.ai_result?.ready === r) continue;
  changed++;
  if (!r) console.log(`  🔒 SOON: ${s.title}`);
  if (!DRY) { const ai = s.ai_result; ai.ready = r; await sb.from("sessions").update({ ai_result: ai }).eq("id", s.id); }
}
console.log(`\n${DRY ? "[DRY] " : ""}ready: ${ready} · belum(SOON): ${notReady} · diubah: ${changed}`);
