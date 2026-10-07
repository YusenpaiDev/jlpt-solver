"use client";

import { useEffect, useState } from "react";
import { Honix } from "./Honix";
import { useHonix } from "@/lib/use-honix";
import { putarHonix } from "@/lib/honix-sfx";
import { pilihPesanReaksi } from "@/lib/honix-pesan";

/**
 * Reaksi cepat (HANDOFF-honix §4). Honix kecil + balon kata, hilang sendiri
 * setelah 3 detik atau pas ditekan. role="status", gak ngambil fokus.
 *
 * Ditaruh di baris tombol kartu feedback (di samping "Lanjut →") — bar
 * bawah player hilang begitu soal dijawab, jadi di situ tempatnya.
 * Aturan kapan munculnya ada di useHonixReaksi().
 */
export function HonixReaction({ kind, beruntun, onSelesai }: {
  kind: "ok" | "no";
  /** Jumlah beruntun yang memicu — dipakai di judul "N benar beruntun!". */
  beruntun: number;
  onSelesai: () => void;
}) {
  const { kurangiGerak } = useHonix();
  const [[judul, baris]] = useState(() => pilihPesanReaksi(kind, beruntun));
  const [keluar, setKeluar] = useState(false);

  useEffect(() => {
    putarHonix("chirp");
    const t = setTimeout(() => setKeluar(true), 3300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!keluar) return;
    const t = setTimeout(onSelesai, 200);
    return () => clearTimeout(t);
  }, [keluar, onSelesai]);

  return (
    <div role="status"
      className={`hx hx-rx hx-rx-${kind}${keluar ? " hx-out" : ""}${kurangiGerak ? " hx-rm" : ""}`}>
      <button type="button" className="hx-rx-in" onClick={() => setKeluar(true)}
        aria-label={`${judul} ${baris} — tutup`}>
        <Honix pose={kind === "ok" ? "senang" : "bangkit"} size={64} sizeHp={52} />
        <span className="hx-rx-bub">
          <b>{judul}</b>{baris}
          <span className="hx-rx-time" aria-hidden="true"><i /></span>
        </span>
      </button>
    </div>
  );
}
