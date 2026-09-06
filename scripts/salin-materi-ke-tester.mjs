#!/usr/bin/env node
/**
 * Salin sesi materi (bank soal) dari akun owner ke akun-akun tester.
 *
 * Versi skrip dari `supabase/COPY-SOAL-KE-*.sql` — logikanya sama persis,
 * cuma bisa dijalanin dari terminal dan sekali jalan buat semua tester.
 *
 *   - Cuma INSERT, gak pernah hapus/ubah punya tester.
 *   - Idempoten: sesi dicocokin lewat judul, jadi diulang gak bikin dobel.
 *   - `score` di-reset null biar di akun tester muncul "belum dikerjain",
 *     bukan ke-warisan nilai owner.
 *
 *   node scripts/salin-materi-ke-tester.mjs            # dry-run
 *   node scripts/salin-materi-ke-tester.mjs --apply
 */

import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");

if (existsSync(".env.local")) {
  for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "").trim();
  }
}

const OWNER = "yusufnashirsyarifuddin@gmail.com";
const TESTER = [
  "azizatulaini70@gmail.com",
  "nbillasanda@gmail.com",
  "rukmanafaris@gmail.com",
  "yandip473@gmail.com",
];

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL.trim(), process.env.SUPABASE_SECRET_KEY.trim(), {
  auth: { persistSession: false },
});

/* auth.users gak bisa di-query lewat PostgREST — pakai admin API. */
async function daftarUser() {
  const peta = new Map();
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) peta.set((u.email ?? "").toLowerCase(), u.id);
    if (data.users.length < 200) return peta;
  }
}

const materiPunya = async uid => {
  const { data, error } = await sb
    .from("sessions")
    .select("level, category, title, image_url, total, ai_result")
    .eq("user_id", uid)
    .eq("ai_result->>kind", "materi");
  if (error) throw error;
  return data;
};

async function main() {
  const user = await daftarUser();
  const ownerId = user.get(OWNER);
  if (!ownerId) { console.error(`❌ owner ${OWNER} gak ketemu`); process.exit(1); }

  const sumber = await materiPunya(ownerId);
  console.log(`Sumber (${OWNER}): ${sumber.length} sesi materi\n`);

  for (const email of TESTER) {
    const uid = user.get(email);
    if (!uid) { console.log(`⚠️  ${email} — akun gak ketemu, dilewat`); continue; }

    const punya = new Set((await materiPunya(uid)).map(s => s.title));
    const kurang = sumber.filter(s => !punya.has(s.title));

    const perLevel = {};
    for (const s of kurang) perLevel[s.level] = (perLevel[s.level] ?? 0) + 1;
    const rincian = Object.entries(perLevel).sort().map(([k, v]) => `${k}:${v}`).join(" ") || "—";

    if (kurang.length === 0) {
      console.log(`✓  ${email.padEnd(30)} udah lengkap (${punya.size} sesi)`);
      continue;
    }

    if (APPLY) {
      /* dipecah biar payload-nya gak kegedean — ai_result tiap sesi tebal */
      for (let i = 0; i < kurang.length; i += 20) {
        const { error } = await sb.from("sessions").insert(
          kurang.slice(i, i + 20).map(s => ({
            user_id: uid,
            level: s.level,
            category: s.category,
            title: s.title,
            image_url: s.image_url,
            score: null,
            total: s.total,
            ai_result: s.ai_result,
          }))
        );
        if (error) { console.error(`❌ ${email}: ${error.message}`); process.exit(1); }
      }
    }
    console.log(`${APPLY ? "✅" : "→ "} ${email.padEnd(30)} ${punya.size} → ${punya.size + kurang.length} sesi (+${kurang.length}: ${rincian})`);
  }

  if (!APPLY) console.log("\n[DRY-RUN] Jalanin lagi dengan --apply buat nulis.");
}

main().catch(e => { console.error(e); process.exit(1); });
