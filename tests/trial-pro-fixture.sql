create role authenticated;
create role anon;
create schema auth;
create table auth.users(id uuid primary key, email text, created_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
create table public.profiles(id uuid primary key,is_premium boolean,is_lifetime boolean,premium_until timestamptz);
create table public.pro_whitelist(email text);
create table public.ai_usage(user_id uuid,tanggal date,fitur text,jumlah integer, primary key(user_id,tanggal,fitur));
create table public.saved_words(user_id uuid,word text);
grant all on public.saved_words to authenticated;
alter table public.saved_words enable row level security;
create policy own_words on public.saved_words for all to authenticated using (user_id=auth.uid()) with check(user_id=auth.uid());
insert into auth.users values
('00000000-0000-0000-0000-000000000001','trial@example.test',now()-interval '1 day'),
('00000000-0000-0000-0000-000000000002','old@example.test',now()-interval '8 days'),
('00000000-0000-0000-0000-000000000003','pro@example.test',now()-interval '1 year');
insert into profiles values ('00000000-0000-0000-0000-000000000003',true,false,now()+interval '1 month');
