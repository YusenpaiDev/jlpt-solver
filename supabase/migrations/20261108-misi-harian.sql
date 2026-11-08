-- Misi harian (Rencana Belajar §3–4): langkah yang udah beres per hari,
-- misi penyelamat, dan jawaban "Dua hari gak ketemu. Lagi kenapa?".
--
-- Menit belajar tetap dari waktu_belajar, streak tetap dari aktivitas_harian.
-- Tabel ini cuma nyimpen progres misi, biar keluar di tengah → lanjut dari
-- langkah berikutnya, dan hari baru → misi baru (gak ditumpuk).
--
-- Jalanin di Supabase → SQL Editor → Run. Idempoten, aman diulang.

create table if not exists public.misi_harian (
  user_id            uuid        not null references auth.users(id) on delete cascade,
  tanggal            date        not null,
  -- langkah terakhir yang selesai: 0 belum mulai · 1 ulang · 2 materi baru · 3 latihan soal (= misi selesai)
  langkah            smallint    not null default 0 check (langkah between 0 and 3),
  penyelamat_selesai boolean     not null default false,
  alasan_bolong      text        check (alasan_bolong in ('sibuk', 'capek', 'lupa', 'susah', 'lain')),
  diperbarui         timestamptz not null default now(),
  primary key (user_id, tanggal)
);

alter table public.misi_harian enable row level security;

drop policy if exists "misi_harian: baca sendiri" on public.misi_harian;
create policy "misi_harian: baca sendiri" on public.misi_harian
  for select to authenticated using (auth.uid() = user_id);

-- Nulis cuma lewat catat_misi() di bawah.


-- ── Catat progres misi ───────────────────────────
--
-- p_tanggal dari client (tanggal lokal), sama kayak catat_aktivitas().
-- Langkah gak bisa mundur (greatest), dan tanggal yang jauh ditolak.
-- p_langkah / p_penyelamat / p_alasan boleh null = gak diubah.

create or replace function public.catat_misi(
  p_tanggal    date,
  p_langkah    integer default null,
  p_penyelamat boolean default null,
  p_alasan     text    default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_tanggal is null then
    return;
  end if;
  if p_tanggal < current_date - 1 or p_tanggal > current_date + 1 then
    return;
  end if;
  if p_langkah is not null and (p_langkah < 0 or p_langkah > 3) then
    return;
  end if;
  if p_alasan is not null and p_alasan not in ('sibuk', 'capek', 'lupa', 'susah', 'lain') then
    return;
  end if;

  insert into public.misi_harian as m (user_id, tanggal, langkah, penyelamat_selesai, alasan_bolong, diperbarui)
  values (auth.uid(), p_tanggal, coalesce(p_langkah, 0), coalesce(p_penyelamat, false), p_alasan, now())
  on conflict (user_id, tanggal) do update set
    langkah            = greatest(m.langkah, coalesce(p_langkah, 0)),
    penyelamat_selesai = m.penyelamat_selesai or coalesce(p_penyelamat, false),
    alasan_bolong      = coalesce(p_alasan, m.alasan_bolong),
    diperbarui         = now();
end;
$$;

revoke all on table public.misi_harian from anon;
revoke all on function public.catat_misi(date, integer, boolean, text) from public, anon;
grant execute on function public.catat_misi(date, integer, boolean, text) to authenticated;
