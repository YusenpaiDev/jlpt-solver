-- ============================================================
-- ⚠️ JALANIN SEKARANG — produksi lagi rusak.
--
-- kotoba-level.sql nambah p_level ke catat_kotoba pakai CREATE OR REPLACE.
-- Tapi nambah parameter itu ganti TANDA TANGAN fungsi, dan create-or-replace
-- cuma nimpa kalau tanda tangannya sama persis. Yang kejadian: versi lama gak
-- ketimpa, jadi sekarang ada DUA di database —
--
--     catat_kotoba(text, boolean)          ← lama
--     catat_kotoba(text, boolean, text)    ← baru, p_level default null
--
-- Kode yang lagi jalan di Vercel manggil pakai 2 argumen. Dua-duanya cocok
-- (yang baru lewat default-nya), jadi Postgres nolak milih:
--
--     Could not choose the best candidate function between: ...
--
-- Akibatnya tiap jawaban drill kotoba di produksi GAGAL kesimpen — diam-diam,
-- karena pemanggilnya gak ngecek error.
--
-- Buang yang lama. Panggilan 2 argumen bakal jatuh ke versi 3 argumen lewat
-- default-nya, jadi kode lama MAUPUN kode baru dua-duanya jalan.
--
-- Jalanin di Supabase → SQL Editor → Run.
-- ============================================================

drop function if exists public.catat_kotoba(text, boolean);

-- Pastiin yang bener masih ada & kepanggil (harusnya balik 1 baris).
select
  p.oid::regprocedure as tanda_tangan
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'catat_kotoba';
