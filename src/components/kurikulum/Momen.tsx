"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/kurikulum.css";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { honixSrc } from "@/lib/honix-pose";
import { ATURAN } from "@/lib/kurikulum-config";

export type IsiMomen =
  | { jenis: "naik" | "turun"; jenisSoal: string; tingkat: number; akurasi: number }
  /** judul = "Minggu 11" / "Unit 5–6"; berikut = unit yang kebuka (null = jadwal materi habis) */
  | { jenis: "unit"; judul: string; kata: number; pola: number; berikut: string | null };

const NAMA_TINGKAT = ["", "pengenalan", "standar JLPT", "jebakan"];

function isiKartu(isi: IsiMomen) {
  if (isi.jenis === "unit") {
    return { hx: "senang" as const, eb: "Unit selesai", t: `${isi.judul} beres!`, p: `${isi.kata} kata dan ${isi.pola} pola udah masuk pengulangan.${isi.berikut ? ` ${isi.berikut} kebuka. Senin ada ulangan ±10 menit.` : ""}`, ok: "Lanjut", lain: ["Lihat peta", "/kurikulum"] };
  }
  const a = Math.round(isi.akurasi * 100);
  const lain = ["Lihat keterampilan", "/kurikulum/keterampilan"];
  if (isi.jenis === "naik") {
    return { hx: "lulus" as const, eb: "Naik tingkat", t: `${isi.jenisSoal} naik ke T${isi.tingkat}`, p: `${a}% benar dari ${ATURAN.tingkat.jendela} jawaban terakhir. Mulai besok, soal ${isi.jenisSoal} di misimu pakai tingkat ${NAMA_TINGKAT[isi.tingkat]}.`, ok: "Mantap", lain };
  }
  return { hx: null, eb: "Tingkat disesuaikan", t: `${isi.jenisSoal} balik ke T${isi.tingkat} dulu`, p: `${a}% dari ${ATURAN.tingkat.jendela} jawaban terakhir. Fondasinya dikuatin dulu, nanti naik lagi sendiri kalau udah ${Math.round(ATURAN.tingkat.naik * 100)}%.`, ok: "Oke", lain };
}

/** Momen kecil kurikulum (HANDOFF-kurikulum §8): pojok kanan bawah / di atas bar
    bawah di HP. Maks satu per sesi; nutup sendiri, kecuali reduced-motion. */
export function MomenKurikulum({ isi, onTutup }: { isi: IsiMomen; onTutup: () => void }) {
  /* Timer jalan sekali sejak muncul, walau parent render ulang. */
  const tutup = useRef(onTutup);
  useEffect(() => { tutup.current = onTutup; }, [onTutup]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => tutup.current(), ATURAN.momenDetik * 1000);
    return () => clearTimeout(t);
  }, []);

  const m = isiKartu(isi);
  return createPortal(
    <div className="rbk">
      <div className={`kmo${m.hx ? "" : " quiet"}`} role="status">
        {/* eslint-disable-next-line @next/next/no-img-element -- PNG transparan Honix */}
        {m.hx && <img className="hx kmo-hx" src={honixSrc(m.hx)} alt="Honix" />}
        <div>
          <div className="eyebrow">{m.eb}</div>
          <b className="kmo-t" lang="ja">{m.t}</b>
          <p>{m.p}</p>
          <div className="kmo-a">
            <button type="button" className="btn btn-p" onClick={onTutup}>{m.ok}</button>
            <Link className="btn btn-q" href={m.lain[1]} onClick={onTutup}>{m.lain[0]}</Link>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
