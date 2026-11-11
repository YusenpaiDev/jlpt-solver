import { rencanaMisi, type Langkah } from "@/lib/misi-harian";
import { gabungUnit, materiPerHari, type Unit } from "@/lib/kurikulum";
import type { Kurikulum } from "@/lib/use-kurikulum";

/** Unit-unit (minggu ini / lalu) digabung jadi satu set; null = gak ada materi baru. */
export const setUnit = (k: Kurikulum, us: number[]): Unit | null => gabungUnit(us.map(u => k.unit[u - 1]).filter(Boolean));

/** "Minggu 12" (normal) · "Unit 5–6" (dipadatin/kejar). */
export function namaUnit(k: Kurikulum, us: number[]): string {
  if (k.mode === "normal" && us.length === 1) return `Minggu ${us[0]}`;
  return `Unit ${us[0]}${us.length > 1 ? `–${us[us.length - 1]}` : ""}`;
}

/** Langkah misi versi kurikulum (HANDOFF-kurikulum §9): jatuh tempo → materi unit → latihan adaptif.
    Minggu tanpa unit (masa cadangan / mode akhir): langkah 2 jadi ulang yang sering salah. */
export function rencanaKurikulum(k: Kurikulum, tingkat: Parameters<typeof rencanaMisi>[0]): Langkah[] {
  const tempo = k.jatuhTempo.kata.length + k.jatuhTempo.pola.length;
  const set = setUnit(k, k.ini);
  const hari = set ? materiPerHari(set) : null;
  return rencanaMisi(tingkat, { adaSalah: tempo > 0 }).map(l =>
    l.n === 1 ? { ...l, judul: "Ulang yang jatuh tempo", isi: tempo > 0 ? `${tempo} kata & pola jatuh tempo hari ini` : "Belum ada yang jatuh tempo", jumlah: Math.max(1, Math.min(tempo, l.jumlah)) }
    : l.n === 2 ? (set && hari
      ? { ...l, judul: "Materi baru", isi: `${namaUnit(k, k.ini)} · ${hari.kata} kata + ${hari.pola} pola`, jumlah: hari.kata }
      : { ...l, judul: "Ulang yang sering salah", isi: k.mode === "akhir" ? "Mode akhir · gak ada materi baru" : "Masa cadangan · materi udah kebagian semua" })
    : { ...l, judul: "Latihan adaptif", isi: `${l.jumlah} soal · 文法形式の判断` });
}

export function urlKurikulum(l: Langkah, k: Kurikulum): string {
  const n = Math.min(20, l.jumlah);
  if (l.n === 1) return k.jatuhTempo.kata.length > 0
    ? `/latihan/kotoba?mode=tempo&count=${n}&misi=1`
    : `/latihan/kilat?mode=tempo&count=${n}&misi=1&teknik=lewat`;
  if (l.n === 2) return k.ini.length
    ? `/latihan/kotoba?unit=${k.ini.join(",")}&mode=baru&count=${n}&misi=2`
    : `/latihan/kotoba?mode=ulang&count=${n}&misi=2`;
  return `/latihan/kilat?count=${n}&misi=3`;
}
