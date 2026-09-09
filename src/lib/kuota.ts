import { createClient } from "@/lib/supabase/server";

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

/** Batas Free = janji di halaman harga. Batas Pro = rem biaya, bukan jualan. */
/* Angka Pro DIPILIH DARI BIAYA, bukan dari rasa lega.
 *
 *   analisis  Sonnet 4.6 + gambar, max_tokens 64.000 → ~$0.20 sekali panggil.
 *             Ini 60% biaya kamu. 50/hari = ~$300/bulan buat SATU pelanggan
 *             yang bayar ~$8. Ditahan paling ketat.
 *   furigana  Haiku, tapi max_tokens 4.000 dan sering dipanggil → diam-diam
 *             mahal kalau dibiarin di 500/hari.
 *   chat      max_tokens 280, paling murah per panggilan.
 *
 * Kalau salah satu angka di sini diubah, ubah juga daftar fitur & tabel
 * banding di src/app/premium/page.tsx — halaman itu nyebut angkanya terang
 * terangan, dan janji yang gak cocok sama kode itu yang bikin repot. */
export const BATAS = {
  chat:              { free: 5,  pro: 50  },
  analisis:          { free: 2,  pro: 10  },
  furigana:          { free: 20, pro: 100 },
  "tugas-generate":  { free: 5,  pro: 30  },
} as const;

export type Fitur = keyof typeof BATAS;

export type HasilKuota =
  | { ok: true;  isPro: boolean; terpakai: number; batas: number }
  | { ok: false; sebab: "anon" }
  | { ok: false; sebab: "habis"; isPro: boolean; terpakai: number; batas: number };

/** Pesan buat user — jangan bocorin istilah teknis ke UI. */
export function pesanKuota(h: Extract<HasilKuota, { ok: false }>): string {
  if (h.sebab === "anon") return "Login dulu buat pakai fitur ini.";
  return h.isPro
    ? `Kamu udah pakai ${h.batas}× hari ini. Batas ini rem pengaman, bukan batas paket — ceritain ke kami kalau kamu beneran butuh lebih.`
    : `Jatah harian kamu habis (${h.batas}× per hari di paket Free). Reset besok, atau upgrade ke Pro buat unlimited.`;
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
