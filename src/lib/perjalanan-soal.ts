/* Bank Soal = perjalanan 桜 → 鳳 (HANDOFF-materi-bank-soal §3).
   Satu "pos" = satu set latihan format JLPT (筆記 + 聴解). Sengaja tanpa
   tanggal sesi ujian: namanya pos, bukan "ujian asli per sesi". */

import type { SetUjian } from "./bank-soal";

export const POS: readonly (readonly [string, string])[] = [
  ["桜", "Sakura"], ["梅", "Ume"], ["菊", "Kiku"], ["椿", "Tsubaki"], ["蓮", "Hasu"], ["竹", "Take"],
  ["松", "Matsu"], ["楓", "Kaede"], ["雪", "Yuki"], ["雨", "Ame"], ["風", "Kaze"], ["雷", "Kaminari"],
  ["虹", "Niji"], ["月", "Tsuki"], ["星", "Hoshi"], ["空", "Sora"], ["海", "Umi"], ["山", "Yama"],
  ["川", "Kawa"], ["森", "Mori"], ["波", "Nami"], ["霧", "Kiri"], ["朝", "Asa"], ["夕", "Yuu"],
  ["光", "Hikari"], ["鶴", "Tsuru"], ["狐", "Kitsune"], ["龍", "Ryuu"], ["鳳", "Hou"],
];

/** Ambang "perlu diulang" (PLACEHOLDER, HANDOFF §3). */
export const AMBANG_ULANG = 60;

export type StatusBagian = "belum" | "sebagian" | "selesai" | "segera";
export type StatusPos = "belum" | "sebagian" | "kurang" | "bagus" | "segera";

export interface Bagian {
  set: SetUjian;
  status: StatusBagian;
  /** skor % kalau selesai */
  skor: number | null;
  dijawab: number;
}

export interface Pos {
  no: number;
  kj: string;
  ro: string;
  /** kunci urut (tahun×100 + bulan) — cuma buat ngurutin, gak ditampilin */
  urut: number;
  hikki?: Bagian;
  choukai?: Bagian;
  status: StatusPos;
}

export function statusBagian(s: SetUjian): Bagian {
  const skor = s.score != null && s.total > 0 ? Math.round((s.score / s.total) * 100) : null;
  const dijawab = Math.max(0, Math.min(s.total, s.dijawab ?? 0));
  const status: StatusBagian = s.ready === false ? "segera"
    : skor != null ? "selesai"
    : s.id && dijawab > 0 ? "sebagian"
    : "belum";
  return { set: s, status, skor, dijawab };
}

/** Kunci grup 筆記 + 聴解 = tahun-bulan di judul; judul tanpa tanggal = grup sendiri. */
function kunciGrup(title: string): { kunci: string; urut: number } {
  const m = title.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月/);
  return m ? { kunci: `${m[1]}-${+m[2]}`, urut: +m[1] * 100 + +m[2] } : { kunci: title, urut: 0 };
}

export function statusPos(bagian: Bagian[]): StatusPos {
  const siap = bagian.filter(b => b.status !== "segera");
  if (!siap.length) return "segera";
  if (siap.every(b => b.status === "selesai")) {
    return siap.some(b => (b.skor ?? 0) < AMBANG_ULANG) ? "kurang" : "bagus";
  }
  if (siap.some(b => b.status !== "belum")) return "sebagian";
  return "belum";
}

/** Set level target → pos, urut perjalanan (Pos 01 = set terbaru). */
export function susunPerjalanan(set: SetUjian[]): Pos[] {
  const grup = new Map<string, { urut: number; hikki?: SetUjian; choukai?: SetUjian }>();
  for (const s of set) {
    const { kunci, urut } = kunciGrup(s.title);
    const g = grup.get(kunci) ?? { urut };
    if (s.section === "choukai") g.choukai ??= s; else g.hikki ??= s;
    grup.set(kunci, g);
  }
  return [...grup.values()].sort((a, b) => b.urut - a.urut).map((g, i) => {
    const hikki = g.hikki ? statusBagian(g.hikki) : undefined;
    const choukai = g.choukai ? statusBagian(g.choukai) : undefined;
    const [kj, ro] = POS[i % POS.length];
    return { no: i + 1, kj, ro, urut: g.urut, hikki, choukai, status: statusPos([hikki, choukai].filter(Boolean) as Bagian[]) };
  });
}

export const menyala = (p: Pos) => p.status === "bagus" || p.status === "kurang";

/** "Berikutnya buat kamu": set setengah jalan yang paling baru dikerjain;
    kalau gak ada, pos pertama yang siap & belum dimulai; semua kelar → null. */
export function berikutnya(pos: Pos[]): { pos: Pos; bagian: Bagian; alasan: "lanjut" | "baru" } | null {
  const jalan = pos.flatMap(p => [p.hikki, p.choukai]
    .filter((b): b is Bagian => b?.status === "sebagian")
    .map(b => ({ pos: p, bagian: b })));
  if (jalan.length) {
    const waktu = (b: Bagian) => Date.parse(b.set.terakhir ?? b.set.created_at ?? "") || 0;
    jalan.sort((a, b) => waktu(b.bagian) - waktu(a.bagian));
    return { ...jalan[0], alasan: "lanjut" };
  }
  const baru = pos.find(p => p.status === "belum");
  const bagian = baru && ([baru.hikki, baru.choukai].find(b => b?.status === "belum"));
  return baru && bagian ? { pos: baru, bagian, alasan: "baru" } : null;
}

export type Saring = "semua" | "belum" | "selesai";
export function cocokSaring(p: Pos, f: Saring): boolean {
  if (f === "semua") return true;
  if (f === "selesai") return menyala(p);
  return p.status === "belum" || p.status === "sebagian";
}

export function ringkasan(pos: Pos[]) {
  const siap = pos.filter(p => p.status !== "segera");
  const selesai = siap.filter(menyala);
  const skor = selesai.map(p => p.hikki?.skor).filter((n): n is number => n != null);
  return {
    siap: siap.length,
    selesai: selesai.length,
    belumLengkap: siap.length - selesai.length,
    rataHikki: skor.length ? Math.round(skor.reduce((a, b) => a + b, 0) / skor.length) : null,
  };
}
