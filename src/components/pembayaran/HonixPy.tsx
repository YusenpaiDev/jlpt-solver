"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { honixSrc, type HonixPose } from "@/lib/honix-pose";
import { useHonix } from "@/lib/use-honix";

/**
 * Hōnix di layar pembayaran (HANDOFF-pembayaran "Maskot Hōnix"). Sengaja
 * polos — cuma <img> + drop-shadow + melayang 3.6 detik, tanpa glow/animasi
 * masuk ala <Honix>. Layar uang harus tenang.
 *
 * Gak dipakai di status langganan, Lifetime, berhenti, riwayat transaksi.
 */
export function HonixPy({ pose, hp, desktop, diam = false, className = "", style }: {
  pose: HonixPose;
  /** Ukuran di HP (px). */
  hp: number;
  /** Ukuran di desktop ≥900px (px). */
  desktop: number;
  /** Tanpa animasi melayang — dipakai di jatah habis. */
  diam?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const { kurangiGerak } = useHonix();
  return (
    <Image src={honixSrc(pose)} alt="" width={desktop} height={desktop}
      className={`py-hx${diam || kurangiGerak ? " diam" : ""}${kurangiGerak ? " hx-rm" : ""}${className ? ` ${className}` : ""}`}
      style={{ "--py-hx-m": `${hp}px`, "--py-hx-d": `${desktop}px`, ...style } as CSSProperties} />
  );
}
