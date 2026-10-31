import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { statusAkses, type Fitur } from "@/lib/batas-paket";

export { BATAS, type Fitur } from "@/lib/batas-paket";

export type HasilKuota =
  | { ok: true; isPro: boolean; terpakai: number; batas: null }
  | { ok: false; sebab: "anon" | "expired" | "unavailable" };

export function pesanKuota(h: Extract<HasilKuota, { ok: false }>): string {
  if (h.sebab === "anon") return "Login dulu buat pakai fitur ini.";
  if (h.sebab === "unavailable") return "Status akses belum bisa diperiksa. Coba lagi sebentar.";
  return "Masa percobaan atau langgananmu sudah berakhir. Berlangganan Pro untuk melanjutkan.";
}

export function responsKuota(_fitur: Fitur, h: Extract<HasilKuota, { ok: false }>) {
  return NextResponse.json({
    error: pesanKuota(h),
    code: h.sebab === "expired" ? "subscription_required" : h.sebab,
  }, { status: h.sebab === "anon" ? 401 : h.sebab === "expired" ? 403 : 503 });
}

/** Periksa akses sebelum memanggil AI. Tidak ada batas harian untuk Pro/trial. */
export async function pakaiKuota(fitur: Fitur): Promise<HasilKuota> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, sebab: "anon" };
  const { data: pro, error } = await supabase.rpc("is_pro");
  // Gagal memverifikasi akses tidak boleh membuka layanan AI berbayar.
  if (error || typeof pro !== "boolean") return { ok: false, sebab: "unavailable" };
  const akses = statusAkses(user.created_at, pro);
  if (!akses.boleh) return { ok: false, sebab: "expired" };

  // Tetap catat penggunaan. NULL didukung RPC sebagai tanpa batas.
  const { data, error: usageError } = await supabase.rpc("pakai_kuota", { p_fitur: fitur, p_batas: null });
  if (usageError) return { ok: false, sebab: "unavailable" };
  const baris = Array.isArray(data) ? data[0] : data;
  if (!baris?.boleh) return { ok: false, sebab: "unavailable" };
  return { ok: true, isPro: pro, terpakai: baris.terpakai, batas: null };
}
