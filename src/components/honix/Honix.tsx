"use client";

import "@/styles/honix.css";
import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { useHonix } from "@/lib/use-honix";
import { honixSrc, type HonixPose } from "@/lib/honix-pose";

/**
 * Honix, maskot phoenix (HANDOFF-honix §1). Semua komponen Honix lain
 * dibangun dari sini.
 *
 * Dua lapis, sengaja: wrapper `.hx-box` pegang animasi masuk, <img> di
 * dalamnya pegang idle. Jangan digabung — transform-nya saling timpa.
 */

export type { HonixPose };
export { honixSrc };

export type HonixMasuk = "in-fly" | "in-slide" | "in-rise" | "in-calm" | "in-pop" | "in-hero";
export type HonixIdle = "idle" | "idle-slow" | "idle-fly" | "none";

export function Honix({
  pose, size, sizeHp, idle = "idle", entry, dim = false, zzz = false,
  alt = "", className = "", preload = false,
}: {
  pose: HonixPose;
  /** Lebar = tinggi di desktop (px). */
  size: number;
  /** Ukuran di HP (<768px). Default sama dengan `size`. */
  sizeHp?: number;
  idle?: HonixIdle;
  entry?: HonixMasuk;
  /** Glow redup + lambat — buat pose tidur. */
  dim?: boolean;
  zzz?: boolean;
  /** "Honix" di popup; kosong kalau cuma dekorasi di samping teks. */
  alt?: string;
  className?: string;
  preload?: boolean;
}) {
  const { kurangiGerak } = useHonix();
  const style = { "--hx-s": `${size}px`, "--hx-s-hp": `${sizeHp ?? size}px` } as CSSProperties;
  const kelas = ["hx-box", entry && `hx-${entry}`, dim && "hx-dim", kurangiGerak && "hx-rm", className]
    .filter(Boolean).join(" ");
  return (
    <div className={kelas} style={style}>
      <Image
        src={honixSrc(pose)} alt={alt} fill sizes={`${size}px`} preload={preload}
        className={`hx-img${idle !== "none" ? ` hx-${idle}` : ""}`} draggable={false}
      />
      {zzz && <div className="hx-zzz" aria-hidden="true"><i>z</i><i>z</i><i>Z</i></div>}
    </div>
  );
}

const WARNA = ["#FF6A00", "#FFC24D", "#FF8C25", "#FFF2E6", "#DD4124"];
type Partikel = { x: number; y: number; c: string; d: number; dl: number; persegi: boolean };

function bikinPartikel(jenis: "confetti" | "burst" | "ember"): Partikel[] {
  const n = { confetti: 36, burst: 24, ember: 12 }[jenis];
  return Array.from({ length: n }, (_, i) => {
    let x: number, y: number;
    if (jenis === "ember") { x = (Math.random() - 0.5) * 140; y = -(70 + Math.random() * 130); }
    else { const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 120; x = Math.cos(a) * r; y = Math.sin(a) * r - 40; }
    return {
      x, y, c: WARNA[i % 5],
      d: (jenis === "ember" ? 1500 : 850) + Math.random() * 500,
      dl: (jenis === "ember" ? Math.random() * 1000 : Math.random() * 140) + 300,
      persegi: jenis === "confetti" && i % 2 === 1,
    };
  });
}

/** Partikel api (§3 Partikel). Ditaruh di dalam kontainer Honix yang `position: relative`. */
export function HonixPartikel({ jenis }: { jenis: "confetti" | "burst" | "ember" }) {
  const [daftar] = useState(() => bikinPartikel(jenis));
  const { kurangiGerak } = useHonix();
  if (kurangiGerak) return null;
  return (
    <div className="hx-sparks" aria-hidden="true">
      {daftar.map((p, i) => (
        <i key={i} className={`hx-sp${p.persegi ? " hx-sp-c" : ""}`} style={{
          "--x": `${p.x.toFixed(0)}px`, "--y": `${p.y.toFixed(0)}px`, "--c": p.c,
          "--d": `${p.d.toFixed(0)}ms`, "--dl": `${p.dl.toFixed(0)}ms`,
        } as CSSProperties} />
      ))}
    </div>
  );
}
