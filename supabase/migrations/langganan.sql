-- ============================================================
-- Layar langganan (HANDOFF-pembayaran): dua hal.
--
--   1. Pengingat perpanjangan bisa dimatiin dari /langganan/berhenti.
--      Kolom ini CUMA mematikan peringatan H-7/H-3/H-1 — masa berlaku Pro
--      gak disentuh, gak ada status "dibatalkan".
--
--   2. Kuota harian dihitung per tanggal WIB. Sebelumnya pakai current_date,
--      yang di Supabase ikut UTC — artinya jatah reset jam 07:00 WIB,
--      padahal semua layar bilang "reset 00:00 WIB".
--
-- Jalanin di Supabase → SQL Editor → Run. Idempoten, aman diulang.
-- ============================================================


-- ── 1. Pengingat perpanjangan ────────────────────────────────

alter table public.profiles
  add column if not exists renewal_reminders_enabled boolean not null default true;

-- kunci-profil.sql nyabut izin UPDATE semua kolom dan cuma ngasih balik
-- kolom tertentu. Kolom ini ditulis dari browser, jadi wajib di-grant —
-- kalau nggak, toggle-nya ditolak "permission denied".
grant update (renewal_reminders_enabled) on public.profiles to authenticated;


-- ── 2. Kuota per tanggal WIB ─────────────────────────────────

alter table public.ai_usage
  alter column tanggal set default (now() at time zone 'Asia/Jakarta')::date;

create or replace function public.pakai_kuota(p_fitur text, p_batas integer)
returns table (boleh boolean, terpakai integer, batas integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  hari date := (now() at time zone 'Asia/Jakarta')::date;
  n    integer;
begin
  if uid is null then
    return query select false, 0, p_batas;
    return;
  end if;

  insert into public.ai_usage (user_id, tanggal, fitur, jumlah)
  values (uid, hari, p_fitur, 0)
  on conflict (user_id, tanggal, fitur) do nothing;

  select a.jumlah into n
  from public.ai_usage a
  where a.user_id = uid and a.tanggal = hari and a.fitur = p_fitur
  for update;

  if n >= p_batas then
    return query select false, n, p_batas;
    return;
  end if;

  update public.ai_usage a
  set jumlah = a.jumlah + 1
  where a.user_id = uid and a.tanggal = hari and a.fitur = p_fitur;

  return query select true, n + 1, p_batas;
end;
$$;

grant execute on function public.pakai_kuota(text, integer) to authenticated;

create or replace function public.sisa_kuota(p_fitur text, p_batas integer)
returns table (terpakai integer, batas integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((
      select a.jumlah from public.ai_usage a
      where a.user_id = auth.uid()
        and a.tanggal = (now() at time zone 'Asia/Jakarta')::date
        and a.fitur = p_fitur
    ), 0),
    p_batas;
$$;

grant execute on function public.sisa_kuota(text, integer) to authenticated;


-- Cek: harusnya 5 baris — avatar_url, renewal_reminders_enabled,
-- target_level, username, xp.
select column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee = 'authenticated' and privilege_type = 'UPDATE'
order by column_name;
