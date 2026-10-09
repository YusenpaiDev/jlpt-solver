"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HonixTur } from "./HonixTur";
import { HonixTawarTur } from "./HonixTawarTur";
import { useHonix } from "@/lib/use-honix";
import { dengarPemicuTur, keputusanTur, LANGKAH_DESKTOP, LANGKAH_HP } from "@/lib/honix-tur";

const DAFTAR = { desktop: LANGKAH_DESKTOP, hp: LANGKAH_HP };

/**
 * Dipasang sekali di NavRail → ada di tiap halaman yang punya navigasi,
 * gak ada di player latihan / onboarding / login. Keputusan tur diambil
 * sekali per halaman, setelah setelan akun kebaca.
 */
export function HonixTurHost() {
  const { setelan, siap, ubah } = useHonix();
  const router = useRouter();
  const [mode, setMode] = useState<"tur" | "tawar" | null>(null);
  const [diputuskan, setDiputuskan] = useState(false);

  useEffect(() => dengarPemicuTur(p => { if (p === "tur" || p === "tawar") setMode(p); }), []);

  /* Diputuskan pas render (bukan di effect) begitu setelan siap — sekali aja. */
  if (siap && !diputuskan) {
    setDiputuskan(true);
    setMode(keputusanTur(setelan.tur, new Date()));
  }

  const catat = () => ubah({ tur: { ...setelan.tur, terakhir: new Date().toISOString() } });

  if (mode === "tur") {
    return <HonixTur daftar={DAFTAR} onSelesai={() => { catat(); setMode(null); }}
      aksiAkhir={{ label: "Mulai latihan", onClick: () => router.push("/latihan/kilat") }} />;
  }
  if (mode === "tawar") {
    return <HonixTawarTur onLihat={() => { catat(); setMode("tur"); }} onNanti={() => { catat(); setMode(null); }} />;
  }
  return null;
}
