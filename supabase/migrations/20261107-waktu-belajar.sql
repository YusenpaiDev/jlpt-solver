-- Lama belajar per hari (detik). Dicatat oleh <PencatatWaktu> di halaman belajar.
--
-- Tabel sendiri, bukan kolom di aktivitas_harian: baris di aktivitas_harian
-- = hari streak. Kalau cuma buka halaman ikut bikin baris, streak jadi naik
-- tanpa ngerjain apa-apa.

create table if not exists public.waktu_belajar (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  tanggal    date        not null,
  detik      integer     not null default 0 check (detik between 0 and 86400),
  diperbarui timestamptz not null default now(),
  primary key (user_id, tanggal)
);

alter table public.waktu_belajar enable row level security;

drop policy if exists "waktu_belajar: baca sendiri" on public.waktu_belajar;
create policy "waktu_belajar: baca sendiri" on public.waktu_belajar
  for select to authenticated using (auth.uid() = user_id);

-- Sengaja gak ada policy INSERT/UPDATE: satu-satunya jalan nulis itu lewat
-- catat_waktu() di bawah.


-- ── Tambah detik belajar ──────────────────────────
--
-- p_tanggal dari client (tanggal lokal), alasan sama dengan catat_aktivitas().
-- Tanggal yang jauh dari hari ini ditolak.
--
-- Tambahan dibatasi oleh waktu yang benar-benar lewat sejak update terakhir
-- (+5 detik toleransi). Jadi buka banyak tab atau nembak RPC berulang gak
-- bisa bikin sejam jadi tiga jam.

create or replace function public.catat_waktu(p_tanggal date, p_detik integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_detik is null or p_detik <= 0 then
    return;
  end if;
  if p_tanggal < current_date - 1 or p_tanggal > current_date + 1 then
    return;
  end if;

  insert into public.waktu_belajar as w (user_id, tanggal, detik, diperbarui)
  values (auth.uid(), p_tanggal, least(p_detik, 300), now())
  on conflict (user_id, tanggal) do update set
    detik = least(
      w.detik + least(
        p_detik,
        300,
        greatest(0, floor(extract(epoch from now() - w.diperbarui))::int + 5)
      ),
      86400
    ),
    diperbarui = now();
end;
$$;

revoke all on function public.catat_waktu(date, integer) from public, anon;
grant execute on function public.catat_waktu(date, integer) to authenticated;
