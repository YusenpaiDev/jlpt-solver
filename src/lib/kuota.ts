import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BATAS, type Fitur, resetBerikutnya } from "@/lib/batas-paket";

/**
 * Kuota harian fitur AI — dipanggil dari route handler, SEBELUM manggil Claude.
 *
 * Dua guna sekaligus:
 *   1. Pembeda Free vs Pro yang beneran kerasa (bukan sekadar lencana).
 *   2. Rem biaya. Daftar akun terbuka dan tiap panggilan itu duit beneran.
 *
 * Angkanya dihitung & disimpan di Postgres lewat `pakai_kuota()`
 * (security definer, gak ada policy INSERT/UPDATE ke ai_usage), jadi
 * penghitungnya gak bisa di-reset dari browser.
 */

/* Angka batasnya tinggal di batas-paket.ts — file itu aman di-bundle ke
   browser, jadi layar langganan & jatah habis baca dari tempat yang sama
   dengan yang ditegakkan di sini. */
export { BATAS, type Fitur } from "@/lib/batas-paket";

export type HasilKuota =
  | { ok: true;  isPro: boolean; terpakai: number; batas: number }
  | { ok: false; sebab: "anon" }
  | { ok: false; sebab: "habis"; isPro: boolean; terpakai: number; batas: number };

/** Pesan buat user — jangan bocorin istilah teknis ke UI. */
export function pesanKuota(h: Extract<HasilKuota, { ok: false }>): string {
  if (h.sebab === "anon") return "Login dulu buat pakai fitur ini.";
  return h.isPro
    ? `Kamu udah pakai ${h.batas}× hari ini. Batas ini rem pengaman, bukan batas paket — ceritain ke kami kalau kamu beneran butuh lebih.`
    : `Jatah harian kamu habis (${h.batas}× per hari di paket Free). Reset besok 00:00 WIB, atau upgrade ke Pro buat jatah lebih besar.`;
}

/**
 * Respons buat kuota yang ditolak. 429 bawa angka lengkap — layar jatah habis
 * butuh `feature` (judul), `used`/`limit` (meter), `resetAt` (hitungan
 * reset), dan `plan` (Pro yang tetap kena 429 gak ditawarin upgrade).
 * Bentuknya dibaca bacaKuotaHabis() di src/lib/kuota-habis.ts.
 */
export function responsKuota(fitur: Fitur, h: Extract<HasilKuota, { ok: false }>) {
  if (h.sebab === "anon") {
    return NextResponse.json({ error: pesanKuota(h) }, { status: 401 });
  }
  return NextResponse.json({
    error: "quota_exceeded",
    message: pesanKuota(h),
    feature: fitur,
    used: h.terpakai,
    limit: h.batas,
    resetAt: resetBerikutnya(),
    plan: h.isPro ? "pro" : "free",
  }, { status: 429 });
}

export async function pakaiKuota(fitur: Fitur): Promise<HasilKuota> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, sebab: "anon" };

  const { data: pro, error: proErr } = await supabase.rpc("is_pro");
  if (proErr) return lolosTanpaMigrasi(proErr.message);

  const isPro = pro === true;
  const batas = isPro ? BATAS[fitur].pro : BATAS[fitur].free;

  const { data, error } = await supabase.rpc("pakai_kuota", { p_fitur: fitur, p_batas: batas });
  if (error) return lolosTanpaMigrasi(error.message);

  const baris = Array.isArray(data) ? data[0] : data;
  if (!baris) return lolosTanpaMigrasi("pakai_kuota gak balikin baris");

  return baris.boleh
    ? { ok: true, isPro, terpakai: baris.terpakai, batas: baris.batas }
    : { ok: false, sebab: "habis", isPro, terpakai: baris.terpakai, batas: baris.batas };

  /* Migrasi `supabase/migrations/kuota-free.sql` belum dijalanin.
     Sengaja LOLOS, bukan nolak: kalau nolak, app yang lagi jalan langsung
     mati total buat semua orang gara-gara satu file SQL yang kelewat.
     Tapi berisik di log biar ketahuan, karena selama ini kuotanya gak aktif. */
  function lolosTanpaMigrasi(kenapa: string): HasilKuota {
    console.warn(
      `[kuota] LEWAT tanpa batas (fitur=${fitur}): ${kenapa}\n` +
      `        → jalanin supabase/migrations/kuota-free.sql di SQL Editor.`
    );
    return { ok: true, isPro: false, terpakai: 0, batas: 0 };
  }
}
