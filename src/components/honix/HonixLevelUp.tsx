"use client";

import { useEffect, useRef, useState } from "react";
import { Honix } from "./Honix";
import { useHonix } from "@/lib/use-honix";
import { EVENT_XP_TERSIMPAN, kenaikanLevel, type XpTersimpan } from "@/lib/honix-level";
import { pilihPesan } from "@/lib/honix-pesan";
import { putarHonix } from "@/lib/honix-sfx";

/** Banner memakai pola banner streak prototype; menunggu popup hasil ditutup. */
export function HonixLevelUp() {
  const { kurangiGerak } = useHonix();
  const [aktif, setAktif] = useState<{ level: number; pesan: string } | null>(null);
  const antrean = useRef<{ level: number; sejak: number } | null>(null);
  const terlihat = useRef(false);
  const pernah = useRef(new Set<string>());

  useEffect(() => {
    let tutup: ReturnType<typeof setTimeout> | undefined;
    const terima = (event: Event) => {
      const d = (event as CustomEvent<XpTersimpan>).detail;
      const naik = kenaikanLevel(d.sebelum, d.sesudah);
      if (!naik) return;
      const kunci = `${d.userId}:${naik.ke}`;
      if (pernah.current.has(kunci)) return;
      pernah.current.add(kunci);
      antrean.current = { level: naik.ke, sejak: Date.now() };
    };
    const pemeriksa = setInterval(() => {
      const p = antrean.current;
      if (!p || terlihat.current || document.hidden || Date.now() - p.sejak < 1200) return;
      if (document.querySelector('[aria-modal="true"], .hx-rx')) return;
      antrean.current = null;
      terlihat.current = true;
      setAktif({ level: p.level, pesan: pilihPesan("naikLevel") });
      putarHonix("fanfare");
      tutup = setTimeout(() => { setAktif(null); terlihat.current = false; }, 6000);
    }, 250);
    window.addEventListener(EVENT_XP_TERSIMPAN, terima);
    return () => {
      window.removeEventListener(EVENT_XP_TERSIMPAN, terima);
      clearInterval(pemeriksa);
      clearTimeout(tutup);
    };
  }, []);

  if (!aktif) return null;
  return (
    <div className={`hx hx-level-banner${kurangiGerak ? " hx-rm" : ""}`} role="status">
      <Honix pose="lulus" size={64} sizeHp={52} entry="in-pop" idle="none" alt="" />
      <div><strong>Level {aktif.level}!</strong><p>{aktif.pesan}</p></div>
      <button type="button" className="hx-level-close" aria-label="Tutup perayaan naik level"
        onClick={() => setAktif(null)}>×</button>
    </div>
  );
}
