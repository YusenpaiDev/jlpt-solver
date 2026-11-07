-- Alasan ganti level target. Diisi /api/target/ganti (sesi user),
-- dibaca dasbor /admin (secret key).

create table if not exists public.ganti_target (
  id      uuid        primary key default gen_random_uuid(),
  user_id uuid        not null references auth.users(id) on delete cascade,
  dari    text        check (dari in ('N1', 'N2', 'N3', 'N4', 'N5')),
  ke      text        not null check (ke in ('N1', 'N2', 'N3', 'N4', 'N5')),
  alasan  text        not null check (char_length(alasan) between 5 and 500),
  dibuat  timestamptz not null default now()
);

create index if not exists ganti_target_user_idx on public.ganti_target (user_id, dibuat desc);
create index if not exists ganti_target_dibuat_idx on public.ganti_target (dibuat desc);

alter table public.ganti_target enable row level security;

-- User cuma bisa nambah & lihat punyanya sendiri (lihat = buat batas 5x sehari).
-- Gak ada update/delete: catatan alasan gak bisa diubah belakangan.
drop policy if exists "ganti_target: tambah sendiri" on public.ganti_target;
create policy "ganti_target: tambah sendiri" on public.ganti_target
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "ganti_target: baca sendiri" on public.ganti_target;
create policy "ganti_target: baca sendiri" on public.ganti_target
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.ganti_target from anon;
