-- Kurikulum 26 minggu (HANDOFF-kurikulum §2). Semua fitur di app masih di
-- belakang flag feature_live.* (src/lib/kurikulum-config.ts), jadi migration ini
-- aman dijalanin duluan: tabelnya cuma keisi begitu flag dinyalain.
--
-- Isi: posisi kurikulum per user, jadwal ulang (SRS) per kata/pola, tingkat
-- per jenis soal, hasil ulangan mingguan, hasil simulasi, laporan soal, dan
-- satu fungsi buat ngambil soal acak dari katalog Bank Soal (tes penempatan).
--
-- Jalanin di Supabase → SQL Editor → Run. Idempoten, aman diulang.

-- ── Posisi kurikulum ──────────────────────────────────────
create table if not exists public.kurikulum_user (
  user_id       uuid        primary key references auth.users(id) on delete cascade,
  level         text        not null check (level in ('N1', 'N2', 'N3', 'N4', 'N5')),
  tanggal_mulai date        not null,
  unit_mulai    integer     not null default 1 check (unit_mulai between 1 and 26),
  jumlah_unit   integer     not null default 26 check (jumlah_unit = 26),
  tanggal_ujian date,
  penempatan    jsonb,      -- hasil tes penempatan terakhir (per bagian, tanggal)
  diperbarui    timestamptz not null default now()
);

-- ── Jadwal ulang per kata / pola ──────────────────────────
create table if not exists public.item_status (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  jenis       text        not null check (jenis in ('kata', 'pola')),
  kunci       text        not null check (char_length(kunci) between 1 and 120),
  level       text        not null check (level in ('N1', 'N2', 'N3', 'N4', 'N5')),
  status      text        not null default 'baru' check (status in ('baru', 'belajar', 'hafal', 'dikuasai')),
  tahap       integer     not null default 0 check (tahap between 0 and 5),
  jatuh_tempo date,
  diperbarui  timestamptz not null default now(),
  primary key (user_id, jenis, kunci)
);
create index if not exists item_status_tempo on public.item_status (user_id, jatuh_tempo);

-- ── Tingkat T1–T3 per jenis soal (20 jawaban terakhir) ────
create table if not exists public.tingkat_jenis_soal (
  user_id       uuid        not null references auth.users(id) on delete cascade,
  jenis         text        not null check (char_length(jenis) between 1 and 20),
  tingkat       integer     not null default 1 check (tingkat between 1 and 3),
  riwayat       boolean[]   not null default '{}' check (coalesce(array_length(riwayat, 1), 0) <= 20),
  berlaku_mulai date,
  diperbarui    timestamptz not null default now(),
  primary key (user_id, jenis)
);

-- ── Ulangan mingguan (gantiin tes mini) ───────────────────
create table if not exists public.ulangan (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  minggu     date        not null check (extract(isodow from minggu) = 1),  -- Senin
  unit       integer     not null check (unit between 1 and 26),
  benar      integer     not null check (benar >= 0),
  total      integer     not null check (total between 1 and 60 and benar <= total),
  per_bagian jsonb       not null default '{}',
  item_lupa  jsonb       not null default '[]',
  dibuat     timestamptz not null default now(),
  primary key (user_id, minggu)
);

-- ── Simulasi bulanan ──────────────────────────────────────
create table if not exists public.simulasi (
  user_id   uuid        not null references auth.users(id) on delete cascade,
  n         integer     not null check (n between 1 and 12),
  tanggal   date        not null,
  sesi      uuid[]      not null default '{}',
  skor      jsonb,      -- [{k, nilai, max}] begitu semua bagian selesai
  menit     jsonb,      -- {筆記: menit, 聴解: menit}
  dibuat    timestamptz not null default now(),
  primary key (user_id, n)
);

-- ── RLS: tiap user cuma baca & nulis barisnya sendiri ─────
do $$
declare t text;
begin
  foreach t in array array['kurikulum_user', 'item_status', 'tingkat_jenis_soal', 'ulangan', 'simulasi'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: milik sendiri" on public.%I', t, t);
    execute format('create policy "%s: milik sendiri" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
  end loop;
end $$;

-- ── Laporan soal (cuma soal orisinal) ─────────────────────
-- User cuma bisa kirim & lihat laporannya sendiri; admin baca lewat service role.
create table if not exists public.laporan_soal (
  id       bigint      generated always as identity primary key,
  user_id  uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  soal_id  text        not null check (char_length(soal_id) between 1 and 80),
  alasan   text        not null check (alasan in ('kunci_salah', 'dua_benar', 'bahasa_aneh', 'lainnya')),
  catatan  text        check (char_length(catatan) <= 1000),
  waktu    timestamptz not null default now()
);
alter table public.laporan_soal enable row level security;
drop policy if exists "laporan_soal: kirim sendiri" on public.laporan_soal;
create policy "laporan_soal: kirim sendiri" on public.laporan_soal
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "laporan_soal: baca sendiri" on public.laporan_soal;
create policy "laporan_soal: baca sendiri" on public.laporan_soal
  for select to authenticated using (auth.uid() = user_id);
revoke all on table public.laporan_soal from anon;
grant select, insert on table public.laporan_soal to authenticated;


-- ── Soal acak dari katalog Bank Soal (tes penempatan 読解) ─
create or replace function public.soal_katalog(p_level text, p_kategori text, p_n integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  hasil jsonb;
begin
  if auth.uid() is null then
    raise exception 'Belum login' using errcode = '28000';
  end if;
  if not public.has_learning_access() then
    raise exception 'subscription_required' using errcode = '42501';
  end if;
  if p_level not in ('N1', 'N2', 'N3', 'N4', 'N5') or p_kategori not in ('文字', '語彙', '文法', '読解') then
    raise exception 'Parameter gak valid' using errcode = '22023';
  end if;
  if p_n is null or p_n < 1 or p_n > 20 then
    raise exception 'Jumlah soal gak valid' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(e), '[]'::jsonb) into hasil from (
    select jsonb_build_object(
      'question', e->>'question', 'options', e->'options', 'correct', e->>'correct',
      'passage', e->>'passage', 'category', e->>'category'
    ) as e
    from public.katalog_materi k, jsonb_array_elements(k.ai_result->'questions') e
    where k.level = p_level and k.ready
      and coalesce(k.section, k.ai_result->>'section', '') <> 'choukai'
      and e->>'category' = p_kategori
      and coalesce((e->>'needs_review')::boolean, false) = false
      and coalesce(e->>'question', '') <> ''
      and jsonb_typeof(e->'options') = 'array'
    order by random()
    limit p_n
  ) x;
  return hasil;
end;
$$;

revoke all on function public.soal_katalog(text, text, integer) from public, anon;
grant execute on function public.soal_katalog(text, text, integer) to authenticated;
