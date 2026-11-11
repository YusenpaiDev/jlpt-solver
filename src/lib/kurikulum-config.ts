/* Satu tempat buat semua flag & angka PLACEHOLDER / USULAN kurikulum
   (HANDOFF-kurikulum §4 & §15). Ubah di sini, jangan hardcode di komponen. */

export type FiturBaru = "kurikulum" | "soal_orisinal" | "penempatan" | "ulangan" | "perkiraan" | "simulasi";

/** feature_live.* — false = tampil dengan label "Sedang disiapkan", tanpa tombol aktif. */
export const FITUR_LIVE: Record<FiturBaru, boolean> = {
  kurikulum: false,
  soal_orisinal: false,
  penempatan: false,
  ulangan: false,
  perkiraan: false,
  simulasi: false,
};

/* Buat preview/dev: NEXT_PUBLIC_FITUR_LIVE="kurikulum,ulangan" atau "semua". */
const PAKSA = (process.env.NEXT_PUBLIC_FITUR_LIVE ?? "").split(",").map(s => s.trim()).filter(Boolean);

export function fiturLive(f: FiturBaru): boolean {
  return FITUR_LIVE[f] || PAKSA.includes("semua") || PAKSA.includes(f);
}

export function semuaLive(): boolean {
  return (Object.keys(FITUR_LIVE) as FiturBaru[]).every(fiturLive);
}

export const LABEL_DISIAPKAN = "Sedang disiapkan";

/* Peta 26 minggu (HANDOFF-kurikulum §3, §6). */
export { JUMLAH_UNIT } from "@/lib/kurikulum";
export const FASE = [
  { id: "dasar", t: "Dasar", tingkat: "T1", d: "pengenalan", minggu: [1, 8], warna: "rgba(221,65,36,.38)" },
  { id: "standar", t: "Standar", tingkat: "T2", d: "standar JLPT", minggu: [9, 16], warna: "rgba(221,65,36,.66)" },
  { id: "jebakan", t: "Jebakan", tingkat: "T3", d: "soal jebakan", minggu: [17, 22], warna: "var(--primary)" },
  { id: "sim", t: "Simulasi & set latihan", tingkat: "", d: "ujian penuh", minggu: [23, 26], warna: "var(--warning)" },
] as const;

/** Penanda 模 (simulasi) di peta Premium — PLACEHOLDER jadwal simulasi (§12). */
export const MINGGU_SIMULASI = [4, 8, 13, 17, 21, 24];

/** Angka aset (dihitung dari src/data per Nov 2026; soal orisinal = target). */
export const ASET = { kata: 8342, pola: 650, setPerLevel: 29, soalOrisinal: 11900 };

export function faseMinggu(u: number) {
  return FASE.find(f => u >= f.minggu[0] && u <= f.minggu[1]) ?? FASE[FASE.length - 1];
}

/** Semua angka aturan kurikulum — PLACEHOLDER dari HANDOFF-kurikulum §15. */
export const ATURAN = {
  /** jadwal ulang (hari) per tahap; salah → balik besok */
  srsInterval: [1, 3, 7, 21, 60],
  /** dari N jawaban terakhir: ≥ naik → naik tingkat, < turun → turun */
  tingkat: { jendela: 20, naik: 0.8, turun: 0.6 },
  /** posisi per bagian = minggu tertinggi dengan akurasi ≥ ambang */
  penempatan: { ambang: 0.7 },
  /** perkiraan skor: tampil kalau ≥ minTotal & ≥ minBagian per bagian; "akurat" ≥ akurat per bagian */
  perkiraan: { minTotal: 150, minBagian: 20, akurat: 100, hari: 30 },
  /** ulangan mingguan: komposisi + ambang Honix senang */
  ulangan: { kata: 12, pola: 6, jenis: 6, senang: 0.75 },
  /** momen kecil nutup sendiri setelah n detik */
  momenDetik: 8,
  /** USULAN mode sisa waktu: ≤ akhir minggu = mode Akhir (gak ada materi baru); maks unit per
      minggu kalau dipadatin; minggu terakhir sebelum ujian disisain buat ulang & simulasi;
      mode Kejar simulasi tiap n hari */
  waktu: { akhir: 4, maksPerMinggu: 2, cadangan: 1, simulasiKejar: 14 },
};
export type Aturan = typeof ATURAN;
