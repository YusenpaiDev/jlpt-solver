-- Fondasi biar latihan/choukai bisa NYIMPEN skor & progres ke tabel sessions.
-- Jalanin di Supabase → SQL Editor → Run. Aman & idempoten.
--
-- Kenapa perlu: player nge-UPDATE row sessions (score, ai_result.stats, progres).
-- Kalau RLS sessions gak punya policy UPDATE, update-nya gagal DIAM-DIAM
-- (kode nge-catch error), jadi Statistik/Riwayat kelihatan kosong terus.
-- Policy ini cuma ngizinin user nge-update SESI MILIKNYA SENDIRI.

drop policy if exists "sessions_update_own" on sessions;
create policy "sessions_update_own" on sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- (opsional, kalau belum ada) pastikan bisa baca & insert sesi sendiri juga:
drop policy if exists "sessions_select_own" on sessions;
create policy "sessions_select_own" on sessions
  for select using (auth.uid() = user_id);

drop policy if exists "sessions_insert_own" on sessions;
create policy "sessions_insert_own" on sessions
  for insert with check (auth.uid() = user_id);
