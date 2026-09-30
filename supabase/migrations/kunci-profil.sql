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

-- Cek: harusnya cuma 4 baris — avatar_url, target_level, username, xp.
select column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee = 'authenticated' and privilege_type = 'UPDATE'
order by column_name;
