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
export const JUMLAH_UNIT = 26;
export const FASE = [
  { id: "dasar", t: "Dasar", tingkat: "T1", d: "pengenalan", minggu: [1, 8], warna: "rgba(221,65,36,.38)" },
  { id: "standar", t: "Standar", tingkat: "T2", d: "standar JLPT", minggu: [9, 16], warna: "rgba(221,65,36,.66)" },
  { id: "jebakan", t: "Jebakan", tingkat: "T3", d: "soal jebakan", minggu: [17, 22], warna: "var(--primary)" },
  { id: "sim", t: "Simulasi & set latihan", tingkat: "", d: "ujian penuh", minggu: [23, 26], warna: "var(--warning)" },
] as const;
