/**
 * Whitelist akses PRO gratis. Email di sini otomatis dapet akses penuh
 * tanpa bayar (buat owner + temen yang dikasih gratis).
 *
 * Tambah/kurangin cukup di array ini. Cek entitlement lewat hasProAccess().
 */
export const FREE_PRO_EMAILS: string[] = [
  "yusufnashirsyarifuddin@gmail.com", // owner
  "sirbi269@gmail.com",
  "nbillasanda@gmail.com",
  "yandip473@gmail.com",
];

const SET = new Set(FREE_PRO_EMAILS.map(e => e.trim().toLowerCase()));

/** True kalau user berhak PRO — dari whitelist ATAU flag is_premium (hasil bayar). */
export function hasProAccess(email?: string | null, isPremium?: boolean | null): boolean {
  if (isPremium) return true;
  if (!email) return false;
  return SET.has(email.trim().toLowerCase());
}

/** Cuma cek whitelist (tanpa flag DB). */
export function isWhitelisted(email?: string | null): boolean {
  return !!email && SET.has(email.trim().toLowerCase());
}
