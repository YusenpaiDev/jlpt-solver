import type { SesiMilik, SetKatalog } from "@/lib/bank-soal";

/**
 * Data contoh /materi & /bank-soal buat mode dev tanpa login — HANYA buat cek
 * visual lokal. Nyala kalau `next dev` DAN NEXT_PUBLIC_DEV_BYPASS_AUTH=1; di
 * build production cabangnya dibuang bundler.
 *
 * ?dev=baru → user baru (belum ada progres)
 */
export const DEV_BYPASS = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "1";

const JUMLAH: Record<string, number> = { N5: 0, N4: 10, N3: 29, N2: 29, N1: 29 };

export function devBankSoal(level: string, mode: string | null): { milik: SesiMilik[]; katalog: SetKatalog[] } {
  const katalog: SetKatalog[] = [];
  let y = 2026, m = 7;
  for (let i = 0; i < (JUMLAH[level] ?? 0); i++) {
    const t = `JLPT ${level} ${y}年${m}月`;
    const siap = i !== 1; // pos 02 = konten belum lengkap
    katalog.push({ id: `k${i}h`, level, title: t, section: "hikki", total: 75, ready: siap });
    katalog.push({ id: `k${i}c`, level, title: `${t} 聴解`, section: "choukai", total: 11, ready: siap });
    if (m === 12) m = 7; else { m = 12; y--; }
  }
  if (mode === "baru") return { milik: [], katalog };
  const jam = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
  const s = (k: SetKatalog, score: number | null, answered: number, h: number): SesiMilik =>
    ({ id: `s-${k.id}`, level, title: k.title, total: k.total, score, section: k.section, created_at: jam(h + 1), stats: { answered, last_practiced_at: jam(h) } });
  const milik: SesiMilik[] = [];
  const k = (i: number) => katalog[i];
  if (katalog.length > 8) {
    milik.push(s(k(4), null, 42, 26));          // pos 03 筆記 setengah jalan · kemarin
    milik.push(s(k(6), 61, 75, 72), s(k(7), 9, 11, 70));   // pos 04 menyala
    milik.push(s(k(8), 40, 75, 120), s(k(9), 5, 11, 118)); // pos 05 perlu diulang
    milik.push(s(k(13), 3, 11, 140));          // pos 07 聴解 selesai, 筆記 belum
  }
  return { milik, katalog };
}

/** Progres contoh: sebagian kata & pola udah dikerjain. */
export function devProgres(kata: string[], pola: string[], mode: string | null) {
  if (mode === "baru") return { kata: [], pola: [] };
  const isi = <T,>(daftar: string[], f: (x: string, i: number) => T | null) => daftar.map(f).filter((x): x is T => x != null);
  return {
    kata: isi(kata, (w, i) => i % 5 === 0 ? { word: w, benar: 3, salah: 0 } : i % 7 === 0 ? { word: w, benar: 1, salah: 0 } : i % 23 === 0 ? { word: w, benar: 0, salah: 2 } : null),
    pola: isi(pola, (p, i) => i % 4 === 0 ? { pattern: p, benar: 4, salah: 1 } : i % 5 === 0 ? { pattern: p, benar: 1, salah: 0 } : i % 11 === 0 ? { pattern: p, benar: 0, salah: 3 } : null),
  };
}
