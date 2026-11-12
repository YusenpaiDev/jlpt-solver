-- XP (Lv Honix) ditambah di database, atomik. Dulu browser baca xp → tambah →
-- tulis: dua latihan yang kesimpan barengan bisa saling nimpa, dan kolom xp
-- bisa diisi angka apa aja dari browser. Habis ini kolom xp gak bisa diubah
-- langsung lagi; cuma lewat tambah_xp().
--
-- Aman dijalanin ulang. Jalanin di Supabase SQL Editor.

create or replace function public.tambah_xp(p_jumlah integer)
returns table (sebelum integer, sesudah integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Satu panggilan maksimal 1000 (satu set Bank Soal penuh ±755).
  n integer := least(greatest(coalesce(p_jumlah, 0), 0), 1000);
begin
  if auth.uid() is null then
    raise exception 'Belum login' using errcode = '28000';
  end if;
  return query
    update public.profiles p
       set xp = coalesce(p.xp, 0) + n
     where p.id = auth.uid()
    returning (p.xp - n)::integer, p.xp::integer;
end;
$$;

revoke all on function public.tambah_xp(integer) from public, anon;
grant execute on function public.tambah_xp(integer) to authenticated;

-- Kolom xp gak bisa diubah langsung dari browser lagi.
revoke update (xp) on public.profiles from authenticated;
