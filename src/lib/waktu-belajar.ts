/* Lama belajar per hari, buat kalender, Riwayat, dan kartu pamer nanti.
   Yang dihitung cuma detik ketika user benar-benar ada di halaman belajar:
   tab kelihatan, dan dia gerak dalam 2 menit terakhir atau audio lagi diputar. */

/** Diam lebih lama dari ini dianggap ninggalin layar. */
export const BATAS_DIAM_MS = 2 * 60_000;

/** Kirim ke server tiap terkumpul segini. */
export const KIRIM_TIAP_DETIK = 60;

/** Batas satu kiriman. Sama dengan batas di catat_waktu() di database. */
export const MAKS_DETIK_SEKALI_KIRIM = 300;

/** Ditembakin ke window tiap menit belajar berhasil kesimpen (PencatatWaktu),
 *  biar kalender & angka menit yang lagi kebuka ikut update. */
export const EVENT_WAKTU = "honix:waktu-tercatat";

const HALAMAN_BELAJAR = [
  "/materi",
  "/latihan",
  "/analisis-foto", // player latihan
  "/choukai",
  "/lembar-tugas",
  "/kamus",
  "/catatan",
];

export function halamanBelajar(path: string): boolean {
  return HALAMAN_BELAJAR.some(h => path === h || path.startsWith(`${h}/`));
}

export interface Keadaan {
  sekarang: number;
  terakhirGerak: number;
  terlihat: boolean;
  mediaJalan: boolean;
}

/** Detik ini dihitung belajar atau enggak. */
export function detikDihitung({ sekarang, terakhirGerak, terlihat, mediaJalan }: Keadaan): boolean {
  if (!terlihat) return false;
  return mediaJalan || sekarang - terakhirGerak <= BATAS_DIAM_MS;
}
