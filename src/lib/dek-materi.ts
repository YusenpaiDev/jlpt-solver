/* Deck Kotoba & Bunpou per level, di-load pas perlu biar bundle awal ringan.
   Satu sumber buat /materi, kurikulum, tes penempatan, dan ulangan. */

import type { Kata, Pola } from "@/lib/soal-kurikulum";

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

const lv = (l: string): Lv => (l in KOTOBA ? l : "N3") as Lv;
export const muatKotoba = (l: string) => KOTOBA[lv(l)]();
export const muatBunpou = (l: string) => BUNPOU[lv(l)]();
