#!/usr/bin/env node
/**
 * Segarkan sesi 聴解 di Supabase dari JSON lokal — di tempat, tanpa hapus baris.
 *
 * Kenapa gak pakai sync-bank-supabase: skrip itu sengaja NOLAK semua sesi
 * choukai, biar audio/transkrip yang udah ditempel belakangan gak ketimpa file
 * lokal yang lebih miskin. Aturan itu bener buat N2. Tapi buat N1/N3 keadaannya
 * kebalik: file lokal justru LEBIH lengkap (soal 問題3/4/5 baru direstorasi),
 * dan sesi di DB belum punya audio sama sekali.
 *
 * Makanya skrip ini punya rem sendiri: sesi yang UDAH punya audio nempel
 * dilewat, kecuali dipaksa --timpa-audio. Jadi gak mungkin ngerusak N2.
 *
 * Dicocokin lewat level + judul, dan nge-UPDATE (bukan delete+insert), jadi:
 *   - id sesi kepertahankan → salinan di akun tester ikut kesegerin
 *   - score & created_at gak keganggu
 *
 *   node scripts/sync-choukai.mjs --level N1            # dry-run
 *   node scripts/sync-choukai.mjs --level N1 --apply
 */

import { readFile, readdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { normalizeResult } from "./lib/normalize-soal.mjs";

if (existsSync(".env.local")) {
  for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "").trim();
  }
}

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const TIMPA_AUDIO = args.includes("--timpa-audio");
const level = args[args.indexOf("--level") + 1];
if (!level || !/^N[1-5]$/.test(level)) {
  console.error("Pakai: node scripts/sync-choukai.mjs --level N1 [--apply] [--timpa-audio]");
  process.exit(1);
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL.trim(),
  process.env.SUPABASE_SECRET_KEY.trim(),
  { auth: { persistSession: false } }
);

const dir = join("materi/import", level, "CHOUKAI");

async function main() {
  const files = (await readdir(dir)).filter(f => f.endsWith(".json")).sort();

  const { data: sesi, error } = await sb
    .from("sessions")
    .select("id, user_id, title, total, ai_result")
    .eq("level", level)
    .eq("ai_result->>kind", "materi")
    .eq("ai_result->>section", "choukai");
  if (error) { console.error("❌", error.message); process.exit(1); }

  /* satu judul bisa punya banyak baris — owner + tiap akun tester */
  const perJudul = new Map();
  for (const s of sesi) {
    if (!perJudul.has(s.title)) perJudul.set(s.title, []);
    perJudul.get(s.title).push(s);
  }

  let diubah = 0, dilewat = 0, belumAda = 0, barisKena = 0;

  for (const f of files) {
    const baru = normalizeResult(JSON.parse(await readFile(join(dir, f), "utf8")));
    const rows = perJudul.get(baru.title) ?? [];

    if (rows.length === 0) {
      belumAda++;
      console.log(`  ➕ ${f} — belum ada sesinya di DB (${baru.questions.length} soal) → perlu \`npm run import\``);
      continue;
    }

    const punyaAudio = rows.filter(r => (r.ai_result?.questions ?? []).some(q => q?.audio));
    if (punyaAudio.length > 0 && !TIMPA_AUDIO) {
      dilewat++;
      console.log(`  🔒 ${f} — dilewat, ${punyaAudio.length} baris udah ada audio nempel (pakai --timpa-audio kalau emang mau)`);
      continue;
    }

    const lama = rows[0].ai_result?.questions?.length ?? 0;
    if (lama === baru.questions.length) {
      dilewat++;
      continue;
    }

    diubah++; barisKena += rows.length;
    console.log(`  ✎ ${f} — ${lama} → ${baru.questions.length} soal · ${rows.length} baris (owner + tester)`);

    if (APPLY) {
      for (const r of rows) {
        const { error: e } = await sb
          .from("sessions")
          .update({ ai_result: baru, total: baru.questions.length })
          .eq("id", r.id);
        if (e) { console.error(`❌ ${r.id}: ${e.message}`); process.exit(1); }
      }
    }
  }

  console.log(
    `\n${APPLY ? "" : "[DRY-RUN] "}${level} · file: ${files.length} · ` +
    `sesi diperbarui: ${diubah} (${barisKena} baris) · dilewat: ${dilewat} · belum ada di DB: ${belumAda}`
  );
  if (!APPLY && diubah > 0) console.log("Jalanin lagi dengan --apply buat nulis.");
}

main().catch(e => { console.error(e); process.exit(1); });
