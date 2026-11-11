import { rencanaMisi, type Langkah } from "@/lib/misi-harian";
import { materiPerHari } from "@/lib/kurikulum";
import type { Kurikulum } from "@/lib/use-kurikulum";

/** Langkah misi versi kurikulum (HANDOFF-kurikulum §9): jatuh tempo → materi unit → latihan adaptif. */
export function rencanaKurikulum(k: Kurikulum, tingkat: Parameters<typeof rencanaMisi>[0]): Langkah[] {
  const tempo = k.jatuhTempo.kata.length + k.jatuhTempo.pola.length;
  const unit = k.unit[Math.min(26, k.cur) - 1];
  const hari = materiPerHari(unit);
  return rencanaMisi(tingkat, { adaSalah: tempo > 0 }).map(l =>
    l.n === 1 ? { ...l, judul: "Ulang yang jatuh tempo", isi: tempo > 0 ? `${tempo} kata & pola jatuh tempo hari ini` : "Belum ada yang jatuh tempo", jumlah: Math.max(1, Math.min(tempo, l.jumlah)) }
    : l.n === 2 ? { ...l, judul: "Materi baru", isi: `Minggu ${unit.u} · ${hari.kata} kata + ${hari.pola} pola`, jumlah: hari.kata }
    : { ...l, judul: "Latihan adaptif", isi: `${l.jumlah} soal · 文法形式の判断` });
}
export function urlKurikulum(l: Langkah, k: Kurikulum): string {
  const n = Math.min(20, l.jumlah);
  if (l.n === 1) return k.jatuhTempo.kata.length > 0
    ? `/latihan/kotoba?mode=tempo&count=${n}&misi=1`
    : `/latihan/kilat?mode=tempo&count=${n}&misi=1&teknik=lewat`;
  if (l.n === 2) return `/latihan/kotoba?unit=${Math.min(26, k.cur)}&mode=baru&count=${n}&misi=2`;
  return `/latihan/kilat?count=${n}&misi=3`;
}

