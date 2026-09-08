import { createClient } from "@/lib/supabase/client";

/**
 * Catat bahwa hari ini user beneran ngerjain sesuatu.
 *
 * Streak dulunya naik cuma karena halaman kebuka — dan kodenya nyempil di
 * <Sidebar>, komponen yang ternyata gak dirender halaman mana pun, jadi gak
 * pernah jalan sama sekali. Sekarang yang dicatat cuma perbuatan: jawab soal,
 * nilai kartu, selesain drill.
 */

export type SumberAktivitas =
  | "soal"      // jawab soal di /latihan atau /analisis-foto
  | "choukai"   // jawab soal 聴解
  | "kotoba"    // drill / flashcard kotoba
  | "bunpou";   // latihan bunpou

/** Tanggal LOKAL (bukan UTC) dalam bentuk YYYY-MM-DD.
 *
 *  Ini inti bug lama: `new Date().toISOString()` itu UTC, jadi buat WIB (+7)
 *  latihan jam 1 pagi kecatat di tanggal kemarin — streak putus padahal
 *  orangnya rajin. `sv-SE` dipilih karena format bawaannya emang YYYY-MM-DD. */
export function tanggalLokal(d = new Date()): string {
  return d.toLocaleDateString("sv-SE");
}

/* Sekali per (hari, sumber) per tab. Nilai-diri kotoba bisa kepencet 30× dalam
   semenit; nembak RPC tiap kali cuma bikin berisik tanpa ngubah apa-apa —
   barisnya udah ada, streaknya udah kehitung. */
const udah = new Set<string>();

export async function catatAktivitas(sumber: SumberAktivitas): Promise<void> {
  const tanggal = tanggalLokal();
  const kunci = `${tanggal}·${sumber}`;
  if (udah.has(kunci)) return;
  udah.add(kunci);

  try {
    await createClient().rpc("catat_aktivitas", { p_tanggal: tanggal, p_sumber: sumber });
  } catch {
    /* Gagal catat: jangan ganggu latihan yang lagi jalan. Dicoba lagi sendiri
       pas dia ngerjain hal berikutnya di hari yang sama. */
    udah.delete(kunci);
  }
}
