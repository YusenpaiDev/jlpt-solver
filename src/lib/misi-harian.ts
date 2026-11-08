/* Aturan misi harian + misi penyelamat (handoff Rencana Belajar §3–4).
   Murni, tanpa Supabase. Isi & durasi langkah = PLACEHOLDER dari handoff. */

import type { HariBelajar } from "./waktu-kalender";

export type Tingkat = "santai" | "rutin" | "serius";

/** PLACEHOLDER (handoff §3): menit per langkah [ulang, baru, soal] + isi tiap langkah. */
export const PACE_MISI: Record<Tingkat, { m: number; e: string; t: string; menit: [number, number, number]; ulang: number; baru: number; soal: number }> = {
  santai: { m: 10, e: "🌱", t: "Santai", menit: [3, 4, 3], ulang: 6, baru: 4, soal: 5 },
  rutin: { m: 20, e: "🔥", t: "Rutin", menit: [6, 7, 7], ulang: 12, baru: 8, soal: 10 },
  serius: { m: 40, e: "⚡", t: "Serius", menit: [10, 15, 15], ulang: 20, baru: 12, soal: 20 },
};

export const MENIT_PENYELAMAT = 5;
export const ITEM_PENYELAMAT = 6;
/** Batas jumlah soal player Latihan Kilat / Kotoba. */
const MAKS_SOAL = 20;

/** Pace tersimpan (Pengaturan bisa 5–120 menit) → salah satu dari tiga tingkat. */
export function tingkatPace(menit: number): Tingkat {
  return menit < 20 ? "santai" : menit < 40 ? "rutin" : "serius";
}

export interface Langkah {
  n: 1 | 2 | 3;
  judul: string;
  isi: string;
  menit: number;
  jumlah: number;
  /** Langkah 1 dicoret kalau gak ada yang perlu diulang. */
  dilewati: boolean;
}

export function rencanaMisi(t: Tingkat, { adaSalah, lebihUlang = false }: { adaSalah: boolean; lebihUlang?: boolean }): Langkah[] {
  const P = PACE_MISI[t];
  const ulang = lebihUlang ? Math.round(P.ulang * 1.5) : P.ulang;
  const baru = lebihUlang ? Math.max(2, Math.round(P.baru * 0.5)) : P.baru;
  const [m1, m2, m3] = P.menit;
  const pindah = adaSalah ? 0 : m1;
  const keDua = Math.ceil(pindah / 2);
  return [
    { n: 1, judul: "Ulang yang salah", isi: adaSalah ? `${ulang} kata & pola sering salah` : "Semua kata & pola lagi aman", menit: adaSalah ? m1 : 0, jumlah: ulang, dilewati: !adaSalah },
    { n: 2, judul: "Materi baru", isi: `${baru} kata baru`, menit: m2 + keDua, jumlah: baru, dilewati: false },
    { n: 3, judul: "Latihan soal", isi: `${P.soal} soal Bunpou`, menit: m3 + pindah - keDua, jumlah: P.soal, dilewati: false },
  ];
}

/** Langkah yang dikerjain berikutnya, atau null kalau misi udah selesai. */
export function langkahBerikut(rencana: Langkah[], selesai: number): Langkah | null {
  return rencana.find(l => l.n > selesai && !l.dilewati) ?? null;
}

const geser = (t: string, n: number) => {
  const [y, m, d] = t.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** p1 = kemarin bolong · p2 = bolong ≥ 2 hari · null = aman / akun baru / udah belajar hari ini. */
export function statusBolong(hari: Map<string, HariBelajar>, hariIni: string): { jenis: "p1" | "p2" | null; terakhirAktif: string | null } {
  const belajar = (h?: HariBelajar) => Boolean(h && (h.menit > 0 || h.aktif));
  const terakhirAktif = [...hari.values()].filter(h => h.tanggal < hariIni && belajar(h)).map(h => h.tanggal).sort().pop() ?? null;
  if (!terakhirAktif || belajar(hari.get(hariIni))) return { jenis: null, terakhirAktif };
  const kemarin = geser(hariIni, -1);
  if (terakhirAktif === kemarin) return { jenis: null, terakhirAktif };
  return { jenis: terakhirAktif === geser(hariIni, -2) ? "p1" : "p2", terakhirAktif };
}

export interface JumlahSalah { kata: number; pola: number }

/** Player tiap langkah. Langkah 1: kata sering salah dulu, kalau gak ada pola sering salah. */
export function urlLangkah(l: Langkah, salah: JumlahSalah): string {
  const n = Math.min(MAKS_SOAL, l.jumlah);
  if (l.n === 1) return salah.kata > 0 || salah.pola === 0
    ? `/latihan/kotoba?mode=ulang&count=${n}&misi=1`
    : `/latihan/kilat?mode=ulang&count=${n}&misi=1&teknik=lewat`;
  if (l.n === 2) return `/latihan/kotoba?mode=baru&count=${n}&misi=2`;
  return `/latihan/kilat?count=${n}&misi=3`;
}

export function urlPenyelamat(salah: JumlahSalah): string {
  if (salah.kata > 0) return `/latihan/kotoba?mode=ulang&count=${ITEM_PENYELAMAT}&misi=penyelamat`;
  if (salah.pola > 0) return `/latihan/kilat?mode=ulang&count=${ITEM_PENYELAMAT}&misi=penyelamat&teknik=lewat`;
  return `/latihan/kotoba?count=${ITEM_PENYELAMAT}&misi=penyelamat`;
}
