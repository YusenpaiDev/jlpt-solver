-- Tabel progress drill Bunpou (per user, per pola). Jalanin di Supabase SQL Editor.
-- Dipakai halaman /materi/bunpou buat status "dikuasai / sering salah / pernah muncul".

create table if not exists bunpou_progress (
  user_id    uuid not null references auth.users(id) on delete cascade,
  pattern    text not null,
  benar      int  not null default 0,
  salah      int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, pattern)
);

alter table bunpou_progress enable row level security;

drop policy if exists "bp_progress_select_own" on bunpou_progress;
create policy "bp_progress_select_own" on bunpou_progress
  for select using (auth.uid() = user_id);

drop policy if exists "bp_progress_insert_own" on bunpou_progress;
create policy "bp_progress_insert_own" on bunpou_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "bp_progress_update_own" on bunpou_progress;
create policy "bp_progress_update_own" on bunpou_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
