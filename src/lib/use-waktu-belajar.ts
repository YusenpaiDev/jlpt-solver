"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { tanggalLokal } from "@/lib/aktivitas";
import { gabungHari, tambahHari, type HariBelajar } from "@/lib/waktu-kalender";

/* Ditulis langsung (bukan diimport) biar Next bisa buang cabang dev di build. */
const DEV_BYPASS = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "1";

export interface WaktuBelajar {
  siap: boolean;
  gagal: boolean;
  hari: Map<string, HariBelajar>;
  hariIni: string;
  /** Target menit per hari dari onboarding / Pengaturan. */
  pace: number;
}

const PACE_BAWAAN = 20;

/** Menit per hari (waktu_belajar) + hari aktif (aktivitas_harian) milik user ini. */
export function useWaktuBelajar(): WaktuBelajar {
  const [hasil, setHasil] = useState<WaktuBelajar>(() => {
    const hariIni = tanggalLokal();
    return DEV_BYPASS
      ? { siap: true, gagal: false, hari: contohDev(hariIni), hariIni, pace: PACE_BAWAAN }
      : { siap: false, gagal: false, hari: new Map(), hariIni, pace: PACE_BAWAAN };
  });

  useEffect(() => {
    if (DEV_BYPASS) return;
    const hariIni = tanggalLokal();
    let batal = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!batal) setHasil(h => ({ ...h, siap: true, hariIni })); return; }
      const [waktu, aktivitas] = await Promise.all([
        supabase.from("waktu_belajar").select("tanggal, detik").eq("user_id", user.id),
        supabase.from("aktivitas_harian").select("tanggal, sumber").eq("user_id", user.id),
      ]);
      const pace = Number(user.user_metadata?.daily_goal_minutes);
      if (batal) return;
      setHasil({
        siap: true,
        gagal: Boolean(waktu.error && aktivitas.error),
        hari: gabungHari(waktu.data ?? [], aktivitas.data ?? []),
        hariIni,
        pace: Number.isFinite(pace) && pace > 0 ? pace : PACE_BAWAAN,
      });
    })().catch(() => { if (!batal) setHasil(h => ({ ...h, siap: true, gagal: true, hariIni })); });
    return () => { batal = true; };
  }, []);

  return hasil;
}

/* Dua bulan contoh buat cek visual lokal: beberapa hari bolong, satu hari rekor. */
function contohDev(hariIni: string) {
  const menit = [24, 18, 0, 31, 22, 9, 45, 20, 26, 0, 0, 14, 21, 38, 52, 19, 23, 7, 0, 28, 33, 21, 16, 41, 25, 0, 12, 29, 20, 35,
    22, 17, 0, 26, 30, 11, 24, 62, 19, 0, 27, 21, 15, 33, 20, 8, 25, 0, 18, 36];
  const waktu = menit.map((m, i) => ({ tanggal: tambahHari(hariIni, -i), detik: m * 60 })).filter(w => w.detik > 0);
  const sumber = ["soal", "kotoba", "bunpou", "choukai"];
  const aktivitas = waktu.map((w, i) => ({ tanggal: w.tanggal, sumber: sumber.filter((_, j) => (i + j) % 3 !== 0) }));
  return gabungHari(waktu, aktivitas);
}
