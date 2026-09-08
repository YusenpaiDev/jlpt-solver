import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Entitlement PRO — sumber kebenarannya DATABASE, bukan file ini.
 *
 * Dulu daftar email gratisan ditulis sebagai array di sini. Masalahnya file ini
 * ke-import komponen client, jadi ikut ke-bundle ke JS dan 6 email pribadi
 * kebaca siapa pun yang buka app + View Source. Sekarang daftarnya pindah ke
 * tabel `pro_whitelist` yang gak punya policy baca buat user biasa; yang
 * mutusin cuma fungsi `is_pro()` di Postgres.
 *
 * Lihat supabase/migrations/kuota-free.sql.
 */

/** Tanya DB: user yang lagi login ini Pro apa enggak. */
export async function fetchProAccess(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_pro");
  if (error) {
    // Migrasi belum dijalanin → anggap Free. Sengaja gak nebak "Pro" biar
    // fitur berbayar gak kebuka diam-diam gara-gara RPC-nya belum ada.
    console.warn("[access] is_pro() gagal, dianggap Free:", error.message);
    return false;
  }
  return data === true;
}

/**
 * Versi sinkron buat dipakai kalau flag-nya UDAH ke-ambil dari DB.
 * `isPremium` di sini hasil `fetchProAccess()` atau kolom `profiles.is_premium`
 * — bukan tebakan dari email.
 */
export function hasProAccess(isPremium?: boolean | null): boolean {
  return isPremium === true;
}
