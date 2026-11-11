/* Deck Kotoba & Bunpou per level, di-load pas perlu biar bundle awal ringan.
   Satu sumber buat /materi, kurikulum, tes penempatan, dan ulangan. */

import type { Kata, Pola } from "@/lib/soal-kurikulum";
import { susunUnit, type Prioritas, type Unit } from "@/lib/kurikulum";

export type Lv = "N1" | "N2" | "N3" | "N4" | "N5";
export interface DekKotoba { groupOrder: string[]; vocabulary: Kata[] }
export interface DekBunpou { groups: { key: string; name: string; jp: string }[]; patterns: Pola[] }

const KOTOBA: Record<Lv, () => Promise<DekKotoba>> = {
  N5: () => import("@/data/kotoba/N5.json").then(m => m.default as DekKotoba),
  N4: () => import("@/data/kotoba/N4.json").then(m => m.default as DekKotoba),
  N3: () => import("@/data/kotoba/N3.json").then(m => m.default as DekKotoba),
  N2: () => import("@/data/kotoba/N2.json").then(m => m.default as DekKotoba),
  N1: () => import("@/data/kotoba/N1.json").then(m => m.default as DekKotoba),
};
const BUNPOU: Record<Lv, () => Promise<DekBunpou>> = {
  N5: () => import("@/data/bunpou/N5.json").then(m => m.default as unknown as DekBunpou),
  N4: () => import("@/data/bunpou/N4.json").then(m => m.default as unknown as DekBunpou),
  N3: () => import("@/data/bunpou/N3.json").then(m => m.default as unknown as DekBunpou),
  N2: () => import("@/data/bunpou/N2.json").then(m => m.default as unknown as DekBunpou),
  N1: () => import("@/data/bunpou/N1.json").then(m => m.default as unknown as DekBunpou),
};

/* Seberapa sering kata/pola keluar di soal (scripts/hitung-prioritas.mjs). N5 belum ada set → kosong. */
const PRIORITAS: Record<Lv, () => Promise<Prioritas>> = {
  N5: async () => ({}),
  N4: () => import("@/data/prioritas/N4.json").then(m => m.default as Prioritas),
  N3: () => import("@/data/prioritas/N3.json").then(m => m.default as Prioritas),
  N2: () => import("@/data/prioritas/N2.json").then(m => m.default as Prioritas),
  N1: () => import("@/data/prioritas/N1.json").then(m => m.default as Prioritas),
};

const lv = (l: string): Lv => (l in KOTOBA ? l : "N3") as Lv;
export const muatKotoba = (l: string) => KOTOBA[lv(l)]();
export const muatBunpou = (l: string) => BUNPOU[lv(l)]();
export const muatPrioritas = (l: string) => PRIORITAS[lv(l)]();

/** 26 unit level itu — satu sumber urutan buat kurikulum, latihan per unit, dan tes penempatan. */
export async function muatUnit(l: string): Promise<Unit[]> {
  const [k, b, p] = await Promise.all([muatKotoba(l), muatBunpou(l), muatPrioritas(l)]);
  return susunUnit(k.vocabulary, b.patterns, p);
}

/** `?unit=5` atau `?unit=5,6` (dua unit seminggu) → nomor unit yang valid. */
export const bacaUnit = (s: string | null) =>
  (s ?? "").split(",").map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 26);
