"use client";

import { useEffect, useState } from "react";
import { KUNCI_CAP, periksaCapBaru } from "@/lib/cap-baru";

/** Nomor animasi "ngecap" buat cap hari ini (0 = gak ada). Naik tiap cap baru
 *  muncul / naik tingkat — dipakai sebagai `key` biar animasinya keputar ulang. */
export function useCapBaru(siap: boolean, tanggal: string, tingkat: number): number {
  const [putar, setPutar] = useState(0);
  useEffect(() => {
    if (!siap || tingkat <= 0) return;
    let simpanan: string | null = null;
    try { simpanan = localStorage.getItem(KUNCI_CAP); } catch { /* mode privat → tetap animasi */ }
    const cek = periksaCapBaru(simpanan, tanggal, tingkat);
    if (!cek.baru) return;
    /* Ditunda dikit biar kelihatan abis halaman kebuka. Disimpan pas animasinya
       beneran keputar (StrictMode dev manggil efek 2×). */
    const t = setTimeout(() => {
      try { localStorage.setItem(KUNCI_CAP, cek.simpan); } catch { /* gpp */ }
      setPutar(n => n + 1);
    }, 450);
    return () => clearTimeout(t);
  }, [siap, tanggal, tingkat]);
  return putar;
}
