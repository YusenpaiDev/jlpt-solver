-- Pencatat error app (server via instrumentation.ts onRequestError, browser via
-- /api/log-error). Cuma service role yang boleh nulis & baca — RLS nyala tanpa
-- policy, jadi user biasa gak bisa ngintip atau ngisi sembarangan.
-- Dibaca di /admin. Aman diulang.
create table if not exists public.error_log (
  id       bigserial primary key,
  waktu    timestamptz not null default now(),
  sumber   text not null check (sumber in ('server', 'browser')),
  pesan    text not null,
  stack    text,
  path     text,
  digest   text,
  rute     text,
  user_id  uuid references auth.users(id) on delete set null
);
create index if not exists error_log_waktu_idx on public.error_log (waktu desc);
alter table public.error_log enable row level security;
revoke all on public.error_log from anon, authenticated;
