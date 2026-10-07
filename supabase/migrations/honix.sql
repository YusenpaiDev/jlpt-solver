-- ═══════════════════════════════════════════════════════════════════
-- Pengaturan Honix (maskot) — disimpan per akun, bukan per perangkat.
-- Lihat HANDOFF-honix §6 "Toggle".
--
-- Isi kolom (semua opsional — yang kosong jatuh ke default di kode):
--   { "suara": true, "reaksi": "normal" | "jarang" | "mati",
--     "gerakan": "normal" | "kurangi" | null }
--   gerakan null = ikut prefers-reduced-motion perangkat.
--
-- Selama migration ini belum dijalanin, kode tetap jalan: pengaturan cuma
-- kesimpan di localStorage perangkat itu.
--
-- Run di Supabase Dashboard → SQL Editor. Aman diulang.
-- ═══════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists honix_settings jsonb not null default '{}'::jsonb;

-- profiles dikunci per kolom (kunci-profil.sql) — kolom baru yang ditulis
-- dari browser WAJIB di-grant, kalau nggak update-nya ditolak diam-diam.
grant update (honix_settings) on public.profiles to authenticated;
