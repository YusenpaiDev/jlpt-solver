/* Reset progres & hapus akun (Pengaturan → Danger Zone). Daftar tabel +
   aturan murni di sini (dites di tests/akun-data.test.mjs); eksekusinya di
   /api/akun/reset & /api/akun/hapus pakai service role, cuma baris milik
   user itu (user_id = dia). */

/** "Riwayat soal, streak, kalender cap, status kata & pola". Kamus, catatan, XP, langganan aman. */
export const TABEL_PROGRES = [
  "sessions", "kotoba_progress", "bunpou_progress", "aktivitas_harian", "waktu_belajar",
  "misi_harian", "tes_mini", "item_status", "tingkat_jenis_soal", "ulangan", "simulasi",
] as const;

/** Hapus akun: semua data milik user. `transaksi` ikut kehapus lewat FK cascade waktu akun login dihapus. */
export const TABEL_AKUN = [
  ...TABEL_PROGRES, "kurikulum_user", "saved_words", "catatan", "ganti_target", "laporan_soal", "ai_usage",
] as const;

export const KATA_KONFIRMASI = { reset: "RESET", hapus: "HAPUS" } as const;

export const cocokKonfirmasi = (aksi: keyof typeof KATA_KONFIRMASI, ketik: unknown) =>
  typeof ketik === "string" && ketik.trim().toUpperCase() === KATA_KONFIRMASI[aksi];

/** Tabel yang belum ada (migration belum dijalanin) dilewati, bukan dianggap gagal. */
export function tabelGakAda(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false;
  return e.code === "42P01" || e.code === "PGRST205" || /does not exist|could not find the table/i.test(e.message ?? "");
}
