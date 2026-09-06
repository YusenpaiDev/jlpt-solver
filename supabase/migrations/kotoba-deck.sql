-- ============================================================
-- Betulin cara ringkas_kotoba() nentuin level sebuah kata.
--
-- Versi pertama pakai kolom kotoba_progress.level, yang diisi "deck tempat
-- kamu latihan" (dan buat baris lama: deck dengan level TERENDAH). Itu salah
-- kaprah: halaman Kotoba ngitungnya dengan MENYUSURI DECK — dia jalan di
-- 2.180 kata deck N2 dan cek progres tiap kata (lihat kotoba/page.tsx:145).
--
-- Bedanya kelihatan di kata yang nongol di lebih dari satu deck — ada 342.
-- Contoh: 勝つ ada di deck N4 DAN N2. Halaman Kotoba ngitung dia di dua-duanya;
-- versi lama cuma ngitung sekali, di N4. Hasilnya dua halaman kasih angka beda
-- buat hal yang sama.
--
-- Jadi keanggotaan deck dipindah ke DB, dan ringkasannya nge-join ke situ.
-- Sekarang satu kata bisa keitung di beberapa level — persis kayak decknya.
--
-- Jalanin di Supabase → SQL Editor → Run, lalu:
--   node scripts/seed-kotoba-deck.mjs --apply
-- ============================================================


-- ── Keanggotaan deck ─────────────────────────────────────────
-- 8.342 baris (jumlah semua deck). Diisi sekali lewat seed-kotoba-deck.mjs
-- dari src/data/kotoba/N*.json — file itu tetap gak ikut ke bundle browser.

create table if not exists public.kotoba_deck (
  level text not null check (level in ('N1','N2','N3','N4','N5')),
  word  text not null,
  primary key (level, word)
);

create index if not exists kotoba_deck_word_idx on public.kotoba_deck (word);

alter table public.kotoba_deck enable row level security;

-- Isinya daftar kosakata umum, bukan data pribadi — semua yang login boleh baca.
drop policy if exists "kotoba_deck: baca semua" on public.kotoba_deck;
create policy "kotoba_deck: baca semua" on public.kotoba_deck
  for select to authenticated using (true);


-- ── Ringkasan, sekarang lewat keanggotaan deck ───────────────
--
-- ⚠️ Ambang di sini WAJIB sama persis sama statDari() di
--    src/app/materi/kotoba/page.tsx:54. Kalau salah satu diubah, ubah
--    dua-duanya — kalau enggak, angka di dua halaman balik beda lagi.
--
--      salah > benar                → sering salah
--      benar >= 2 dan benar > salah → dikuasai
--      sisanya (udah pernah dinilai) → pernah muncul
--
-- `total_deck` ikut dibalikin biar app gak perlu nebak dari index.json — satu
-- sumber angka, dan otomatis ikut kalau decknya nanti berubah.

/* Postgres GAK ngizinin CREATE OR REPLACE ngubah tipe kembalian, dan versi ini
   nambah kolom total_deck (5 → 6 kolom). Tanpa drop duluan, migrasinya berhenti
   di "cannot change return type of existing function".

   Aman: yang dibuang cuma definisi fungsinya, bukan data. Dibikin ulang persis
   di bawah ini. */
drop function if exists public.ringkas_kotoba();

create or replace function public.ringkas_kotoba()
returns table (
  level         text,
  dikuasai      int,
  muncul        int,
  sering_salah  int,
  total_dilatih int,
  total_deck    int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    d.level,
    count(k.word) filter (where k.benar >= 2 and k.benar > k.salah)::int as dikuasai,
    count(k.word) filter (where k.salah <= k.benar
                            and not (k.benar >= 2 and k.benar > k.salah))::int as muncul,
    count(k.word) filter (where k.salah > k.benar)::int                  as sering_salah,
    count(k.word)::int                                                   as total_dilatih,
    count(*)::int                                                        as total_deck
  from public.kotoba_deck d
  left join public.kotoba_progress k
    on k.word = d.word and k.user_id = auth.uid()
  group by d.level;
$$;

grant execute on function public.ringkas_kotoba() to authenticated;
