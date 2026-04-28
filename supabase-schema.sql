-- ============================================================
-- Sensei JLPT — Database Schema
-- Paste ini di Supabase SQL Editor → Run
-- ============================================================

-- Profiles (extends auth.users)
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  username    text,
  target_level text check (target_level in ('N1','N2','N3','N4','N5')) default 'N3',
  is_premium  boolean default false,
  xp          integer default 0,
  streak      integer default 0,
  last_active date,
  created_at  timestamptz default now()
);

-- Sesi analisis foto
create table public.sessions (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  level       text check (level in ('N1','N2','N3','N4','N5')) not null,
  category    text check (category in ('文法','語彙','文字','読解','AI')) not null,
  title       text not null,
  image_url   text,
  score       integer,          -- jumlah benar
  total       integer,          -- jumlah soal
  ai_result   jsonb,            -- raw response dari Claude
  created_at  timestamptz default now()
);

-- Soal per sesi
create table public.questions (
  id          uuid default gen_random_uuid() primary key,
  session_id  uuid references public.sessions(id) on delete cascade not null,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  question    text not null,
  options     jsonb,            -- ["A","B","C","D"]
  correct_ans text not null,
  user_ans    text,
  explanation text,
  is_correct  boolean,
  created_at  timestamptz default now()
);

-- Kamus favorit
create table public.saved_words (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  kanji       text not null,
  reading     text,
  meaning     text,
  example     text,
  level       text,
  image_url   text,
  created_at  timestamptz default now(),
  unique(user_id, kanji)
);

-- Migration (jalankan jika tabel sudah ada):
-- alter table public.saved_words add column if not exists example text;

-- Notifikasi
create table public.notifications (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  type        text check (type in ('streak','review','update')) not null,
  title       text not null,
  body        text,
  is_read     boolean default false,
  created_at  timestamptz default now()
);

-- ── Row Level Security ──────────────────────────────────────────

alter table public.profiles       enable row level security;
alter table public.sessions       enable row level security;
alter table public.questions      enable row level security;
alter table public.saved_words    enable row level security;
alter table public.notifications  enable row level security;

-- Profiles: user hanya bisa baca/update milik sendiri
create policy "profiles: own" on public.profiles
  for all using (auth.uid() = id);

-- Sessions: user hanya bisa akses milik sendiri
create policy "sessions: own" on public.sessions
  for all using (auth.uid() = user_id);

-- Questions: user hanya bisa akses milik sendiri
create policy "questions: own" on public.questions
  for all using (auth.uid() = user_id);

-- Saved words: user hanya bisa akses milik sendiri
create policy "saved_words: own" on public.saved_words
  for all using (auth.uid() = user_id);

-- Notifications: user hanya bisa akses milik sendiri
create policy "notifications: own" on public.notifications
  for all using (auth.uid() = user_id);

-- ── Auto-create profile saat user daftar ───────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
