import { createClient } from "@/lib/supabase/client";
import { rapikanTur, TUR_AWAL, type TurState } from "@/lib/honix-tur";

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
  /** Jadwal tur cara pakai (honix-tur.ts). */
  tur: TurState;
}

export const SETELAN_AWAL: HonixSetelan = { suara: true, reaksi: "normal", gerakan: null, tur: TUR_AWAL };

const LS_KEY = "honix-setelan-v1";

let setelan: HonixSetelan = SETELAN_AWAL;
let sudahMulai = false;
/* true setelah isi akun kebaca (atau pasti gak bisa: belum login / offline).
   Tur nunggu ini — kalau nggak, perangkat kedua sempat muter tur dari cache
   lokal yang masih kosong. */
let siap = false;
const pendengar = new Set<() => void>();

function rapikan(x: unknown): Partial<HonixSetelan> {
  if (!x || typeof x !== "object") return {};
  const o = x as Record<string, unknown>;
  const hasil: Partial<HonixSetelan> = {};
  if (typeof o.suara === "boolean") hasil.suara = o.suara;
  if (o.reaksi === "normal" || o.reaksi === "jarang" || o.reaksi === "mati") hasil.reaksi = o.reaksi;
  if (o.gerakan === "normal" || o.gerakan === "kurangi" || o.gerakan === null) hasil.gerakan = o.gerakan;
  if ("tur" in o) hasil.tur = rapikanTur(o.tur);
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
    } catch { /* offline — pakai lokal */ }
    finally { siap = true; kabari(); }
  })();
}

export function langganSetelan(f: () => void) {
  mulai();
  pendengar.add(f);
  return () => { pendengar.delete(f); };
}

export function ambilSetelan(): HonixSetelan { return setelan; }
export function ambilSetelanServer(): HonixSetelan { return SETELAN_AWAL; }
export const ambilSiap = () => siap;
export const ambilSiapServer = () => false;

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
