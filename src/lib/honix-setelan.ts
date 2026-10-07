import { createClient } from "@/lib/supabase/client";

/**
 * Pengaturan Honix (HANDOFF-honix §6). Satu store di level modul — semua
 * komponen Honix + honix-sfx baca sumber yang sama, jadi toggle speaker di
 * popup langsung ngubah Pengaturan → Honix juga.
 *
 * Sumber kebenaran = profiles.honix_settings (per akun). localStorage cuma
 * cache biar angka awal gak kedip default sebelum profil kebaca.
 */

export type FrekReaksi = "normal" | "jarang" | "mati";
export type Gerakan = "normal" | "kurangi";

export interface HonixSetelan {
  suara: boolean;
  reaksi: FrekReaksi;
  /** null = ikut prefers-reduced-motion perangkat. */
  gerakan: Gerakan | null;
}

export const SETELAN_AWAL: HonixSetelan = { suara: true, reaksi: "normal", gerakan: null };

const LS_KEY = "honix-setelan-v1";

let setelan: HonixSetelan = SETELAN_AWAL;
let sudahMulai = false;
const pendengar = new Set<() => void>();

function rapikan(x: unknown): Partial<HonixSetelan> {
  if (!x || typeof x !== "object") return {};
  const o = x as Record<string, unknown>;
  const hasil: Partial<HonixSetelan> = {};
  if (typeof o.suara === "boolean") hasil.suara = o.suara;
  if (o.reaksi === "normal" || o.reaksi === "jarang" || o.reaksi === "mati") hasil.reaksi = o.reaksi;
  if (o.gerakan === "normal" || o.gerakan === "kurangi" || o.gerakan === null) hasil.gerakan = o.gerakan;
  return hasil;
}

function kabari() { pendengar.forEach(f => f()); }

function simpanLokal() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(setelan)); } catch { /* mode privat */ }
}

/* Dipanggil sekali pas ada komponen pertama yang langganan: cache lokal dulu,
   lalu timpa pakai isi akun. Kolom belum ada (migration belum jalan) /
   belum login → tetap di nilai lokal. */
function mulai() {
  if (sudahMulai || typeof window === "undefined") return;
  sudahMulai = true;
  try {
    const lokal = localStorage.getItem(LS_KEY);
    if (lokal) setelan = { ...SETELAN_AWAL, ...rapikan(JSON.parse(lokal)) };
  } catch { /* abaikan */ }

  (async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.from("profiles")
        .select("honix_settings").eq("id", user.id).single();
      if (error || !data) return;
      setelan = { ...SETELAN_AWAL, ...rapikan(data.honix_settings) };
      simpanLokal();
      kabari();
    } catch { /* offline — pakai lokal */ }
  })();
}

export function langganSetelan(f: () => void) {
  mulai();
  pendengar.add(f);
  return () => { pendengar.delete(f); };
}

export function ambilSetelan(): HonixSetelan { return setelan; }
export function ambilSetelanServer(): HonixSetelan { return SETELAN_AWAL; }

export function ubahSetelan(patch: Partial<HonixSetelan>) {
  setelan = { ...setelan, ...patch };
  simpanLokal();
  kabari();
  (async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("profiles").update({ honix_settings: setelan }).eq("id", user.id);
    } catch { /* nyusul pas berikutnya diubah */ }
  })();
}
