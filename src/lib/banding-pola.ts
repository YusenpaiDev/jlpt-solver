/* Bandingin pola mirip + drill pilih pola (handoff Rencana Belajar §8).
   Murni: grup & soal dibentuk dari data Bunpou (confusableWith + contoh kalimat). */

export interface PolaBanding {
  id: string;
  pattern: string;
  meaning: string;
  discriminator: string;
  quickTip: string;
  examples: { jp: string; highlight: string; id: string }[];
  confusableWith: string[];
}

export interface SoalBanding {
  sebelum: string;
  isi: string;
  sesudah: string;
  terjemahan: string;
  /** Indeks pola yang benar di dalam grup. */
  jawab: number;
}

/** Maks pola dalam satu perbandingan (handoff: 2–3). */
export const MAKS_GRUP = 3;

export function grupBanding<T extends PolaBanding>(pola: T, byId: Map<string, T>): T[] {
  const mirip = pola.confusableWith.map(id => byId.get(id)).filter((x): x is T => Boolean(x) && x!.id !== pola.id);
  return [pola, ...mirip].slice(0, MAKS_GRUP);
}

/** [sebelum, pola, sesudah], atau null kalau sorotan gak ketemu di kalimat. */
export function pisahContoh(jp: string, sorot: string): [string, string, string] | null {
  if (!sorot) return null;
  const i = jp.indexOf(sorot);
  return i < 0 ? null : [jp.slice(0, i), sorot, jp.slice(i + sorot.length)];
}

/** Satu soal isian per contoh kalimat di grup, diacak. */
export function soalBanding(grup: PolaBanding[], acak: () => number = Math.random): SoalBanding[] {
  const out: SoalBanding[] = [];
  grup.forEach((p, jawab) => {
    for (const e of p.examples) {
      const bagi = pisahContoh(e.jp, e.highlight);
      if (bagi) out.push({ sebelum: bagi[0], isi: bagi[1], sesudah: bagi[2], terjemahan: e.id, jawab });
    }
  });
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(acak() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Total salah (bunpou_progress) di antara pola dalam grup. */
export function salahDiGrup(grup: PolaBanding[], progres: Map<string, { benar: number; salah: number }>): number {
  return grup.reduce((n, p) => n + (progres.get(p.pattern)?.salah ?? 0), 0);
}
