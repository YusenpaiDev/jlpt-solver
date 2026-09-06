-- ============================================================
-- Batas paket Free — ditegakkan di DATABASE, bukan di UI.
--
-- Kenapa di sini: gerbang yang cuma disembunyiin di React gampang
-- diakalin (buka DevTools, panggil supabase-js sendiri). Kalau Pro mau
-- dijual, pembedanya harus yang gak bisa dilangkahi dari browser.
--
-- Jalanin di Supabase → SQL Editor → Run. Idempoten, aman diulang.
-- ============================================================


-- ── 1. Whitelist Pro pindah dari kode ke DB ──────────────────
--
-- Sebelumnya daftar email ini hidup di src/lib/access.ts, yang ke-bundle
-- ke JS dan kebaca SIAPA PUN yang buka app — 6 email pribadi kesebar
-- gratis. Di sini cuma kebaca server + pemiliknya sendiri.

create table if not exists public.pro_whitelist (
  email      text primary key,
  catatan    text,
  created_at timestamptz not null default now()
);

alter table public.pro_whitelist enable row level security;

-- Sengaja TANPA policy buat authenticated: cuma service role & fungsi
-- security-definer di bawah yang boleh ngintip. User gak perlu tau isinya.

insert into public.pro_whitelist (email, catatan) values
  ('yusufnashirsyarifuddin@gmail.com', 'owner'),
  ('sirbi269@gmail.com',               'akses gratis'),
  ('nbillasanda@gmail.com',            'tester'),
  ('yandip473@gmail.com',              'tester'),
  ('rukmanafaris@gmail.com',           'tester'),
  ('azizatulaini70@gmail.com',         'tester')
on conflict (email) do nothing;


-- ── 2. Entitlement: satu sumber kebenaran ────────────────────
-- Pro = flag bayar di profiles ATAU email ada di whitelist.

create or replace function public.is_pro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select p.is_premium from public.profiles p where p.id = auth.uid()), false)
    or exists (
      select 1
      from public.pro_whitelist w
      where lower(w.email) = lower((select u.email from auth.users u where u.id = auth.uid()))
    );
$$;

grant execute on function public.is_pro() to authenticated;


-- ── 3. Cap 50 kotoba buat Free ───────────────────────────────
--
-- Hitungannya dibungkus security-definer: kalau subquery-nya ditaruh
-- langsung di policy, dia kena RLS saved_words lagi → rekursi.

create or replace function public.jumlah_kotoba_saya()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.saved_words where user_id = auth.uid();
$$;

grant execute on function public.jumlah_kotoba_saya() to authenticated;

-- RESTRICTIVE, bukan permissive. Policy permissive itu di-OR sama policy
-- "saved_words: own" yang udah ada — malah bikin longgar. Restrictive di-AND.
drop policy if exists "saved_words: cap free" on public.saved_words;
create policy "saved_words: cap free" on public.saved_words
  as restrictive
  for insert
  to authenticated
  with check (public.is_pro() or public.jumlah_kotoba_saya() < 50);


-- ── 4. Kuota harian fitur AI ─────────────────────────────────
--
-- Dua guna sekaligus: pembeda Free vs Pro, DAN rem biaya. Tiap panggilan
-- ke Claude itu duit beneran, dan daftar akun terbuka — tanpa ini satu
-- orang iseng bisa ngabisin tagihan semalam.

create table if not exists public.ai_usage (
  user_id uuid    not null references auth.users(id) on delete cascade,
  tanggal date    not null default current_date,
  fitur   text    not null,
  jumlah  integer not null default 0,
  primary key (user_id, tanggal, fitur)
);

alter table public.ai_usage enable row level security;

-- Baca boleh (buat nampilin "sisa 3 chat hari ini"), NULIS gak boleh —
-- gak ada policy insert/update, jadi satu-satunya jalan naikin angka itu
-- lewat pakai_kuota() di bawah. User gak bisa nol-in kuotanya sendiri.
drop policy if exists "ai_usage: baca sendiri" on public.ai_usage;
create policy "ai_usage: baca sendiri" on public.ai_usage
  for select to authenticated using (auth.uid() = user_id);

/* Catat sekali pemakaian, balikin boleh/enggak.
   Naikin counter dan cek batas dalam SATU transaksi + FOR UPDATE, biar dua
   request barengan gak dua-duanya lolos di angka batas. */
create or replace function public.pakai_kuota(p_fitur text, p_batas integer)
returns table (boleh boolean, terpakai integer, batas integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n   integer;
begin
  if uid is null then
    return query select false, 0, p_batas;
    return;
  end if;

  insert into public.ai_usage (user_id, tanggal, fitur, jumlah)
  values (uid, current_date, p_fitur, 0)
  on conflict (user_id, tanggal, fitur) do nothing;

  select a.jumlah into n
  from public.ai_usage a
  where a.user_id = uid and a.tanggal = current_date and a.fitur = p_fitur
  for update;

  if n >= p_batas then
    return query select false, n, p_batas;
    return;
  end if;

  update public.ai_usage a
  set jumlah = a.jumlah + 1
  where a.user_id = uid and a.tanggal = current_date and a.fitur = p_fitur;

  return query select true, n + 1, p_batas;
end;
$$;

grant execute on function public.pakai_kuota(text, integer) to authenticated;

/* Lihat sisa kuota tanpa ngabisin — buat nampilin di UI. */
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
      where a.user_id = auth.uid() and a.tanggal = current_date and a.fitur = p_fitur
    ), 0),
    p_batas;
$$;

grant execute on function public.sisa_kuota(text, integer) to authenticated;
