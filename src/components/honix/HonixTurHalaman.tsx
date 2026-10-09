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
  /* ?tur=<id> = dibuka dari Pengaturan → Tutorial: langsung putar. */
  const [buka, setBuka] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tur") === id);
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
      const url = new URL(window.location.href);
      if (url.searchParams.get("tur") === id) { url.searchParams.delete("tur"); history.replaceState(null, "", url); }
      ubah({ tur: { ...setelan.tur, halaman: { ...setelan.tur.halaman, [id]: new Date().toISOString() } } });
    }} />
  );
}
