import { rapikanError, type ErrorMasuk } from "./error-log";

/**
 * Tulis satu error ke tabel error_log (service role, lewat REST — jalan di
 * runtime Node maupun Edge). Gak pernah ngelempar: kalau pencatatan gagal,
 * app tetap jalan dan yang tersisa cuma console.error.
 */
export async function catatError(e: ErrorMasuk): Promise<void> {
  // Dev lokal nyambung ke DB production yang sama — jangan nyampah di sana.
  if (process.env.NODE_ENV !== "production") { console.error("[error]", e.sumber, e.pesan); return; }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const kunci = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !kunci) return;
  try {
    const res = await fetch(`${url}/rest/v1/error_log`, {
      method: "POST",
      headers: { apikey: kunci, Authorization: `Bearer ${kunci}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(rapikanError(e)),
    });
    if (!res.ok) console.error("[catat-error] gagal nyimpen:", res.status);
  } catch (err) {
    console.error("[catat-error]", err instanceof Error ? err.message : err);
  }
}
