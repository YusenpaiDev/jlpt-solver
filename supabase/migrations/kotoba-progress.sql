-- ═══════════════════════════════════════════════════════════════════
-- Tabel kotoba_progress — pelacakan hafalan per kata
--
-- Halaman Kotoba punya segmen "Dikuasai / Pernah muncul / Sering salah /
-- Belum" dan filter per status, tapi gak ada yang ngisi: statFor() balikin
-- "new" buat semua kata (jujur, tapi semua angkanya nol selamanya).
-- Flash mode-nya juga cuma bolak-balik kartu — gak ada tombol nilai-diri,
-- jadi gak ada sinyal yang bisa direkam.
--
-- Tabel ini yang jadi sumbernya. Diisi dari flash mode: tiap kartu dinilai
-- sendiri sama user ("Udah tau" / "Belum"), kesimpen di sini.
--
-- Run di Supabase Dashboard → SQL Editor. Aman diulang.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.kotoba_progress (
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- kata dalam bentuk aslinya (mis. 行きます) — cocokin ke kotoba-n2.json
  word       text not null,
  benar      integer not null default 0,
  salah      integer not null default 0,
  -- 5 percobaan terakhir, terbaru di depan. Dipakai buat titik riwayat
  -- di panel detail kata (dulu angkanya dikarang dari hash nama kata).
  riwayat    boolean[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, word)
);

create index if not exists kotoba_progress_user_idx
  on public.kotoba_progress (user_id);

alter table public.kotoba_progress enable row level security;

-- Progres hafalan itu milik pribadi — beda dari bank_soal yang materi bersama.
drop policy if exists "kotoba_progress: own" on public.kotoba_progress;
create policy "kotoba_progress: own" on public.kotoba_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Catat satu penilaian ───────────────────────────────────────────
-- Dipanggil dari flash mode. Nambah hitungan + geser riwayat, dalam satu
-- perjalanan ke server (kalau baca-ubah-tulis dari klien, dua kartu yang
-- dinilai cepat berturut-turut bisa saling nimpa).
create or replace function public.catat_kotoba(p_word text, p_benar boolean)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.kotoba_progress (user_id, word, benar, salah, riwayat, updated_at)
  values (
    auth.uid(), p_word,
    case when p_benar then 1 else 0 end,
    case when p_benar then 0 else 1 end,
    array[p_benar],
    now()
  )
  on conflict (user_id, word) do update set
    benar      = public.kotoba_progress.benar + case when p_benar then 1 else 0 end,
    salah      = public.kotoba_progress.salah + case when p_benar then 0 else 1 end,
    -- sisipin di depan, potong sisanya biar tetap 5
    riwayat    = (array[p_benar] || public.kotoba_progress.riwayat)[1:5],
    updated_at = now();
$$;

grant execute on function public.catat_kotoba(text, boolean) to authenticated;
