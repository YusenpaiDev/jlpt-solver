"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { tanggalLokal } from "@/lib/aktivitas";

/**
 * Penanda "udah dilihat / udah ditutup" yang ke-reset tiap ganti hari.
 *
 * Dipakai dua tempat dengan aturan yang sama: titik merah di lonceng
 * <UserBar>, dan tombol tutup di <PeringatanBanner>.
 *
 * Kenapa satu kunci berisi {tanggal, ids} dan bukan satu kunci per id per hari:
 * yang belakangan numpuk di localStorage selamanya dan gak ada yang ngebersihin.
 * Begini, tanggalnya ganti → isinya dianggap kosong dengan sendirinya.
 *
 * Kenapa useSyncExternalStore dan bukan useState + useEffect: localStorage itu
 * sumber di luar React. Baca-di-effect terus setState bikin render bertingkat
 * (dan kena react-hooks/set-state-in-effect), dan gak nyambung antar-komponen —
 * kalau banner ditutup, lonceng gak tau apa-apa. Lewat store, semua yang
 * langganan kunci yang sama ikut ke-update sekaligus.
 */

const pendengar = new Set<() => void>();

/* Cadangan di memori buat mode privat / storage penuh, di mana setItem
   ngelempar. Tanpa ini tombol tutup keliatan gak ngefek: state-nya ketulis ke
   tempat yang gak nyimpen, dibaca lagi hasilnya nilai lama. */
const cadangan = new Map<string, string>();

function langganan(cb: () => void): () => void {
  pendengar.add(cb);
  // Tab lain nutup peringatan yang sama → di sini ikut ilang.
  window.addEventListener("storage", cb);
  return () => {
    pendengar.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function ambil(kunci: string): string | null {
  try {
    const v = localStorage.getItem(kunci);
    if (v !== null) return v;
  } catch { /* jatuh ke cadangan */ }
  return cadangan.get(kunci) ?? null;
}

function simpan(kunci: string, nilai: string): void {
  cadangan.set(kunci, nilai);
  try { localStorage.setItem(kunci, nilai); } catch { /* mode privat */ }
  for (const cb of pendengar) cb();
}

export interface TandaHarian {
  /** id yang udah ditandai HARI INI. Kemarin gak kebawa. */
  ids: string[];
  /** Tandai satu atau beberapa id sekaligus. */
  tandai: (id: string | string[]) => void;
}

export function useTandaHarian(kunci: string): TandaHarian {
  /* Snapshot-nya string mentah, bukan array hasil parse — getSnapshot wajib
     balikin nilai yang sama secara referensi selama isinya belum berubah, dan
     array baru tiap panggilan bikin render berulang tanpa henti. */
  const mentah = useSyncExternalStore(
    langganan,
    () => ambil(kunci),
    () => null, // di server localStorage gak ada
  );

  const ids = useMemo<string[]>(() => {
    if (!mentah) return [];
    try {
      const isi = JSON.parse(mentah) as { tanggal?: string; ids?: string[] };
      return isi?.tanggal === tanggalLokal() && Array.isArray(isi.ids) ? isi.ids : [];
    } catch {
      return [];
    }
  }, [mentah]);

  const tandai = useCallback((id: string | string[]) => {
    const gabung = [...new Set([...ids, ...(Array.isArray(id) ? id : [id])])];
    simpan(kunci, JSON.stringify({ tanggal: tanggalLokal(), ids: gabung }));
  }, [kunci, ids]);

  return { ids, tandai };
}
