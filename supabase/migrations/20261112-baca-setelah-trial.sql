-- Setelah masa percobaan habis (belum Premium): riwayat & progres lama tetap
-- BISA DILIHAT, yang dikunci cuma nambah / ubah / hapus.
--
-- Sebelumnya (20261011-trial-pro-unlimited.sql) satu policy restrictive
-- "for all" ngunci baca juga, jadi user yang trial-nya habis buka Progres /
-- Kamus / Catatan dan semuanya kelihatan kosong — kayak datanya hilang.
-- Sekarang dipecah per perintah tulis; baca balik ke policy kepemilikan biasa
-- (tetap cuma data milik sendiri). Gembok di app ngarahin ke Premium.
--
-- Aman dijalanin ulang. Jalanin di Supabase SQL Editor.

begin;

do $$
declare nama text;
begin
  foreach nama in array array['saved_words', 'sessions', 'catatan', 'kotoba_progress',
    'bunpou_progress', 'bank_soal', 'kotoba_deck', 'bunpou_patterns'] loop
    if to_regclass('public.' || nama) is not null then
      execute format('drop policy if exists "learning: active access" on public.%I', nama);
      execute format('drop policy if exists "learning: tambah butuh akses" on public.%I', nama);
      execute format('drop policy if exists "learning: ubah butuh akses" on public.%I', nama);
      execute format('drop policy if exists "learning: hapus butuh akses" on public.%I', nama);
      execute format('create policy "learning: tambah butuh akses" on public.%I as restrictive for insert to public with check ((select public.has_learning_access()))', nama);
      execute format('create policy "learning: ubah butuh akses" on public.%I as restrictive for update to public using ((select public.has_learning_access())) with check ((select public.has_learning_access()))', nama);
      execute format('create policy "learning: hapus butuh akses" on public.%I as restrictive for delete to public using ((select public.has_learning_access()))', nama);
    end if;
  end loop;
end;
$$;

commit;
