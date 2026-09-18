/**
 * Kenali kegagalan yang datangnya dari SISI KAMI, bukan dari kesalahan user.
 *
 * Tanpa ini, halaman login nampilin pesan mentah dari Supabase apa adanya —
 * termasuk kalimat seperti "Service for this project is restricted due to
 * exceed_storage_size_quota. The project owner must upgrade their plan".
 * Dua masalah sekaligus: orang yang cuma mau belajar gak ngerti harus ngapain,
 * dan detail tagihan kita kebaca siapa pun yang nyoba masuk.
 */

/** Penanda gangguan layanan di pesan galat Supabase/PostgREST/jaringan. */
const PENANDA = [
  "restricted",              // project kena batas kuota / spend cap
  "exceed_",                 // exceed_storage_size_quota dkk
  "upgrade their plan",
  "service unavailable",
  "temporarily unavailable",
  "failed to fetch",         // jaringan putus / DNS
  "networkerror",
  "fetch failed",
  "econnrefused",
  "database is not available",
  "too many connections",
];

/** Kode HTTP yang artinya "bukan salah user, coba lagi nanti". */
const KODE = new Set([502, 503, 504, 540, 544]);

export interface Gangguan {
  /** Ditampilkan ke user. Sengaja gak nyebut Supabase, kuota, atau tagihan. */
  pesan: string;
  /** Buat console/log — boleh teknis. */
  asli: string;
}

/**
 * Balikin objek Gangguan kalau galatnya soal layanan, atau null kalau ini
 * kesalahan biasa (password salah, email sudah terdaftar) yang PERLU
 * disampaikan apa adanya ke user.
 */
export function kenaliGangguan(err: unknown): Gangguan | null {
  const asli =
    err instanceof Error ? err.message
    : typeof err === "string" ? err
    : (err as { message?: string })?.message ?? String(err ?? "");

  const status = (err as { status?: number })?.status;
  const cocok =
    (typeof status === "number" && KODE.has(status)) ||
    PENANDA.some(p => asli.toLowerCase().includes(p));

  if (!cocok) return null;

  return {
    pesan:
      "Lagi ada gangguan di server kami — bukan dari sisi kamu, dan bukan " +
      "karena data kamu. Semua progres belajarmu aman. Coba lagi beberapa " +
      "saat lagi ya.",
    asli,
  };
}
