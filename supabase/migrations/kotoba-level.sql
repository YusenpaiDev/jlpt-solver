-- ============================================================
-- Penguasaan Kotoba masuk ke halaman Statistik.
--
-- Masalahnya: `kotoba_progress` cuma nyimpen `word`, gak nyimpen level.
-- Halaman Kotoba tau levelnya cuma karena dia muat deck per level. Kalau
-- Statistik harus nyocokin sendiri, dia mesti muat 5 deck (~2,3 MB) ke bundle
-- browser cuma buat ngitung angka.
--
-- Jadi datanya yang dibikin bawa levelnya sendiri, dan ringkasannya dihitung
-- di sini — Statistik cukup manggil ringkas_kotoba() sekali.
--
-- Jalanin di Supabase → SQL Editor → Run. Idempoten, aman diulang.
-- ============================================================


-- ── 1. Kolom level ───────────────────────────────────────────
-- Nullable: baris lama diisi belakangan lewat
-- scripts/backfill-kotoba-level.mjs (yang boleh baca deck lokal sepuasnya).

alter table public.kotoba_progress
  add column if not exists level text;

create index if not exists kotoba_progress_user_level_idx
  on public.kotoba_progress (user_id, level);


-- ── 2. catat_kotoba terima level ─────────────────────────────
-- p_level dikasih default null biar pemanggil lama (yang cuma kirim 2
-- argumen) gak langsung pecah pas migrasi jalan tapi app belum ke-deploy.
--
-- Level ditulis pas baris dibuat, dan di-update cuma kalau sebelumnya kosong.
-- Kata yang sama gak pindah level; kalau nanti ada kata nongol di dua deck,
-- yang pertama kecatat itu yang dipegang — bukan yang terakhir dilatih.

-- ⚠️ CREATE OR REPLACE cuma nimpa kalau TANDA TANGANnya sama persis. Nambah
--    p_level bikin tanda tangan baru, jadi versi 2-argumen yang lama TETAP ADA
--    dan panggilan 2 argumen jadi ambigu ("could not choose the best candidate").
--    Versi lamanya dibuang di _URGENT-catat-kotoba-ambigu.sql.
create or replace function public.catat_kotoba(
  p_word  text,
  p_benar boolean,
  p_level text default null
)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.kotoba_progress (user_id, word, level, benar, salah, riwayat, updated_at)
  values (
    auth.uid(), p_word, p_level,
    case when p_benar then 1 else 0 end,
    case when p_benar then 0 else 1 end,
    array[p_benar],
    now()
  )
  on conflict (user_id, word) do update set
    level      = coalesce(public.kotoba_progress.level, excluded.level),
    benar      = public.kotoba_progress.benar + case when p_benar then 1 else 0 end,
    salah      = public.kotoba_progress.salah + case when p_benar then 0 else 1 end,
    riwayat    = (array[p_benar] || public.kotoba_progress.riwayat)[1:5],
    updated_at = now();
$$;

grant execute on function public.catat_kotoba(text, boolean, text) to authenticated;


-- ── 3. Ringkasan per level ───────────────────────────────────
--
-- ⚠️ Ambang di sini WAJIB sama persis sama statDari() di
--    src/app/materi/kotoba/page.tsx. Kalau salah satu diubah, ubah dua-duanya
--    — kalau enggak, angka di Statistik gak bakal cocok sama yang keliatan di
--    halaman Kotoba, dan itu jenis bug yang lama banget ketahuannya.
--
--      salah > benar               → sering salah
--      benar >= 2 dan benar > salah → dikuasai
--      sisanya (udah pernah dinilai) → pernah muncul
--
-- "belum" gak diitung di sini: totalnya ada di src/data/kotoba/index.json,
-- dan yang tau angka itu cuma sisi app.

create or replace function public.ringkas_kotoba()
returns table (level text, dikuasai int, muncul int, sering_salah int, total_dilatih int)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(k.level, '?')                                                        as level,
    count(*) filter (where k.benar >= 2 and k.benar > k.salah)::int               as dikuasai,
    count(*) filter (where k.salah <= k.benar and not (k.benar >= 2 and k.benar > k.salah))::int as muncul,
    count(*) filter (where k.salah > k.benar)::int                                as sering_salah,
    count(*)::int                                                                 as total_dilatih
  from public.kotoba_progress k
  where k.user_id = auth.uid()
  group by coalesce(k.level, '?');
$$;

grant execute on function public.ringkas_kotoba() to authenticated;
