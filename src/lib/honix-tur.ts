import type { HonixPose } from "./honix-pose";

/**
 * Tur Honix — cara pakai Sensei JLPT (spec 2026-10-09-honix-tur-design).
 * Sorot ikon menu navigasi satu per satu; file ini cuma data + keputusan
 * jadwal (murni, dites di tests/honix-tur.test.mjs). UI di HonixTur.tsx.
 */

/** Disimpan di profiles.honix_settings.tur. */
export interface TurState {
  /** ISO — terakhir tur selesai/dilewati atau tawaran dijawab. null = belum pernah. */
  terakhir: string | null;
  /** Tawaran bulanan nyala? */
  ingatkan: boolean;
}

export const TUR_AWAL: TurState = { terakhir: null, ingatkan: true };
export const HARI_TAWAR = 30;

export function rapikanTur(x: unknown): TurState {
  if (!x || typeof x !== "object") return TUR_AWAL;
  const o = x as Record<string, unknown>;
  return {
    terakhir: typeof o.terakhir === "string" ? o.terakhir : null,
    ingatkan: typeof o.ingatkan === "boolean" ? o.ingatkan : true,
  };
}

/** "tur" = putar otomatis, "tawar" = tanya di pojok, null = diam. */
export function keputusanTur(tur: TurState, kini: Date): "tur" | "tawar" | null {
  const lalu = tur.terakhir ? Date.parse(tur.terakhir) : NaN;
  if (Number.isNaN(lalu)) return "tur";
  if (!tur.ingatkan) return null;
  return kini.getTime() - lalu >= HARI_TAWAR * 86_400_000 ? "tawar" : null;
}

export interface LangkahTur {
  /** Nilai `data-tur` di item nav; null = balon di tengah layar. */
  target: string | null;
  pose: HonixPose;
  judul: string;
  isi: string;
}

const AWAL: LangkahTur = { target: null, pose: "senang", judul: "Hai, aku Honix!", isi: "Aku ajak keliling sebentar, cuma ±1 menit." };
const AKHIR: LangkahTur = { target: null, pose: "lulus", judul: "Siap!", isi: "Mulai dari Latihan Kilat?" };

const INTI: LangkahTur[] = [
  { target: "beranda", pose: "tunjuk", judul: "Beranda", isi: "Pusat harimu: target, streak, dan lanjut latihan." },
  { target: "materi", pose: "baca", judul: "Materi", isi: "Kotoba, Bunpou, Bank Soal 過去問, dan Choukai per level." },
  { target: "lembar-tugas", pose: "tunjuk", judul: "Lembar Tugas", isi: "Bikin set soal latihan dari materi pilihanmu." },
  { target: "kamus", pose: "tunjuk", judul: "Kamus", isi: "Simpan kata, terus hafalin pakai FLASH." },
];

export const LANGKAH_DESKTOP: LangkahTur[] = [
  AWAL, ...INTI,
  { target: "catatan", pose: "baca", judul: "Catatan", isi: "Tulis poin penting biar gampang diulang." },
  { target: "progres", pose: "terbang", judul: "Progres", isi: "Akurasi, kategori terlemah, dan riwayat latihanmu." },
  { target: "pengaturan", pose: "tunjuk", judul: "Pengaturan", isi: "Tur ini bisa kamu putar lagi di sini kapan aja." },
  AKHIR,
];

/** HP: Catatan, Progres, Pengaturan ada di sheet "Lainnya". */
export const LANGKAH_HP: LangkahTur[] = [
  AWAL, ...INTI,
  { target: "lainnya", pose: "tunjuk", judul: "Lainnya", isi: "Catatan, Progres, dan Pengaturan — tempat tur ini bisa diputar lagi." },
  AKHIR,
];

/* Pemicu manual (Pengaturan, pratinjau dev) → host yang lagi kepasang. */
type Pemicu = "tur" | "tawar";
const pendengar = new Set<(p: Pemicu) => void>();
export function dengarPemicuTur(f: (p: Pemicu) => void) {
  pendengar.add(f);
  return () => { pendengar.delete(f); };
}
export const mulaiTur = () => pendengar.forEach(f => f("tur"));
export const tawarkanTur = () => pendengar.forEach(f => f("tawar"));
