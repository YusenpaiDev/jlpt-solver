
create table if not exists public.bank_soal (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid references public.sessions(id) on delete cascade,
  level          text not null check (level in ('N1','N2','N3','N4','N5')),
  category       text not null check (category in ('文法','語彙','文字','読解')),
  question       text not null,
  options        jsonb not null,       -- ["1. の", "2. のこと", ...]
  correct        text not null,        -- "3" (1-indeks, cocokin ke options)
  explanation    text,
  why_wrong      text,
  grammar_points jsonb,
  tip            text,
  passage        text,                 -- bacaan 読解, null buat kategori lain
  sidik_jari     text not null unique,
  created_at     timestamptz default now()
);

create index if not exists bank_soal_level_category_idx
  on public.bank_soal (level, category);

alter table public.bank_soal enable row level security;

drop policy if exists "bank_soal: baca semua" on public.bank_soal;
create policy "bank_soal: baca semua" on public.bank_soal
  for select to authenticated using (true);

create or replace function public.ambil_soal_acak(
  p_level    text,
  p_kategori text default null,        -- null = campuran semua kategori
  p_jumlah   int  default 10
)
returns setof public.bank_soal
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from public.bank_soal
  where level = p_level
    and (p_kategori is null or category = p_kategori)
  order by random()
  limit greatest(1, least(coalesce(p_jumlah, 10), 50));
$$;

grant execute on function public.ambil_soal_acak(text, text, int) to authenticated;

create table if not exists public.kotoba_progress (
  user_id    uuid not null references auth.users(id) on delete cascade,
  word       text not null,
  benar      integer not null default 0,
  salah      integer not null default 0,
  riwayat    boolean[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, word)
);

create index if not exists kotoba_progress_user_idx
  on public.kotoba_progress (user_id);

alter table public.kotoba_progress enable row level security;

drop policy if exists "kotoba_progress: own" on public.kotoba_progress;
create policy "kotoba_progress: own" on public.kotoba_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.catat_kotoba(p_word text, p_benar boolean)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.kotoba_progress (user_id, word, benar, salah, riwayat, updated_at)
  values (
    auth.uid(), p_word,
    case when p_benar then 1 else 0 end,
    case when p_benar then 0 else 1 end,
    array[p_benar],
    now()
  )
  on conflict (user_id, word) do update set
    benar      = public.kotoba_progress.benar + case when p_benar then 1 else 0 end,
    salah      = public.kotoba_progress.salah + case when p_benar then 0 else 1 end,
    riwayat    = (array[p_benar] || public.kotoba_progress.riwayat)[1:5],
    updated_at = now();
$$;

grant execute on function public.catat_kotoba(text, boolean) to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, target_level)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    coalesce(
      nullif(new.raw_user_meta_data->>'target_level', ''),
      'N3'
    )
  );
  return new;
exception when others then
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$;

update public.profiles p
set target_level = u.raw_user_meta_data->>'target_level'
from auth.users u
where u.id = p.id
  and u.raw_user_meta_data->>'target_level' in ('N1','N2','N3','N4','N5')
  and p.target_level is distinct from u.raw_user_meta_data->>'target_level';

select u.email,
       u.raw_user_meta_data->>'target_level' as metadata,
       p.target_level                        as tabel
from auth.users u
join public.profiles p on p.id = u.id
where u.raw_user_meta_data->>'target_level' in ('N1','N2','N3','N4','N5')
  and p.target_level is distinct from u.raw_user_meta_data->>'target_level';
