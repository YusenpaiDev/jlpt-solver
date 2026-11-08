"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/rencana-misi.css";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { langkahBerikut, urlLangkah } from "@/lib/misi-harian";
import { catatMisi, useMisiHarian } from "@/lib/use-misi-harian";

export type LangkahMisi = "1" | "2" | "3" | "penyelamat";
export const langkahMisi = (x: string | null): LangkahMisi | null =>
  x === "1" || x === "2" || x === "3" || x === "penyelamat" ? x : null;

/** Layar antara di player misi: langkah beres → lanjut / berhenti (handoff §3, layar 4c). */
export function PindahLangkah({ misi, level, benar, total, mulai }: {
  misi: LangkahMisi;
  level: string;
  benar: number;
  total: number;
  /** Date.now() waktu player dibuka. */
  mulai: number;
}) {
  const m = useMisiHarian(level);
  const [menit] = useState(() => Math.max(1, Math.round((Date.now() - mulai) / 60_000)));
  const tercatat = useRef(false);

  useEffect(() => {
    if (tercatat.current) return;
    tercatat.current = true;
    void catatMisi(misi === "penyelamat" ? { penyelamat: true } : { langkah: Number(misi) });
  }, [misi]);

  const n = misi === "penyelamat" ? 0 : Number(misi);
  const ini = m.rencana.find(l => l.n === n);
  const berikut = misi === "penyelamat" ? null : langkahBerikut(m.rencana, n);
  const hasil = `${benar} dari ${total} benar · ${menit} menit.`;

  let isi: React.ReactNode;
  if (misi === "penyelamat") {
    isi = (
      <>
        <div className="eyebrow">Misi penyelamat selesai</div>
        <h2>Streak nyala lagi</h2>
        <p>{hasil} Yang masih salah muncul lagi besok.</p>
        <div className="ml-a" style={{ marginTop: 22 }}>
          <Link className="btn btn-p btn-lg" href="/">Ke Beranda</Link>
        </div>
      </>
    );
  } else if (!berikut) {
    isi = (
      <>
        <div className="eyebrow">Langkah 3 dari 3 selesai</div>
        <h2>Misi selesai</h2>
        <p>{hasil} Cap hari ini udah nempel di kalender.</p>
        <div className="ml-a" style={{ marginTop: 22 }}>
          <Link className="btn btn-p btn-lg" href="/">Ke Beranda</Link>
        </div>
      </>
    );
  } else {
    isi = (
      <>
        <div className="eyebrow">Langkah {n} dari 3 selesai</div>
        <h2>{ini?.judul ?? "Langkah"} beres</h2>
        <p>{hasil} Yang masih salah muncul lagi besok.</p>
        <div className="ml-next"><span>Berikutnya</span><b>{berikut.judul}</b><small>{berikut.isi} · ±{berikut.menit} menit</small></div>
        <div className="ml-a">
          {m.siap
            ? <Link className="btn btn-p btn-lg" href={urlLangkah(berikut, m.salah)}>Lanjut</Link>
            : <span className="btn btn-p btn-lg" aria-disabled="true">Menyiapkan…</span>}
          <Link className="btn btn-q" href="/">Berhenti dulu</Link>
        </div>
        <p className="note" style={{ marginTop: 12 }}>Kalau berhenti, misi lanjut dari langkah {berikut.n} nanti.</p>
      </>
    );
  }

  return (
    <div className="rbk">
      <div className="ov">
        <div className="card ml" role="dialog" aria-modal="true" aria-label="Misi harian">
          <div className="ml-ok">✓</div>
          {isi}
        </div>
      </div>
    </div>
  );
}
