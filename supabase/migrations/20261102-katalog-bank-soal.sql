-- Katalog Bank Soal bersama. Dulu set ujian cuma ada sebagai SALINAN per akun
-- (scripts/salin-materi-ke-tester.mjs) — akun di luar owner + tester buka
-- /materi dan dapet "Belum ada set ujian", termasuk yang udah bayar Pro.
--
-- Sekarang: set disimpan SEKALI di katalog_materi (diisi scripts/sinkron-katalog.mjs
-- dari akun owner, field progres pribadi dibuang). Browser gak bisa baca tabelnya
-- langsung — RLS nyala tanpa policy. Aksesnya lewat dua fungsi:
--   daftar_katalog() → daftar set tanpa isi soal, buat semua user yang login
--   ambil_set(id)    → bikin salinan set itu ke akun pemanggil (sekali, pas
--                       pertama dibuka) lalu balikin id sesinya. Player soal
--                       tetap kerja di sesi milik user kayak sebelumnya.
-- Aman diulang.
create table if not exists public.katalog_materi (
  id          uuid primary key default gen_random_uuid(),
  level       text not null,
  category    text,
  title       text not null unique,
  section     text,
  total       integer not null default 0,
  ready       boolean not null default true,
  ai_result   jsonb not null,
  diperbarui  timestamptz not null default now()
);
alter table public.katalog_materi enable row level security;
revoke all on public.katalog_materi from anon, authenticated;

create or replace function public.daftar_katalog()
returns table (id uuid, level text, title text, section text, total integer, ready boolean)
language sql stable security definer set search_path = '' as $$
  select k.id, k.level, k.title, k.section, k.total, k.ready
  from public.katalog_materi k
  where auth.uid() is not null
  order by k.level, k.title;
$$;
revoke all on function public.daftar_katalog() from public;
grant execute on function public.daftar_katalog() to authenticated;

create or replace function public.ambil_set(p_katalog uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  k   public.katalog_materi;
  sid uuid;
begin
  if uid is null then
    raise exception 'Belum login' using errcode = '28000';
  end if;
  if not public.has_learning_access() then
    raise exception 'subscription_required' using errcode = '42501';
  end if;
  select * into k from public.katalog_materi where id = p_katalog;
  if not found or not k.ready then
    raise exception 'Set gak tersedia' using errcode = 'P0002';
  end if;
  -- Klik dobel / dua tab barengan gak boleh bikin dua salinan.
  perform pg_advisory_xact_lock(hashtext(uid::text || '|' || k.title));
  select s.id into sid from public.sessions s
    where s.user_id = uid and s.title = k.title and s.ai_result->>'kind' = 'materi'
    order by s.created_at
    limit 1;
  if sid is null then
    insert into public.sessions (user_id, level, category, title, total, score, ai_result)
      values (uid, k.level, k.category, k.title, k.total, null, k.ai_result)
      returning id into sid;
  end if;
  return sid;
end;
$$;
revoke all on function public.ambil_set(uuid) from public;
grant execute on function public.ambil_set(uuid) to authenticated;
