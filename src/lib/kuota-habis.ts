import { BATAS, adalahFitur, type Fitur } from "@/lib/batas-paket";

/** Isi 429 dari responsKuota() di src/lib/kuota.ts. */
export interface KuotaHabis {
  feature: Fitur;
  used: number;
  limit: number;
  resetAt: string;
  plan: "free" | "pro";
  message: string;
}

/**
 * Baca respons fetch → KuotaHabis kalau itu 429 kuota, selain itu null.
 * `json` dikirim terpisah karena body cuma bisa dibaca sekali dan pemanggil
 * biasanya udah butuh isinya buat jalur normal.
 */
export function bacaKuotaHabis(res: Response, json: unknown): KuotaHabis | null {
  if (res.status !== 429 || !json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  if (!adalahFitur(j.feature)) return null;
  const f = j.feature;
  return {
    feature: f,
    used: Number(j.used) || BATAS[f].free,
    limit: Number(j.limit) || BATAS[f].free,
    resetAt: typeof j.resetAt === "string" ? j.resetAt : "",
    plan: j.plan === "pro" ? "pro" : "free",
    message: typeof j.message === "string" ? j.message : "Jatah harian habis.",
  };
}

/** "sekitar 9 jam lagi" / "sekitar 25 menit lagi" */
export function sisaWaktuReset(resetAt: string, sekarang = Date.now()): string {
  const ms = new Date(resetAt).getTime() - sekarang;
  if (!Number.isFinite(ms) || ms <= 0) return "sebentar lagi";
  const jam = Math.floor(ms / 3_600_000);
  if (jam >= 1) return `${jam} jam lagi`;
  return `${Math.max(1, Math.round(ms / 60_000))} menit lagi`;
}
