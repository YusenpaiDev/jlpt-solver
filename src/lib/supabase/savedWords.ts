import { createClient } from "@/lib/supabase/client";

/* Hasil operasi favorit — biar pemanggil bisa kasih pesan yang tepat. */
export type FavResult =
  | { ok: true }
  | { ok: false; reason: "auth" | "missing-column" | "error"; message: string };

/**
 * Set `favorite` di saved_words dengan tahan sesi-basi.
 *
 * Alur: coba update → kalau balik 0 baris / error (gejala token akses
 * kedaluwarsa), refreshSession() lalu coba sekali lagi. Kalau tetap gagal,
 * cek apakah user masih login → bedain "sesi habis" vs error beneran.
 *
 * UI (revert optimistic + tampilkan pesan) diserahkan ke pemanggil, karena
 * kamus pakai alert/confirm sedangkan analisis-foto pakai toast.
 */
export async function setSavedWordFavorite(id: string, favorite: boolean): Promise<FavResult> {
  const sb = createClient();
  const run = () =>
    sb.from("saved_words").update({ favorite }).eq("id", id).select("id");

  let { data, error } = await run();
  if (!error && data && data.length > 0) return { ok: true };

  // Kolom `favorite` belum di-migrate → bukan soal sesi, kasih tahu apa adanya.
  if (error && /(column .*favorite.* does not exist|could not find the .favorite. column)/i.test(error.message)) {
    return { ok: false, reason: "missing-column", message: error.message };
  }

  // Kemungkinan besar token kedaluwarsa → refresh sesi & retry sekali.
  await sb.auth.refreshSession();
  ({ data, error } = await run());
  if (!error && data && data.length > 0) return { ok: true };

  // Masih gagal → sesi beneran habis, atau error lain.
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, reason: "auth", message: "Sesi login habis" };
  return { ok: false, reason: "error", message: error?.message ?? "Update gak nyangkut" };
}
