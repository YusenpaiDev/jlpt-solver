-- Run AFTER kuota-free.sql, pembayaran.sql and langganan.sql.
-- Trial is exactly 168 hours from auth.users.created_at, never from migration time.
-- No user data is deleted. Account/billing tables remain accessible under existing RLS.
begin;

create or replace function public.is_pro()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists (select 1 from public.profiles p where p.id = auth.uid() and (
      p.is_lifetime is true or p.premium_until > now()
      or (p.is_premium is true and p.premium_until is null)
    ))
    or exists (select 1 from public.pro_whitelist w join auth.users u
      on lower(w.email) = lower(u.email) where u.id = auth.uid())
  );
$$;

create or replace function public.has_learning_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    public.is_pro() or exists (
      select 1 from auth.users u where u.id = auth.uid()
        and u.created_at <= now()
        and now() < u.created_at + interval '168 hours'
    )
  );
$$;
revoke all on function public.is_pro() from public;
revoke all on function public.has_learning_access() from public;
grant execute on function public.is_pro() to authenticated;
grant execute on function public.has_learning_access() to authenticated, anon;

-- Keep the RPC signature so old clients remain compatible; ignore client-supplied caps.
create or replace function public.pakai_kuota(p_fitur text, p_batas integer)
returns table (boleh boolean, terpakai integer, batas integer)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hari date := (now() at time zone 'Asia/Jakarta')::date;
  n integer;
begin
  if not public.has_learning_access() then
    return query select false, 0, null::integer;
    return;
  end if;
  if p_fitur not in ('chat', 'furigana', 'tugas-generate') or p_fitur is null then
    raise exception 'Unknown feature';
  end if;
  insert into public.ai_usage as a (user_id, tanggal, fitur, jumlah)
    values (uid, hari, p_fitur, 1)
    on conflict (user_id, tanggal, fitur)
    do update set jumlah = a.jumlah + 1
    returning jumlah into n;
  return query select true, n, null::integer;
end;
$$;
revoke all on function public.pakai_kuota(text, integer) from public;
grant execute on function public.pakai_kuota(text, integer) to authenticated;

create or replace function public.sisa_kuota(p_fitur text, p_batas integer)
returns table (terpakai integer, batas integer)
language sql stable security definer set search_path = '' as $$
  select coalesce((select jumlah from public.ai_usage
    where user_id = auth.uid() and tanggal = (now() at time zone 'Asia/Jakarta')::date
      and fitur = p_fitur), 0), null::integer;
$$;
revoke all on function public.sisa_kuota(text, integer) from public;
grant execute on function public.sisa_kuota(text, integer) to authenticated;

-- Replace the former 50-word cap. Keep ownership policies intact.
drop policy if exists "saved_words: cap free" on public.saved_words;

-- Existing ownership policies still apply: these restrictive policies only
-- add an entitlement requirement, never grant access to another user's data.
do $$
declare nama text;
begin
  foreach nama in array array['saved_words', 'sessions', 'catatan', 'kotoba_progress',
    'bunpou_progress', 'bank_soal', 'kotoba_deck', 'bunpou_patterns'] loop
    if to_regclass('public.' || nama) is not null then
      execute format('alter table public.%I enable row level security', nama);
      execute format('drop policy if exists "learning: active access" on public.%I', nama);
      execute format('create policy "learning: active access" on public.%I as restrictive for all to public using ((select public.has_learning_access())) with check ((select public.has_learning_access()))', nama);
    end if;
  end loop;
end;
$$;
commit;
