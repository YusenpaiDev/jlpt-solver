-- Run only in a disposable PostgreSQL database, after trial-pro-fixture.sql
-- and supabase/migrations/20261011-trial-pro-unlimited.sql.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$ begin
  assert public.has_learning_access(), 'Active trial must have access';
  assert not public.is_pro(), 'Trial is not paid Pro';
end $$;
insert into saved_words select auth.uid(), 'word-' || n from generate_series(1,100) n;
do $$ declare r record; begin
  for i in 1..101 loop
    select * into r from public.pakai_kuota('chat',1);
    assert r.boleh and r.batas is null, 'Client cap must not limit active trial';
  end loop;
  assert r.terpakai=101, 'Usage must still be counted';
  begin
    insert into saved_words values ('00000000-0000-0000-0000-000000000002','foreign');
    raise exception 'Cross-user write allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
do $$ declare r record; begin
  assert not public.has_learning_access(), 'Old account must not receive a new trial';
  select * into r from public.pakai_kuota('chat',null);
  assert not r.boleh, 'Expired trial must not call AI';
  assert (select count(*)=0 from saved_words), 'Other users data must stay private';
  begin
    insert into saved_words values(auth.uid(),'expired');
    raise exception 'Expired account write allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
do $$ declare r record; begin
  assert public.is_pro() and public.has_learning_access(), 'Paid Pro must have access';
  for i in 1..101 loop
    select * into r from public.pakai_kuota('chat',1);
    assert r.boleh and r.batas is null, 'Pro must remain unlimited';
  end loop;
end $$;
reset role;
update profiles set premium_until=now()-interval '1 second';
set local role authenticated;
do $$ begin
  assert not public.is_pro(), 'Expired paid flag must not grant Pro';
  assert not public.has_learning_access(), 'Expired Pro must lose learning access';
end $$;
reset role;
update profiles set is_lifetime=true;
set local role authenticated;
do $$ begin assert public.is_pro(), 'Lifetime must remain active'; end $$;
reset role;
update auth.users set created_at=now()-interval '168 hours' where id='00000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$ begin
  assert not public.has_learning_access(), 'Trial expires exactly at 168 hours';
  assert (select count(*)=0 from saved_words), 'Expired trial cannot read learning data';
end $$;
reset role;
do $$ begin assert (select count(*)=100 from saved_words), 'Expiration must preserve saved data'; end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin assert not public.has_learning_access(), 'Anonymous must not have access'; end $$;
rollback;
