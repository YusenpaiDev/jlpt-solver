/* Hitungan kalender cap + total waktu belajar (mockup Rencana Belajar §10).
   Murni, tanpa Supabase: tanggal selalu string YYYY-MM-DD tanggal lokal user. */

export interface HariBelajar {
  tanggal: string;
  /** Menit aktif dari pencatat waktu (waktu_belajar). */
  menit: number;
  /** Ada perbuatan belajar (aktivitas_harian), termasuk hari sebelum menit dicatat. */
  aktif: boolean;
  sumber: string[];
}

export interface RingkasanWaktu {
  totalMenit: number;
  hariIni: number;
  /** 7 hari terakhir termasuk hari ini. */
  tujuhHari: number;
  rataTujuhHari: number;
  rekor: { tanggal: string; menit: number } | null;
  /** Hari pertama menit belajar kecatat. */
  sejak: string | null;
  /** Hari yang ada menitnya. */
  hariBelajar: number;
}

/** Ukuran cap: <10 · 10–19 · 20–39 · 40+ menit. */
export function tingkatMenit(menit: number): 0 | 1 | 2 | 3 | 4 {
  return !menit ? 0 : menit < 10 ? 1 : menit < 20 ? 2 : menit < 40 ? 3 : 4;
}

export function jamMenit(menit: number): string {
  return menit < 60 ? `${menit} mnt` : `${Math.floor(menit / 60)} j ${menit % 60} m`;
}

export function tambahHari(tanggal: string, n: number): string {
  const [y, m, d] = tanggal.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function gabungHari(
  waktu: { tanggal: string; detik: number }[],
  aktivitas: { tanggal: string; sumber: string[] | null }[],
): Map<string, HariBelajar> {
  const hari = new Map<string, HariBelajar>();
  const ambil = (t: string) => hari.get(t) ?? hari.set(t, { tanggal: t, menit: 0, aktif: false, sumber: [] }).get(t)!;
  for (const w of waktu) ambil(w.tanggal).menit += Math.round(Math.max(0, w.detik) / 60);
  for (const a of aktivitas) {
    const h = ambil(a.tanggal);
    h.aktif = true;
    h.sumber = [...(a.sumber ?? [])];
  }
  return hari;
}

export function ringkasWaktu(hari: Map<string, HariBelajar>, hariIni: string): RingkasanWaktu {
  const awalMinggu = tambahHari(hariIni, -6);
  let totalMenit = 0, tujuhHari = 0, hariBelajar = 0;
  let rekor: RingkasanWaktu["rekor"] = null;
  let sejak: string | null = null;
  for (const h of [...hari.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal))) {
    if (!h.menit) continue;
    totalMenit += h.menit;
    hariBelajar++;
    sejak ??= h.tanggal;
    if (h.tanggal >= awalMinggu && h.tanggal <= hariIni) tujuhHari += h.menit;
    if (!rekor || h.menit > rekor.menit) rekor = { tanggal: h.tanggal, menit: h.menit };
  }
  return {
    totalMenit, hariIni: hari.get(hariIni)?.menit ?? 0, tujuhHari,
    rataTujuhHari: Math.round(tujuhHari / 7), rekor, sejak, hariBelajar,
  };
}

/** Sel kosong sebelum tanggal 1 (minggu mulai Senin) + jumlah hari. bulan0: 0–11. */
export function selBulan(tahun: number, bulan0: number) {
  const hariPertama = new Date(Date.UTC(tahun, bulan0, 1)).getUTCDay();
  return { kosongDepan: (hariPertama + 6) % 7, jumlahHari: new Date(Date.UTC(tahun, bulan0 + 1, 0)).getUTCDate() };
}

/** Bulan pertama yang ada datanya s/d bulan ini, sebagai [tahun, bulan0]. */
export function rentangBulan(hari: Map<string, HariBelajar>, hariIni: string) {
  const bulanDari = (t: string): [number, number] => [Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 1];
  const pertama = [...hari.keys()].sort()[0];
  return { awal: bulanDari(pertama && pertama < hariIni ? pertama : hariIni), akhir: bulanDari(hariIni) };
}

/** Soal dijawab + bagian per hari, dari sesi latihan yang tanggalnya udah dihitung pemanggil. */
export function rekapPerHari(sesi: { tanggal: string; soal: number; bagian: string[] }[]) {
  const per = new Map<string, { soal: number; bagian: string[] }>();
  for (const s of sesi) {
    if (s.soal <= 0) continue;
    const r = per.get(s.tanggal) ?? per.set(s.tanggal, { soal: 0, bagian: [] }).get(s.tanggal)!;
    r.soal += s.soal;
    for (const b of s.bagian) if (!r.bagian.includes(b)) r.bagian.push(b);
  }
  return per;
}
