-- ============================================================
-- Streak: dari penghitung yang disimpan → turunan aktivitas nyata.
--
-- Yang rusak sebelumnya:
--   1. Kode penaiknya ada di <Sidebar>, dan Sidebar GAK dirender halaman mana
--      pun. Jadi profiles.streak gak pernah naik sama sekali — angka yang
--      kelihatan di header itu fosil dari terakhir kali kode itu jalan.
--   2. Yang dihitung "buka app", bukan "belajar". Buka halaman terus nutup lagi
--      tetap nambah streak.
--   3. Tanggalnya dari toISOString() = UTC. Di WIB (+7) jam 00:00–07:00 masih
--      kebaca tanggal kemarin, jadi streak bisa putus padahal orangnya latihan.
--   4. Statistik ngitung "streak terpanjang" sendiri dari tabel sessions —
--      sumber beda, angka beda, dua-duanya ngaku "streak".
--
-- Sekarang: tiap kali user beneran ngerjain sesuatu, harinya dicatat. Streak
-- dihitung dari deretan hari itu. Header & Statistik baca fungsi yang sama.
--
-- Jalanin di Supabase → SQL Editor → Run.
-- ============================================================


-- ── Hari-hari yang ada aktivitas ─────────────────────────────
-- Satu baris per user per hari. `jumlah` buat "hari tersibuk", `sumber` buat
-- tau dia latihan lewat apa.

create table if not exists public.aktivitas_harian (
  user_id uuid    not null references auth.users(id) on delete cascade,
  tanggal date    not null,
  jumlah  integer not null default 0,
  sumber  text[]  not null default '{}',
  primary key (user_id, tanggal)
);

create index if not exists aktivitas_harian_user_idx
  on public.aktivitas_harian (user_id, tanggal desc);

alter table public.aktivitas_harian enable row level security;

drop policy if exists "aktivitas_harian: baca sendiri" on public.aktivitas_harian;
create policy "aktivitas_harian: baca sendiri" on public.aktivitas_harian
  for select to authenticated using (auth.uid() = user_id);

-- Sengaja gak ada policy INSERT/UPDATE: satu-satunya jalan nulis itu lewat
-- catat_aktivitas() di bawah. Streak gak bisa dikarang dari browser.


-- ── Catat satu aktivitas ─────────────────────────────────────
--
-- p_tanggal dikirim CLIENT, bukan pakai current_date. Server gak tau zona waktu
-- user, dan current_date itu UTC — buat orang WIB, latihan jam 1 pagi bakal
-- kecatat di hari sebelumnya dan streaknya putus padahal dia rajin.
--
-- Konsekuensinya tanggalnya bisa dikarang dari browser. Buat streak belajar
-- itu pertukaran yang wajar: yang dirugiin cuma dirinya sendiri.

-- security DEFINER, bukan invoker. Tabelnya sengaja gak punya policy INSERT
-- biar streak gak bisa dikarang lewat supabase-js langsung — tapi itu berarti
-- fungsi ini pun kena blokir kalau jalan sebagai user. Sebagai definer dia
-- lewat RLS, dan auth.uid() tetap kebaca dari JWT jadi barisnya tetap nempel
-- ke user yang bener.
create or replace function public.catat_aktivitas(p_tanggal date, p_sumber text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.aktivitas_harian (user_id, tanggal, jumlah, sumber)
  values (auth.uid(), p_tanggal, 1, array[p_sumber])
  on conflict (user_id, tanggal) do update set
    jumlah = public.aktivitas_harian.jumlah + 1,
    sumber = case
               when p_sumber = any(public.aktivitas_harian.sumber)
                 then public.aktivitas_harian.sumber
               else public.aktivitas_harian.sumber || p_sumber
             end;
$$;

grant execute on function public.catat_aktivitas(date, text) to authenticated;


-- ── Hitung streak ────────────────────────────────────────────
--
-- p_hari_ini juga dari client, alasan yang sama.
--
-- "sekarang" toleran satu hari: kalau hari ini belum latihan tapi kemarin udah,
-- streaknya BELUM putus — dia masih punya sisa hari ini buat nyambung. Kalau
-- dianggap putus jam 00:01, orang yang biasa latihan malam bakal lihat
-- streaknya nol tiap pagi. Baru putus kalau kemarin pun kosong.

create or replace function public.streak_saya(p_hari_ini date)
returns table (sekarang int, terpanjang int, total_hari int, hari_ini_aktif boolean)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  hari    date[];
  n       int;
  i       int;
  cur     int := 0;
  best    int := 0;
  jalan   int := 0;
  mulai   date;
begin
  select array_agg(a.tanggal order by a.tanggal)
    into hari
  from public.aktivitas_harian a
  where a.user_id = auth.uid();

  if hari is null then
    return query select 0, 0, 0, false;
    return;
  end if;

  n := array_length(hari, 1);

  -- terpanjang: deretan hari berturut-turut yang paling panjang
  jalan := 1; best := 1;
  for i in 2..greatest(n, 1) loop
    if hari[i] = hari[i-1] + 1 then
      jalan := jalan + 1;
      if jalan > best then best := jalan; end if;
    else
      jalan := 1;
    end if;
  end loop;

  -- sekarang: mundur dari hari terakhir, TAPI cuma kalau deretannya masih
  -- nyambung ke hari ini atau kemarin
  mulai := hari[n];
  if mulai < p_hari_ini - 1 then
    cur := 0;
  else
    cur := 1;
    i := n;
    while i > 1 and hari[i-1] = hari[i] - 1 loop
      cur := cur + 1;
      i := i - 1;
    end loop;
  end if;

  return query select cur, best, n, (hari[n] = p_hari_ini);
end;
$$;

grant execute on function public.streak_saya(date) to authenticated;
