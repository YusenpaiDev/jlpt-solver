import { ambilSetelan } from "@/lib/honix-setelan";

/**
 * Suara Honix (HANDOFF-honix §6). Sementara bunyi sintetis Web Audio —
 * file .mp3/.ogg produksi nanti di public/sfx/honix/.
 *
 * Aturan yang dijaga di sini, bukan di pemanggil:
 *   · pengaturan Suara Honix mati → diam
 *   · tab gak aktif, atau ada <audio>/<video> lagi muter (Choukai) → diam
 *   · AudioContext baru dibuat setelah user pernah interaksi (autoplay)
 *   · maksimal 1 bunyi per 400ms — yang baru motong yang lama
 */

export type HonixCue = "chirp" | "ting" | "salah" | "chime" | "fanfare" | "soft";

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let terakhir = 0;

function nada(out: GainNode, f: number, t: number, d: number, type: OscillatorType = "sine", v = 0.1, f2?: number) {
  const ctx = out.context;
  const o = ctx.createOscillator(), g = ctx.createGain(), n = ctx.currentTime + t;
  o.type = type;
  o.frequency.setValueAtTime(f, n);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, n + d * 0.8);
  g.gain.setValueAtTime(0, n);
  g.gain.linearRampToValueAtTime(v, n + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, n + d);
  o.connect(g).connect(out);
  o.start(n);
  o.stop(n + d + 0.02);
}

const CUE: Record<HonixCue, (out: GainNode) => void> = {
  ting: o => { nada(o, 1318, 0, 0.22, "sine", 0.11); nada(o, 1976, 0.06, 0.3, "sine", 0.07); },
  salah: o => nada(o, 294, 0, 0.22, "triangle", 0.07, 233),
  chime: o => [523, 659, 784, 1047].forEach((f, i) => nada(o, f, i * 0.09, 0.5, "sine", 0.08)),
  fanfare: o => { [523, 659, 784, 1047, 1319].forEach((f, i) => nada(o, f, i * 0.08, 0.6, "sine", 0.08)); nada(o, 1568, 0.45, 0.8, "sine", 0.05); },
  chirp: o => { nada(o, 1800, 0, 0.08, "sine", 0.06, 2600); nada(o, 2100, 0.1, 0.08, "sine", 0.06, 3000); },
  soft: o => { nada(o, 523, 0, 0.4, "sine", 0.05); nada(o, 659, 0.12, 0.5, "sine", 0.04); },
};

function adaMediaMuter(): boolean {
  return Array.from(document.querySelectorAll("audio, video"))
    .some(m => !(m as HTMLMediaElement).paused);
}

/** `paksa` = abaikan toggle suara (tombol "Tes suara" di Pengaturan). */
export function putarHonix(cue: HonixCue, { paksa = false }: { paksa?: boolean } = {}) {
  if (typeof window === "undefined") return;
  if (!paksa && !ambilSetelan().suara) return;
  if (document.hidden || adaMediaMuter()) return;
  const aktivasi = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (aktivasi && !aktivasi.hasBeenActive) return;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ac ??= new Ctx();
    if (ac.state === "suspended") void ac.resume();
    const kini = performance.now();
    if (master && kini - terakhir < 400) master.disconnect();
    terakhir = kini;
    master = ac.createGain();
    master.connect(ac.destination);
    CUE[cue](master);
  } catch { /* browser tanpa Web Audio — diam aja */ }
}

/** Urutan "Tes suara" di Pengaturan → Honix. */
export function tesSuaraHonix() {
  (["chirp", "ting", "salah", "chime", "fanfare", "soft"] as HonixCue[])
    .forEach((c, i) => setTimeout(() => putarHonix(c, { paksa: true }), i * 900));
}
