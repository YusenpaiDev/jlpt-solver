/* "Paling sering keluar di soal" (src/data/prioritas, dari scripts/hitung-prioritas.mjs):
   alasan konkret buat hafalan — kata/pola yang muncul di banyak soal Bank Soal
   level itu. Dipecah per paket 10 biar bisa beres satu-satu.
   Murni — dites di tests/sering-keluar.test.mjs. */

export const JUMLAH_TERATAS = 50;
export const UKURAN_PAKET = 10;
/** Di bawah ini angkanya terlalu kecil buat dipamerin di label. */
export const MIN_LABEL = 3;

/** Item yang pernah keluar, urut dari yang paling sering (seri = urutan deck). */
export function teratas<T>(item: T[], kunci: (x: T) => string, skor: Record<string, number> | undefined, n = JUMLAH_TERATAS): T[] {
  if (!skor) return [];
  return item
    .map((x, i) => ({ x, i, s: skor[kunci(x)] ?? 0 }))
    .filter(y => y.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, n)
    .map(y => y.x);
}

/** Paket ke-p (mulai 1), isi `ukuran` item. */
export const paket = <T,>(item: T[], p: number, ukuran = UKURAN_PAKET): T[] => item.slice((p - 1) * ukuran, p * ukuran);
export const jumlahPaket = (n: number, ukuran = UKURAN_PAKET) => Math.ceil(n / ukuran);

/** Paket yang dikerjain berikutnya: yang pertama belum beres; null kalau semua beres. */
export function paketBerikut<T>(item: T[], beres: (x: T) => boolean, ukuran = UKURAN_PAKET): number | null {
  for (let p = 1; p <= jumlahPaket(item.length, ukuran); p++) if (!paket(item, p, ukuran).every(beres)) return p;
  return null;
}

/** "di 38 soal" — null kalau terlalu jarang. */
export const labelKeluar = (n: number | undefined) => (n && n >= MIN_LABEL ? `di ${n} soal` : null);
