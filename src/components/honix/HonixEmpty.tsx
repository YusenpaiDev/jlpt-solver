"use client";

import { useState, type ReactNode } from "react";
import { Honix } from "./Honix";
import { useHonix } from "@/lib/use-honix";
import { pilihPesan } from "@/lib/honix-pesan";

export function HonixEmpty({ momen, title, body, cta }: {
  momen: "kosongRiwayat" | "kosongCatatan" | "kosongFavorit" | "kosongMateri";
  title?: string;
  body: string;
  cta?: ReactNode;
}) {
  const [pesan] = useState(() => pilihPesan(momen));
  const { kurangiGerak } = useHonix();
  return (
    <div className={`hx hx-empty${kurangiGerak ? " hx-rm" : ""}`}>
      <Honix pose="baca" size={150} sizeHp={120} entry="in-calm" idle="idle" alt="" />
      <h3 suppressHydrationWarning>{title ?? pesan}</h3>
      <p>{body}</p>
      {cta && <div className="hx-empty-cta">{cta}</div>}
    </div>
  );
}
