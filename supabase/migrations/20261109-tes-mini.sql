-- Tes mini mingguan (Rencana Belajar §9): sekali per minggu (Senin–Minggu),
-- 15 soal 筆記 campuran dari katalog Bank Soal level target:
-- 文字・語彙 6 · 文法 5 · 読解 4. Skor 聴解 diperkirakan di app dari latihan
-- 聴解 30 hari terakhir (soal audio gak ikut tes).
--
-- Soal disalin jadi sesi milik user (kayak ambil_set), jadi player Bank Soal
-- yang udah ada tinggal dipakai dan hasilnya kecatat di sessions.ai_result.stats.
-- Tabel tes_mini cuma nyatet minggu → sesi, buat "1× per minggu" dan
-- perbandingan sama minggu lalu.
--
-- Jalanin di Supabase → SQL Editor → Run. Idempoten, aman diulang.

create table if not exists public.tes_mini (
  user_id uuid        not null references auth.users(id) on delete cascade,
  minggu  date        not null,  -- Senin minggu itu (tanggal lokal user)
  sesi_id uuid        not null references public.sessions(id) on delete cascade,
  level   text        not null check (level in ('N1', 'N2', 'N3', 'N4', 'N5')),
  dibuat  timestamptz not null default now(),
  primary key (user_id, minggu)
);

alter table public.tes_mini enable row level security;

drop policy if exists "tes_mini: baca sendiri" on public.tes_mini;
create policy "tes_mini: baca sendiri" on public.tes_mini
  for select to authenticated using (auth.uid() = user_id);

-- Nulis cuma lewat buat_tes_mini() di bawah.
revoke all on table public.tes_mini from anon;
grant select on table public.tes_mini to authenticated;


-- ── Bikin (atau ambil) tes mini minggu ini ────────────────
--
-- p_minggu = Senin minggu ini dari tanggal lokal client; harus hari Senin dan
-- deket hari ini. Udah ada → balikin sesi yang sama (lanjutin / lihat hasil).

create or replace function public.buat_tes_mini(p_minggu date, p_level text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid   uuid := auth.uid();
  sid   uuid;
  soal  jsonb;
  jml   integer;
begin
  if uid is null then
    raise exception 'Belum login' using errcode = '28000';
  end if;
  if not public.has_learning_access() then
    raise exception 'subscription_required' using errcode = '42501';
  end if;
  if p_level not in ('N1', 'N2', 'N3', 'N4', 'N5') then
    raise exception 'Level gak valid' using errcode = '22023';
  end if;
  if p_minggu is null or extract(isodow from p_minggu) <> 1
     or p_minggu < current_date - 7 or p_minggu > current_date + 1 then
    raise exception 'Minggu gak valid' using errcode = '22023';
  end if;

  -- Klik dobel / dua tab barengan gak boleh bikin dua tes.
  perform pg_advisory_xact_lock(hashtext(uid::text || '|tes_mini|' || p_minggu::text));

  select t.sesi_id into sid from public.tes_mini t where t.user_id = uid and t.minggu = p_minggu;
  if sid is not null then
    return sid;
  end if;

  with q as (
    select e, e->>'category' as kat
    from public.katalog_materi k, jsonb_array_elements(k.ai_result->'questions') e
    where k.level = p_level and k.ready
      and coalesce(k.section, k.ai_result->>'section', '') <> 'choukai'
      and coalesce((e->>'needs_review')::boolean, false) = false
      and coalesce(e->>'question', '') <> ''
  ),
  pilih as (
    (select e, 1 as urut from q where kat in ('文字', '語彙') order by random() limit 6)
    union all
    (select e, 2 from q where kat = '文法' order by random() limit 5)
    union all
    (select e, 3 from q where kat = '読解' order by random() limit 4)
  )
  select jsonb_agg(e order by urut), count(*) into soal, jml from pilih;

  if coalesce(jml, 0) < 15 then
    raise exception 'Soal % belum cukup buat tes mini', p_level using errcode = 'P0002';
  end if;

  -- category: kolom sessions.category cuma nerima 文法/語彙/文字/読解/AI (supabase-schema.sql).
  -- 'AI' = sesi campuran; jenis aslinya ada di ai_result.kind = 'tes_mini'.
  insert into public.sessions (user_id, level, category, title, total, score, ai_result)
  values (
    uid, p_level, 'AI', 'Tes mini ' || p_level || ' · minggu ' || to_char(p_minggu, 'DD/MM/YYYY'), jml, null,
    jsonb_build_object('kind', 'tes_mini', 'title', 'Tes mini ' || p_level, 'minggu', p_minggu, 'questions', soal)
  )
  returning id into sid;

  insert into public.tes_mini (user_id, minggu, sesi_id, level) values (uid, p_minggu, sid, p_level);
  return sid;
end;
$$;

revoke all on function public.buat_tes_mini(date, text) from public, anon;
grant execute on function public.buat_tes_mini(date, text) to authenticated;
