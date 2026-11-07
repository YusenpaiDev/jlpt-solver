/* Ringkasan kemampuan satu akun buat Sensei. Isinya cuma angka dan
   kata/pola yang sering salah: tanpa nama, email, atau isi jawaban. */

export interface BahanProfil {
  targetLevel: unknown;
  /** Tanggal ujian YYYY-MM-DD + sisa hari, sudah dihitung pemanggil. */
  ujian: { tanggal: string; sisa_hari: number } | null;
  /** ai_result.stats dari sesi 30 hari terakhir. */
  sesi: ({ perCat?: Record<string, { a?: number; c?: number }> } | null)[];
  kotoba: { word: string; benar: number | null; salah: number | null }[];
  bunpou: { pattern: string; benar: number | null; salah: number | null }[];
  streak: number | null;
  detik7Hari: number;
}

export interface ProfilBelajar {
  target_level: string | null;
  ujian: { tanggal: string; sisa_hari: number } | null;
  akurasi_30_hari: Record<string, { dijawab: number; benar: number; persen: number }>;
  bagian_terlemah: string | null;
  kata_sering_salah: string[];
  pola_sering_salah: string[];
  streak_hari: number | null;
  menit_belajar_7_hari: number;
}

/** Bagian dihitung "terlemah" baru kalau soalnya sudah cukup banyak. */
export const MIN_SOAL_TERLEMAH = 10;
const BAGIAN = ["文字", "語彙", "文法", "読解", "聴解"];

function seringSalah<T extends { benar: number | null; salah: number | null }>(rows: T[], ambil: (r: T) => string): string[] {
  return rows
    .filter(r => (r.salah ?? 0) >= 2 && (r.salah ?? 0) > (r.benar ?? 0))
    .sort((a, b) => (b.salah ?? 0) - (a.salah ?? 0))
    .slice(0, 5)
    .map(r => ambil(r).slice(0, 30));
}

export function susunProfilBelajar(b: BahanProfil): ProfilBelajar {
  const level = typeof b.targetLevel === "string" && /^N[1-5]$/.test(b.targetLevel) ? b.targetLevel : null;

  const total: Record<string, { a: number; c: number }> = {};
  for (const s of b.sesi) {
    for (const [k, v] of Object.entries(s?.perCat ?? {})) {
      if (!BAGIAN.includes(k)) continue;
      const t = total[k] ?? (total[k] = { a: 0, c: 0 });
      t.a += Math.max(0, v?.a ?? 0);
      t.c += Math.max(0, v?.c ?? 0);
    }
  }
  const akurasi: ProfilBelajar["akurasi_30_hari"] = {};
  for (const k of BAGIAN) {
    const t = total[k];
    if (t && t.a > 0) akurasi[k] = { dijawab: t.a, benar: Math.min(t.c, t.a), persen: Math.round((Math.min(t.c, t.a) / t.a) * 100) };
  }
  const cukup = Object.entries(akurasi).filter(([, v]) => v.dijawab >= MIN_SOAL_TERLEMAH);
  const terlemah = cukup.length ? cukup.reduce((x, y) => (y[1].persen < x[1].persen ? y : x))[0] : null;

  return {
    target_level: level,
    ujian: b.ujian && b.ujian.sisa_hari >= 0 ? b.ujian : null,
    akurasi_30_hari: akurasi,
    bagian_terlemah: terlemah,
    kata_sering_salah: seringSalah(b.kotoba, r => r.word),
    pola_sering_salah: seringSalah(b.bunpou, r => r.pattern),
    streak_hari: b.streak,
    menit_belajar_7_hari: Math.round(Math.max(0, b.detik7Hari) / 60),
  };
}
