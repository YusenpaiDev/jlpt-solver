"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/alur.css";
import { useEffect, useRef, useState } from "react";
import { useHonix } from "@/lib/use-honix";
import { honixSrc } from "@/lib/honix-pose";
import { bukaCaraBelajar } from "@/components/alur/CaraBelajar";
import {
  bolehKenalan, kunciKenalan, KUNCI_OB_SELESAI, KUNCI_PAKAI, TEKS_KENALAN, type IdKenalan,
} from "@/lib/kenalan";

/* Maks satu kartu kenalan per layar: yang duluan klaim yang tampil. */
let klaim: IdKenalan | null = null;

function bacaPakai(id: IdKenalan, tambah: boolean): number {
  try {
    const m = JSON.parse(localStorage.getItem(KUNCI_PAKAI) ?? "{}") as Record<string, number>;
    const n = Number(m[id]) || 0;
    if (tambah) { m[id] = n + 1; localStorage.setItem(KUNCI_PAKAI, JSON.stringify(m)); }
    return n;
  } catch { return 0; }
}

/** **tebal** → <b>. */
const tebal = (s: string) => s.split("**").map((x, i) => (i % 2 ? <b key={i}>{x}</b> : x));

/**
 * Kartu kenalan (HANDOFF-alur-belajar §4 C): inline di bawah elemen yang
 * dijelasin, panah ke atas, sekali per user. `live` = fiturnya udah nyala —
 * selama belum, kartunya gak pernah muncul.
 */
export function KartuKenalan({ id, live = true, bebas = false }: {
  id: IdKenalan;
  live?: boolean;
  /** latihan bebas: gak dihitung & gak muncul kalau dibuka dari misi/simulasi (`?dari=…`) */
  bebas?: boolean;
}) {
  const { setelan, siap, ubah } = useHonix();
  const [tampil, setTampil] = useState(false);
  const dihitung = useRef(false);
  const setelanRef = useRef(setelan);
  useEffect(() => { setelanRef.current = setelan; }, [setelan]);

  useEffect(() => {
    if (!siap || !live) return;
    if (bebas && new URLSearchParams(window.location.search).get("dari")) return;
    /* Satu kunjungan = sekali "dipakai" (StrictMode jalanin effect dua kali). */
    const pakai = bacaPakai(id, !dihitung.current);
    dihitung.current = true;
    let ob: number | null = null;
    try { ob = Number(localStorage.getItem(KUNCI_OB_SELESAI)) || null; } catch { /* mode privat */ }
    const boleh = bolehKenalan({
      live, pakai, obSelesai: ob, kini: Date.now(),
      dilihat: setelanRef.current.tur.halaman[kunciKenalan(id)],
      turJalan: document.body.classList.contains("hx-tur-on"),
    });
    if (!boleh || (klaim && klaim !== id)) return;
    klaim = id;
    const t = setTimeout(() => setTampil(true), 0);
    return () => { clearTimeout(t); if (klaim === id) klaim = null; };
  }, [siap, live, id, bebas]);

  if (!tampil) return null;
  const tutup = () => {
    setTampil(false);
    if (klaim === id) klaim = null;
    const tur = setelanRef.current.tur;
    ubah({ tur: { ...tur, halaman: { ...tur.halaman, [kunciKenalan(id)]: new Date().toISOString() } } });
  };
  const [eb, isi] = TEKS_KENALAN[id];
  return (
    <div className="rbk">
      <div className="kn" role="note" aria-label={eb}>
        <span className="kn-ar" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element -- PNG transparan Honix */}
        <img className="kn-hx" src={honixSrc("kepala")} alt="Honix" />
        <div>
          <div className="eyebrow">{eb}</div>
          <p>{tebal(isi)}</p>
          <div className="kn-a">
            <button type="button" className="btn btn-g" onClick={tutup}>Oke, ngerti</button>
            <button type="button" className="btn btn-q" onClick={() => { tutup(); bukaCaraBelajar(); }}>Cara belajar di Honix</button>
          </div>
        </div>
        <button type="button" className="kn-x" onClick={tutup} aria-label="Tutup">✕</button>
      </div>
    </div>
  );
}
