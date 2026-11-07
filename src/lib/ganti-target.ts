/* Aturan ganti level target: alasan wajib, dan berapa kali boleh per hari.
   Dipakai halaman Pengaturan dan /api/target/ganti. */

export const LEVEL_TARGET = ["N5", "N4", "N3", "N2", "N1"] as const;
export type LevelTarget = (typeof LEVEL_TARGET)[number];

export const ALASAN_MIN = 5;
export const ALASAN_MAKS = 500;
/** Biar inbox admin gak bisa dibanjiri satu akun. */
export const GANTI_PER_HARI = 5;

export function levelValid(x: unknown): x is LevelTarget {
  return typeof x === "string" && (LEVEL_TARGET as readonly string[]).includes(x);
}

/** Alasan yang sudah dirapikan, atau pesan kenapa ditolak. */
export function cekAlasan(x: unknown): { ok: true; alasan: string } | { ok: false; pesan: string } {
  const alasan = typeof x === "string" ? x.trim().replace(/\s+/g, " ") : "";
  if (alasan.length < ALASAN_MIN) return { ok: false, pesan: "Tulis alasannya dulu, minimal 5 huruf." };
  if (alasan.length > ALASAN_MAKS) return { ok: false, pesan: `Alasannya kepanjangan, maksimal ${ALASAN_MAKS} huruf.` };
  return { ok: true, alasan };
}

/** Isi email pemberitahuan ke admin. */
export function isiEmailGantiTarget(p: {
  email: string | null; nama: string | null; dari: string | null; ke: string; alasan: string;
}): { subjek: string; teks: string } {
  const siapa = p.nama ? `${p.nama} (${p.email ?? "tanpa email"})` : (p.email ?? "tanpa email");
  return {
    subjek: `Ganti target: ${p.dari ?? "?"} → ${p.ke} · ${p.email ?? "tanpa email"}`,
    teks: [
      `${siapa} ganti level target ${p.dari ?? "(belum ada)"} → ${p.ke}.`,
      "",
      "Alasan:",
      p.alasan,
      "",
      "Daftar lengkapnya ada di /admin.",
    ].join("\n"),
  };
}
