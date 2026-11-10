/* "Lanjut dari terakhir" di /materi: kelompok Kotoba / Bunpou yang terakhir
   dibuka. Kenyamanan per perangkat aja (localStorage), bukan data penting. */

const KUNCI = "honix:terakhir-dibuka";

export interface TerakhirItem { level: string; grup: string; pola?: string; at: string }
export interface Terakhir { kotoba?: TerakhirItem; bunpou?: TerakhirItem }

export function bacaTerakhir(): Terakhir {
  try {
    const v = JSON.parse(localStorage.getItem(KUNCI) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch { return {}; }
}

export function catatTerakhir(jenis: "kotoba" | "bunpou", item: Omit<TerakhirItem, "at">) {
  try {
    const v = bacaTerakhir();
    v[jenis] = { ...item, at: new Date().toISOString() };
    localStorage.setItem(KUNCI, JSON.stringify(v));
  } catch { /* mode privat — gpp */ }
}

/** "kemarin", "2 hari lalu", … */
export function kapan(iso: string | null | undefined, sekarang = Date.now()): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const hari = Math.floor((sekarang - t) / 86_400_000);
  if (hari < 1) return "hari ini";
  if (hari < 2) return "kemarin";
  if (hari < 7) return `${hari} hari lalu`;
  if (hari < 30) return `${Math.floor(hari / 7)} minggu lalu`;
  return new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}
