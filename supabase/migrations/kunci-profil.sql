-- ============================================================
-- Kunci kolom profiles yang boleh diubah dari browser.
--
-- Lubangnya: policy "profiles: own" itu FOR ALL, dan role `authenticated`
-- punya izin UPDATE ke SEMUA kolom. Jadi siapa pun yang login bisa ngetik
-- di console browser:
--
--     supabase.from("profiles").update({ is_lifetime: true }).eq("id", idSendiri)
--
-- dan dapet Lifetime gratis — is_pro() baca kolom itu. Sama juga buat
-- premium_until & is_premium. Dicek 2026-10-01: belum ada yang nyalahgunain
-- (0 profil ber-flag Pro, transaksi 0).
--
-- Policy RLS-nya gak diubah. Yang dipersempit izin per kolom: browser cuma
-- boleh nulis kolom yang memang ditulis app —
--   username, avatar_url, target_level  → pengaturan & onboarding
--   xp                                  → latihan / choukai
--   renewal_reminders_enabled           → /langganan/berhenti (langganan.sql)
--
-- Gak kena dampak (jalan sebagai pemilik DB, security definer):
--   handle_new_user()  → bikin profil user baru
--   aktifkan_pro()     → webhook pembayaran
--
-- ⚠️ Nambah kolom profiles yang perlu ditulis dari browser? WAJIB di-grant
-- juga di sini, kalau nggak update-nya ditolak "permission denied".
--
-- Jalanin di Supabase → SQL Editor → Run. Aman diulang.
-- ============================================================

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (username, avatar_url, target_level, xp) on public.profiles to authenticated;
-- Kolomnya dibikin langganan.sql. Di-grant di sini juga supaya ngulang file
-- ini gak diam-diam matiin toggle pengingat. Dibungkus cek biar file ini tetap
-- jalan di DB yang belum dapat langganan.sql.
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles'
               and column_name = 'renewal_reminders_enabled') then
    grant update (renewal_reminders_enabled) on public.profiles to authenticated;
  end if;
end $$;

-- Cek: harusnya 4 baris — avatar_url, target_level, username, xp
-- (5 kalau langganan.sql udah jalan: + renewal_reminders_enabled).
select column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee = 'authenticated' and privilege_type = 'UPDATE'
order by column_name;
