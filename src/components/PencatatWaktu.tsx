"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { tanggalLokal } from "@/lib/aktivitas";
import {
  halamanBelajar, detikDihitung, KIRIM_TIAP_DETIK, MAKS_DETIK_SEKALI_KIRIM, EVENT_WAKTU,
} from "@/lib/waktu-belajar";

/* Mencatat lama belajar di semua halaman belajar. Gak nampilin apa-apa. */
export function PencatatWaktu() {
  const path = usePathname();
  const belajar = halamanBelajar(path ?? "");
  const terakhirGerak = useRef(0);
  const antre = useRef({ tanggal: "", detik: 0 });

  /* Gerakan apa pun di halaman = user masih di depan layar. */
  useEffect(() => {
    terakhirGerak.current = Date.now();
    const gerak = () => { terakhirGerak.current = Date.now(); };
    const ev = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"] as const;
    ev.forEach(e => window.addEventListener(e, gerak, { passive: true, capture: true }));
    return () => ev.forEach(e => window.removeEventListener(e, gerak, { capture: true }));
  }, []);

  useEffect(() => {
    if (!belajar) return;

    const kirim = async () => {
      const { tanggal, detik } = antre.current;
      if (detik <= 0) return;
      antre.current = { tanggal, detik: 0 };
      const { error } = await createClient()
        .rpc("catat_waktu", { p_tanggal: tanggal, p_detik: detik });
      if (error) {
        // Dicoba lagi di kiriman berikutnya, kalau tanggalnya masih sama.
        if (antre.current.tanggal === tanggal) {
          antre.current.detik = Math.min(antre.current.detik + detik, MAKS_DETIK_SEKALI_KIRIM);
        }
        console.warn(`[waktu belajar] gagal catat ${detik} detik (${tanggal}): ${error.message}`);
        return;
      }
      window.dispatchEvent(new Event(EVENT_WAKTU));
    };

    const detak = setInterval(() => {
      const hidup = detikDihitung({
        sekarang: Date.now(),
        terakhirGerak: terakhirGerak.current,
        terlihat: document.visibilityState === "visible",
        mediaJalan: Array.from(document.querySelectorAll("audio, video"))
          .some(m => !(m as HTMLMediaElement).paused && !(m as HTMLMediaElement).ended),
      });
      if (!hidup) return;
      const hariIni = tanggalLokal();
      if (antre.current.tanggal !== hariIni) {
        void kirim(); // sisa hari kemarin dikirim dulu, jangan masuk ke hari ini
        antre.current = { tanggal: hariIni, detik: 0 };
      }
      antre.current.detik += 1;
      if (antre.current.detik >= KIRIM_TIAP_DETIK) void kirim();
    }, 1000);

    const pasSembunyi = () => { if (document.visibilityState === "hidden") void kirim(); };
    document.addEventListener("visibilitychange", pasSembunyi);
    window.addEventListener("pagehide", kirim);

    return () => {
      clearInterval(detak);
      document.removeEventListener("visibilitychange", pasSembunyi);
      window.removeEventListener("pagehide", kirim);
      void kirim(); // keluar dari halaman belajar
    };
  }, [belajar]);

  return null;
}
