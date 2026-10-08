const HARI = 86_400_000;
const ZONA = "Asia/Jakarta";

/**
 * Tanggal hasil perpanjangan — persis aturan aktifkan_pro() di
 * pembayaran.sql: tambah dari sisa yang ada, bukan dari hari ini.
 */
export function hasilPerpanjang(until: string | null, bulan: number, sekarang = new Date()): Date {
  const mulai = until && new Date(until) > sekarang ? new Date(until) : new Date(sekarang);
  const hasil = new Date(mulai);
  const hari = hasil.getUTCDate();
  hasil.setUTCDate(1);
  hasil.setUTCMonth(hasil.getUTCMonth() + bulan);
  const akhirBulan = new Date(Date.UTC(hasil.getUTCFullYear(), hasil.getUTCMonth() + 1, 0)).getUTCDate();
  hasil.setUTCDate(Math.min(hari, akhirBulan));
  return hasil;
}

/* ── Peringatan H-7 / H-3 / H-1 ─────────────────────────────────
   Dismissal hanya berlaku pada tanggal WIB dan ambang yang sama. */
export const ambangPeringatan = (sisa: number) => (sisa <= 1 ? 1 : sisa <= 3 ? 3 : 7);
const PREFIX_TUTUP = "pro-warn-dismissed-";

export function sudahDitutup(sisa: number, sekarang = new Date()): boolean {
  try {
    const hariIni = sekarang.toLocaleDateString("en-CA", { timeZone: ZONA });
    return localStorage.getItem(PREFIX_TUTUP + hariIni) === String(ambangPeringatan(sisa));
  } catch { /* storage diblok → tampilkan aja */ }
  return false;
}

export function tutupPeringatan(sisa: number, sekarang = new Date()) {
  try {
    const hariIni = sekarang.toLocaleDateString("en-CA", { timeZone: ZONA });
    localStorage.setItem(PREFIX_TUTUP + hariIni, String(ambangPeringatan(sisa)));
    /* Bersihin kunci lebih dari 10 hari — gak ada gunanya lagi. */
    const batas = sekarang.getTime() - 10 * HARI;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX_TUTUP) && new Date(k.slice(PREFIX_TUTUP.length)).getTime() < batas) {
        localStorage.removeItem(k);
      }
    }
  } catch { /* abaikan */ }
}
