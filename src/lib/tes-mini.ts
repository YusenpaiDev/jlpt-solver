/* Tes mini mingguan (handoff Rencana Belajar §9). Murni, tanpa Supabase.
   Perkiraan skor per bagian resmi = akurasi × skor maks bagian.
   聴解 gak ikut tes (soal audio), diperkirakan dari latihan 聴解 30 hari. */

import type { StrategiLevel } from "./strategi-ujian";

/** Isi tes (harus sama dengan buat_tes_mini di SQL). */
export const KOMPOSISI = [
  { k: "文字・語彙", n: 6, c: "moji" },
  { k: "文法", n: 5, c: "bunpou" },
  { k: "読解", n: 4, c: "dokkai" },
] as const;

type Hitung = Record<string, { a?: number; c?: number } | undefined>;

export interface SkorBagian { k: string; s: string; max: number; min: number; skor: number | null; dariLatihan: boolean }
export interface HasilTes {
  bagian: SkorBagian[];
  /** null kalau ada bagian yang belum bisa dihitung. */
  total: number | null;
  /** null = belum bisa diputusin (data kurang, tapi belum ada bagian yang jeblok). */
  lulus: boolean | null;
  /** Indeks bagian pertama yang di bawah minimum, -1 kalau gak ada. */
  bawahMinimum: number;
}

/** Senin minggu itu dari tanggal lokal YYYY-MM-DD. */
export function seninDari(tanggal: string): string {
  const [y, m, d] = tanggal.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}

function akurasi(h: Hitung, kat: string[]) {
  let a = 0, c = 0;
  for (const k of kat) {
    const v = h[k];
    const aa = Math.max(0, v?.a ?? 0);
    a += aa;
    c += Math.min(aa, Math.max(0, v?.c ?? 0));
  }
  return a > 0 ? c / a : null;
}

/** `tes` = stats.perCat sesi tes mini, `choukai` = jumlah jawaban latihan 聴解 30 hari. */
export function skorTes(L: StrategiLevel, tes: Hitung, choukai: { a: number; c: number } | null): HasilTes {
  const tiga = L.skor.length === 3;
  const sumber: [string[] | null][] = tiga
    ? [[["文字", "語彙", "文法"]], [["読解"]], [null]]
    : [[["文字", "語彙", "文法", "読解"]], [null]];
  const accCho = choukai && choukai.a > 0 ? Math.min(choukai.c, choukai.a) / choukai.a : null;

  const bagian = L.skor.map((b, i): SkorBagian => {
    const kat = sumber[i][0];
    const acc = kat ? akurasi(tes, kat) : accCho;
    return { k: b.k, s: b.s, max: b.max, min: b.min, skor: acc === null ? null : Math.round(acc * b.max), dariLatihan: kat === null };
  });
  const bawahMinimum = bagian.findIndex(b => b.skor !== null && b.skor < b.min);
  const lengkap = bagian.every(b => b.skor !== null);
  const total = lengkap ? bagian.reduce((n, b) => n + (b.skor ?? 0), 0) : null;
  const lulus = bawahMinimum >= 0 ? false : total === null ? null : total >= L.lulus;
  return { bagian, total, lulus, bawahMinimum };
}
