/* Kapan animasi "ngecap" diputar: cap hari ini baru muncul, atau naik tingkat
   (lebih lama belajar → cap lebih gede). Sekali aja per perubahan. */

export const KUNCI_CAP = "honix:cap-dilihat";

/** `simpanan` = isi localStorage terakhir; `tingkat` 0 = belum ada cap hari ini. */
export function periksaCapBaru(simpanan: string | null, tanggal: string, tingkat: number): { baru: boolean; simpan: string } {
  let lama: { t?: unknown; k?: unknown } = {};
  try { lama = JSON.parse(simpanan ?? "{}") ?? {}; } catch { lama = {}; }
  const hariSama = lama.t === tanggal;
  const tingkatLama = hariSama && typeof lama.k === "number" ? lama.k : 0;
  return {
    baru: tingkat > tingkatLama,
    simpan: JSON.stringify({ t: tanggal, k: Math.max(tingkat, tingkatLama) }),
  };
}
