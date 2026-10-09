"use client";

import { useEffect, useState } from "react";
import { HonixTur } from "./HonixTur";
import { useHonix } from "@/lib/use-honix";
import { dengarPemicuTur, keputusanTurHalaman, type LangkahTur } from "@/lib/honix-tur";

/**
 * Tur satu halaman: otomatis sekali (setelah tur menu beres), bisa diputar
 * ulang lewat `mulaiTurHalaman(id)` — mis. tombol "?" di header.
 */
export function HonixTurHalaman({ id, langkah }: { id: string; langkah: LangkahTur[] }) {
  const { setelan, siap, ubah } = useHonix();
  const [buka, setBuka] = useState(false);
  const [diputuskan, setDiputuskan] = useState(false);

  useEffect(() => dengarPemicuTur(p => { if (p === `halaman:${id}`) setBuka(true); }), [id]);

  /* Diputuskan pas render begitu setelan siap — sekali per kunjungan. */
  if (siap && !diputuskan) {
    setDiputuskan(true);
    if (keputusanTurHalaman(setelan.tur, id)) setBuka(true);
  }

  if (!buka) return null;
  return (
    <HonixTur daftar={{ desktop: langkah }} onSelesai={() => {
      setBuka(false);
      ubah({ tur: { ...setelan.tur, halaman: { ...setelan.tur.halaman, [id]: new Date().toISOString() } } });
    }} />
  );
}
