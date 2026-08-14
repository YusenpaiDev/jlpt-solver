#!/usr/bin/env node
/**
 * Kasih materi (paket ujian) ke user lain.
 *
 * Tabel sessions pakai RLS "own" — user cuma bisa lihat baris miliknya sendiri.
 * Jadi "ngasih materi" itu artinya nyalin barisnya ke user_id dia, bukan
 * ngasih izin baca. Salinannya berdiri sendiri: dia ngerjain punya dia, skor
 * dia gak nyampur sama punya kamu.
 *
 * Audio choukai ikut kebawa karena yang disimpan URL storage publik.
 *
 *   node scripts/beri-materi.mjs --email x@y.com --level N2 --cari 2025
 *   node scripts/beri-materi.mjs --email x@y.com --level N2 --cari 2025 --apply
 *
 * --cari  : dicocokin ke judul sesi (mis. "2025", "2025年7月", "聴解")
 * --semua : kasih semua paket di level itu, gak usah nyari
 */

import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}
loadEnvLocal();

const args = process.argv.slice(2);
const ambil = (nama, def = null) => {
  const i = args.indexOf(nama);
  return i !== -1 ? args[i + 1] : def;
};
const APPLY = args.includes("--apply");
const SEMUA = args.includes("--semua");
const EMAIL = ambil("--email");
const LEVEL = ambil("--level");
const CARI = ambil("--cari");

if (!EMAIL || !LEVEL || (!CARI && !SEMUA)) {
  console.error("Usage: node scripts/beri-materi.mjs --email x@y.com --level N2 --cari 2025 [--apply]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !key) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY gak ada di .env.local");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function cariUser(email) {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data?.users?.find(x => (x.email ?? "").toLowerCase() === email.toLowerCase());
    if (u) return u;
    if (!data?.users?.length || data.users.length < 200) return null;
  }
}

async function main() {
  const user = await cariUser(EMAIL);
  if (!user) { console.error(`❌ User ${EMAIL} gak ketemu.`); process.exit(1); }

  // Sumbernya paket materi milik siapa pun — biasanya akun owner yang ngimport.
  const { data: sumber, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("level", LEVEL)
    .eq("ai_result->>kind", "materi");
  if (error) { console.error("❌", error.message); process.exit(1); }

  const cocok = (sumber ?? [])
    .filter(s => s.user_id !== user.id)                      // jangan nyalin dari punya dia sendiri
    .filter(s => SEMUA || String(s.title).includes(CARI));

  // Judul yang udah dia punya — biar dijalanin dua kali gak numpuk.
  const { data: punyaDia } = await supabase
    .from("sessions").select("title").eq("user_id", user.id).eq("ai_result->>kind", "materi");
  const sudahAda = new Set((punyaDia ?? []).map(s => s.title));

  const baru = cocok.filter(s => !sudahAda.has(s.title));
  const dilewati = cocok.length - baru.length;

  console.log(`\n${APPLY ? "🔴 APPLY" : "🔍 DRY-RUN"}`);
  console.log(`Penerima : ${EMAIL}`);
  console.log(`Filter   : level ${LEVEL}${SEMUA ? " (semua paket)" : ` · judul memuat "${CARI}"`}\n`);

  if (cocok.length === 0) { console.log("Gak ada paket yang cocok."); return; }

  for (const s of baru) {
    const jenis = s.ai_result?.section === "choukai" ? "聴解" : "筆記";
    const audio = (s.ai_result?.questions ?? []).filter(q => q.audio).length;
    console.log(`  + ${jenis}  ${String(s.total).padStart(3)} soal${audio ? ` (${audio} beraudio)` : ""}  ${s.title.slice(0, 46)}`);
  }
  if (dilewati) console.log(`  · ${dilewati} paket dilewati — dia udah punya`);

  if (!APPLY) { console.log(`\nJalankan lagi dengan --apply buat nulis.`); return; }
  if (baru.length === 0) return;

  const salinan = baru.map(s => ({
    user_id: user.id,
    level: s.level,
    category: s.category,
    title: s.title,
    image_url: s.image_url ?? null,
    total: s.total,
    score: null,          // punya dia sendiri — mulai dari nol, bukan warisan skormu
    ai_result: s.ai_result,
  }));

  const { data: masuk, error: insErr } = await supabase.from("sessions").insert(salinan).select("id");
  if (insErr) { console.error("❌ gagal:", insErr.message); process.exit(1); }

  console.log(`\n✅ ${masuk?.length ?? 0} paket dikasih ke ${EMAIL}.`);
  console.log(`   Dia bakal lihat di /materi begitu login.`);
}

main().catch(e => { console.error("❌", e); process.exit(1); });
