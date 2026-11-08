"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/rencana-strategi.css";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { honixSrc } from "@/lib/honix-pose";
import { NAMA_BAGIAN, TEKNIK, type JenisSoal } from "@/lib/strategi-ujian";

/** Kartu teknik sebelum latihan satu jenis soal (handoff §7). */
export function KartuTeknik({ jenis, disembunyikan, onAtur, onMulai, onLewati, linkStrategi = true }: {
  jenis: JenisSoal;
  disembunyikan: boolean;
  onAtur: (sembunyi: boolean) => void;
  onMulai: () => void;
  onLewati: () => void;
  /** Di halaman Strategi sendiri gak perlu link balik ke sana. */
  linkStrategi?: boolean;
}) {
  const t = TEKNIK.find(x => x.id === jenis) ?? TEKNIK[0];
  const mulai = useRef<HTMLButtonElement>(null);
  /* Centangan baru disimpan pas kartu ditutup, biar kartunya gak hilang di tengah baca. */
  const [sembunyi, setSembunyi] = useState(disembunyikan);
  const tutup = (lanjut: () => void) => { if (sembunyi !== disembunyikan) onAtur(sembunyi); lanjut(); };
  const tutupRef = useRef(() => tutup(onLewati));
  useEffect(() => { tutupRef.current = () => tutup(onLewati); });

  useEffect(() => {
    mulai.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") tutupRef.current(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  return (
    <div className="rbk">
      <div className="ov" onClick={e => { if (e.target === e.currentTarget) tutup(onLewati); }}>
        <div className="card sheet tk" role="dialog" aria-modal="true" aria-labelledby="tk-judul">
          {/* eslint-disable-next-line @next/next/no-img-element -- PNG transparan Honix, ukuran tetap */}
          <img className="hx tk-hx" src={honixSrc("tunjuk")} alt="Honix menunjuk" />
          <div>
            <span className="chip sec" style={{ ["--c" as string]: `var(--${t.sec})` }} lang="ja">{NAMA_BAGIAN[t.sec]} · {t.t}</span>
            <h2 className="tk-t" id="tk-judul">Sebelum mulai: {t.i.toLowerCase()}</h2>
            <ol className="tk-l">{t.tips.map(x => <li key={x}><span>{x}</span></li>)}</ol>
            <label className="ck">
              <input type="checkbox" checked={sembunyi} onChange={e => setSembunyi(e.target.checked)} />
              <span>Jangan tampilkan lagi buat <span lang="ja">{t.t}</span></span>
            </label>
            <div className="tk-a">
              <button ref={mulai} type="button" className="btn btn-p" onClick={() => tutup(onMulai)}>Mulai latihan</button>
              <button type="button" className="btn btn-q" onClick={() => tutup(onLewati)}>Lewati</button>
            </div>
            {linkStrategi && <p className="tk-f">Bisa dibuka lagi di <Link href="/strategi">Strategi ujian</Link>.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
