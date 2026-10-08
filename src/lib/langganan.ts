"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchProAccess } from "@/lib/access";
import { PAKET, adalahPaket } from "@/lib/paket";

/**
 * Data & aturan yang dipakai layar pembayaran (/premium/sukses, /langganan,
 * /langganan/berhenti, peringatan H-7). Satu tempat biar angka sisa hari dan
 * tanggal perpanjangan di empat layar itu gak bisa beda.
 */

const HARI = 86_400_000;
const ZONA = "Asia/Jakarta";

/** Nama pendek buat daftar — "Pro — Bulanan", bukan nama panjang di Midtrans. */
export const NAMA_PENDEK: Record<string, string> = {
  "pro-bulanan": "Pro — Bulanan",
  "pro-ujian": "Paket Ujian",
  lifetime: "Lifetime",
};
export const namaPendek = (id: string) => NAMA_PENDEK[id] ?? id;
export const durasiPaket = (id: string) =>
  !adalahPaket(id) ? "" : PAKET[id].bulan === null ? "selamanya" : PAKET[id].bulan === 1 ? "1 bulan" : `${PAKET[id].bulan} bulan`;

export type StatusTx = "pending" | "lunas" | "gagal" | "kadaluarsa" | "refund";
export const LABEL_TX: Record<string, { teks: string; kelas: string }> = {
  lunas:      { teks: "LUNAS",        kelas: "py-s-ok" },
  pending:    { teks: "PENDING",      kelas: "py-s-warn" },
  gagal:      { teks: "GAGAL",        kelas: "py-s-bad" },
  kadaluarsa: { teks: "KADALUARSA",   kelas: "py-s-bad" },
  refund:     { teks: "DIKEMBALIKAN", kelas: "py-s-off" },
};

/** "19 September 2026" */
export const tglPanjang = (iso: string | Date) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: ZONA });
/** "19 Agu 2026" */
export const tglPendek = (iso: string | Date) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: ZONA });
/** "14.32" */
export const jam = (iso: string | Date) =>
  new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: ZONA });
/** "19 September 2026, 23.59 WIB" */
export const tglJam = (iso: string | Date) => `${tglPanjang(iso)}, ${jam(iso)} WIB`;

/** Sisa hari dibulatkan ke atas — "habis hari ini" = 1, bukan 0. */
export const sisaHari = (until: string | null, sekarang = Date.now()) =>
  until ? Math.ceil((new Date(until).getTime() - sekarang) / HARI) : null;

export { hasilPerpanjang, ambangPeringatan, sudahDitutup, tutupPeringatan } from "@/lib/langganan-waktu";

/** Hijau <60%, kuning 60–89%, merah ≥90%. */
export const isiMeter = (pakai: number, batas: number) => {
  const p = batas > 0 ? pakai / batas : 0;
  return p >= 0.9 ? "py-f-full" : p >= 0.6 ? "py-f-warn" : "py-f-ok";
};

/* ── Data langganan ─────────────────────────────────────────── */

export interface Langganan {
  loaded: boolean;
  isPro: boolean;
  isLifetime: boolean;
  premiumUntil: string | null;
  /** Pengingat H-7/H-3/H-1. Default nyala — kolomnya mungkin belum dimigrasi. */
  pengingat: boolean;
}

export function useLangganan(): Langganan & { setPengingat: (v: boolean) => Promise<boolean> } {
  const [d, setD] = useState<Langganan>({
    loaded: false, isPro: false, isLifetime: false, premiumUntil: null, pengingat: true,
  });

  useEffect(() => {
    let batal = false;
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user || batal) return;

      const [{ data: profil }, isPro, { data: pref }] = await Promise.all([
        sb.from("profiles").select("premium_until, is_lifetime").eq("id", user.id).single(),
        fetchProAccess(sb),
        /* Query terpisah: kalau migrasi pengingat-perpanjang.sql belum jalan,
           kolomnya gak ada dan query ini error — yang lain tetap kebaca. */
        sb.from("profiles").select("renewal_reminders_enabled").eq("id", user.id).single(),
      ]);
      if (batal) return;
      setD({
        loaded: true,
        isPro,
        isLifetime: profil?.is_lifetime === true,
        premiumUntil: (profil?.premium_until as string | null) ?? null,
        pengingat: (pref as { renewal_reminders_enabled?: boolean } | null)?.renewal_reminders_enabled !== false,
      });
    })();
    return () => { batal = true; };
  }, []);

  async function setPengingat(v: boolean): Promise<boolean> {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const { error } = await sb.from("profiles").update({ renewal_reminders_enabled: v }).eq("id", user.id);
    if (error) {
      console.error("[langganan] gagal simpan pengingat:", error.message);
      return false;
    }
    setD(x => ({ ...x, pengingat: v }));
    return true;
  }

  return { ...d, setPengingat };
}
