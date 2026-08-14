-- ═══════════════════════════════════════════════════════════════════
-- Tabel bank_soal — satu baris = satu soal
--
-- Kenapa perlu, padahal soalnya udah ada di sessions.ai_result:
--
--   1. sessions pakai RLS "own" — soal cuma kebaca sama akun yang import.
--      Temen yang dikasih PRO gratis bakal dapat layar kosong di Lembar Tugas.
--   2. Soalnya terkubur di dalam array JSONB. Ngambil 10 soal N2 文法 acak
--      berarti narik SEMUA sesi N2 (~2 MB) lalu disaring di memori, tiap klik.
--   3. Gak ada yang nyegah soal kembar masuk dua kali ke satu paket latihan.
--
-- Tabel ini nyelesaiin ketiganya: baca-untuk-semua, terindeks, dan sidik jari
-- unik bikin soal dobel MUSTAHIL masuk (bukan disaring belakangan).
--
-- Sesi asli gak disentuh — /materi, Riwayat Soal, dan Choukai tetap jalan.
-- Isinya dibangun ulang dari sessions lewat: node scripts/build-bank-soal.mjs
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.bank_soal (
  id             uuid primary key default gen_random_uuid(),
  -- asal soal, buat nelusur balik ke paket ujiannya
  session_id     uuid references public.sessions(id) on delete cascade,
  level          text not null check (level in ('N1','N2','N3','N4','N5')),
  -- 聴解 sengaja gak masuk: soalnya butuh audio + pemutar sendiri, dan
  -- Choukai udah punya halamannya. Kalau ikut, dia bakal nyelip ke paket
  -- "campuran" Lembar Tugas sebagai soal tanpa suara — mustahil dijawab.
  category       text not null check (category in ('文法','語彙','文字','読解')),
  question       text not null,
  options        jsonb not null,       -- ["1. の", "2. のこと", ...]
  correct        text not null,        -- "3" (1-indeks, cocokin ke options)
  explanation    text,
  why_wrong      text,
  grammar_points jsonb,
  tip            text,
  passage        text,                 -- bacaan 読解, null buat kategori lain
  -- md5(pertanyaan + opsi) yang udah dinormalisasi. Ini yang bikin kembaran
  -- ketolak di gerbang, bukan disaring pas dipakai.
  sidik_jari     text not null unique,
  created_at     timestamptz default now()
);

-- Lembar Tugas selalu nyaring level + kategori duluan.
create index if not exists bank_soal_level_category_idx
  on public.bank_soal (level, category);

alter table public.bank_soal enable row level security;

-- Baca: semua user yang login. Ini inti masalah nomor 1 di atas — bank soal
-- itu materi bersama, bukan milik satu akun.
drop policy if exists "bank_soal: baca semua" on public.bank_soal;
create policy "bank_soal: baca semua" on public.bank_soal
  for select to authenticated using (true);

-- Tulis: sengaja TANPA policy. Cuma service key (skrip build) yang bisa isi,
-- jadi user gak bisa nyuntik atau ngubah soal dari browser.

-- ── Pengambil soal acak ────────────────────────────────────────────
-- Diambil di database, bukan di Node: tanpa ini, "acak" berarti narik semua
-- baris ke server dulu baru diacak — persis masalah yang mau dihindari.
-- security invoker → tetap tunduk ke RLS di atas.
create or replace function public.ambil_soal_acak(
  p_level    text,
  p_kategori text default null,        -- null = campuran semua kategori
  p_jumlah   int  default 10
)
returns setof public.bank_soal
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from public.bank_soal
  where level = p_level
    and (p_kategori is null or category = p_kategori)
  order by random()
  limit greatest(1, least(coalesce(p_jumlah, 10), 50));
$$;

grant execute on function public.ambil_soal_acak(text, text, int) to authenticated;
