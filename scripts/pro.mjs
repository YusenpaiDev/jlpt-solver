#!/usr/bin/env node
/**
 * Kelola akses Pro manual — buat pelanggan yang bayar lewat transfer, sebelum
 * gerbang pembayaran otomatis ada.
 *
 *   node scripts/pro.mjs                              # daftar semua yang Pro
 *   node scripts/pro.mjs kasih orang@mail.com "bayar 129rb, 6 Sep 2026, sampai 6 Okt"
 *   node scripts/pro.mjs cabut orang@mail.com
 *
 * Catatan penting: `pro_whitelist` GAK punya masa berlaku — sekali masuk, Pro
 * selamanya sampai dicabut manual. Makanya kolom `catatan` dipakai buat nyimpen
 * tanggal bayar & sampai kapan. Isi terus, kalau enggak bulan depan kamu gak
 * bakal inget siapa yang udah abis masanya.
 */

import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) {
  for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "").trim();
  }
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL.trim(),
  process.env.SUPABASE_SECRET_KEY.trim(),
  { auth: { persistSession: false } }
);

const [aksi, emailArg, ...sisa] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
const catatan = sisa.join(" ").trim();

async function daftar() {
  const { data: wl, error } = await sb.from("pro_whitelist").select("email, catatan, created_at").order("created_at");
  if (error) { console.error("❌", error.message); process.exit(1); }

  const { data: { users } } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  const punyaAkun = new Set(users.map(u => (u.email ?? "").toLowerCase()));

  const { data: bayar } = await sb.from("profiles").select("id, is_premium").eq("is_premium", true);

  console.log(`Pro lewat whitelist (${wl.length}):`);
  for (const r of wl) {
    const tanda = punyaAkun.has(r.email) ? "✓" : "⚠ belum daftar";
    console.log(`  ${tanda.padEnd(14)} ${r.email.padEnd(34)} ${r.catatan ?? "—"}`);
  }
  console.log(`\nPro lewat flag is_premium (hasil bayar otomatis): ${bayar?.length ?? 0}`);
}

async function kasih() {
  if (!email) { console.error("Pakai: node scripts/pro.mjs kasih orang@mail.com \"catatan\""); process.exit(1); }
  if (!catatan) console.warn("⚠️  Tanpa catatan. Isi tanggal bayar & masa berlaku — gak ada kolom expiry di DB.\n");

  const { data: { users } } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  const ada = users.some(u => (u.email ?? "").toLowerCase() === email);

  const { error } = await sb.from("pro_whitelist").upsert({ email, catatan: catatan || null }, { onConflict: "email" });
  if (error) { console.error("❌", error.message); process.exit(1); }

  console.log(`✅ ${email} sekarang Pro.`);
  console.log(ada
    ? "   Akunnya udah ada — efeknya langsung kena begitu dia refresh."
    : "   Dia BELUM punya akun. Suruh daftar pakai email ini persis, nanti otomatis Pro.");
}

async function cabut() {
  if (!email) { console.error("Pakai: node scripts/pro.mjs cabut orang@mail.com"); process.exit(1); }
  const { error } = await sb.from("pro_whitelist").delete().eq("email", email);
  if (error) { console.error("❌", error.message); process.exit(1); }
  console.log(`✅ ${email} dicabut dari whitelist.`);
  console.log("   Kalau dia juga punya flag is_premium=true, itu terpisah — cek lewat `daftar`.");
}

const perintah = { kasih, cabut, daftar };
await (perintah[aksi] ?? daftar)();
