export const XP_PER_LEVEL = 1000;
export const EVENT_XP_TERSIMPAN = "sensei:xp-tersimpan";

export interface XpTersimpan {
  userId: string;
  sebelum: number;
  sesudah: number;
}

export function kenaikanLevel(sebelum: number, sesudah: number): { dari: number; ke: number } | null {
  if (!Number.isFinite(sebelum) || !Number.isFinite(sesudah) || sebelum < 0 || sesudah <= sebelum) return null;
  const dari = Math.floor(sebelum / XP_PER_LEVEL) + 1;
  const ke = Math.floor(sesudah / XP_PER_LEVEL) + 1;
  return ke > dari ? { dari, ke } : null;
}

/** Hanya dipanggil setelah database mengembalikan XP yang berhasil disimpan. */
export function laporkanXp(detail: XpTersimpan) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<XpTersimpan>(EVENT_XP_TERSIMPAN, { detail }));
  }
}
