/** Supabase can return zero updated rows without throwing (for example RLS). */
export function assertProgressSaved(
  sessionId: string,
  response: { data: { id: string } | null; error: unknown },
) {
  if (response.error || response.data?.id !== sessionId) {
    throw new Error("Progres belum tersimpan. Periksa koneksi lalu coba simpan lagi.");
  }
}
