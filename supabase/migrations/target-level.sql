-- ═══════════════════════════════════════════════════════════════════
-- Perbaiki target_level yang gak pernah sampai ke tabel profiles
--
-- Masalahnya: trigger handle_new_user() cuma nyalin `username` dari metadata
-- pendaftaran. `target_level` yang dipilih user di halaman daftar/onboarding
-- gak ikut, jadi kolom profiles.target_level selalu keisi default 'N3'.
--
-- Akibat nyata (dicek 2026-08-14): 31 dari 46 user punya profiles='N3'
-- padahal metadata-nya N1/N2/N4/N5. Halaman yang baca tabel nampilin level
-- yang gak pernah dipilih user.
--
-- Run di Supabase Dashboard → SQL Editor. Aman diulang.
-- ═══════════════════════════════════════════════════════════════════

-- 1) Trigger ikut nyalin target_level buat user BARU.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, target_level)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    -- jatuh ke default kolom kalau metadata-nya kosong atau isinya ngawur
    coalesce(
      nullif(new.raw_user_meta_data->>'target_level', ''),
      'N3'
    )
  );
  return new;
exception when others then
  -- Jangan sampai pendaftaran gagal cuma gara-gara level gak valid.
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$;

-- 2) Tambal user LAMA — ambil dari metadata mereka.
--    Cuma yang metadata-nya keisi dan beda dari isi tabel.
update public.profiles p
set target_level = u.raw_user_meta_data->>'target_level'
from auth.users u
where u.id = p.id
  and u.raw_user_meta_data->>'target_level' in ('N1','N2','N3','N4','N5')
  and p.target_level is distinct from u.raw_user_meta_data->>'target_level';

-- 3) Cek hasilnya — harusnya 0 baris.
select u.email,
       u.raw_user_meta_data->>'target_level' as metadata,
       p.target_level                        as tabel
from auth.users u
join public.profiles p on p.id = u.id
where u.raw_user_meta_data->>'target_level' in ('N1','N2','N3','N4','N5')
  and p.target_level is distinct from u.raw_user_meta_data->>'target_level';
