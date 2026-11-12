"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { tanggalLokal } from "@/lib/aktivitas";
import { muatBunpou } from "@/lib/dek-materi";
import { soalHarian, type PolaHarian, type SoalHarian } from "@/lib/kilat-harian";

const KUNCI = "honix:kilat-harian";
const HURUF = ["A", "B", "C", "D"];

/** Kartu "Latihan Kilat" Beranda: satu soal pola Bunpou per hari (ganti tiap
    hari), bisa langsung dijawab. Jawaban diingat sampai hari ganti. */
export function KilatHarian({ level }: { level: string }) {
  const [soal, setSoal] = useState<SoalHarian | null>(null);
  const [pilih, setPilih] = useState<number | null>(null);
  const [tgl] = useState(() => tanggalLokal());

  useEffect(() => {
    let batal = false;
    muatBunpou(level).then(d => {
      if (batal) return;
      setSoal(soalHarian(d.patterns as unknown as PolaHarian[], tgl, level));
      try {
        const v = JSON.parse(localStorage.getItem(KUNCI) ?? "{}");
        if (v.tgl === tgl && v.level === level && typeof v.pilih === "number") setPilih(v.pilih);
      } catch { /* mode privat */ }
    });
    return () => { batal = true; };
  }, [level, tgl]);

  const jawab = (i: number) => {
    if (pilih != null) return;
    setPilih(i);
    try { localStorage.setItem(KUNCI, JSON.stringify({ tgl, level, pilih: i })); } catch { /* mode privat */ }
  };

  const href = `/latihan/kilat?level=${level}&count=5`;
  if (!soal) return <div className="bv-quiz card" aria-busy="true" style={{ minHeight: 220 }} />;
  const sudah = pilih != null;
  const benar = pilih === soal.benar;
  return (
    <div className="bv-quiz card">
      <div className="q-head"><h3>⚡ Latihan Kilat</h3><span>Soal hari ini · <span lang="ja">文法</span></span></div>
      <div className="q-q" lang="ja">
        {soal.kalimat[0]}<span className={`blank${sudah ? " isi" : ""}`}>{sudah ? soal.opsi[soal.benar] : "＿＿"}</span>{soal.kalimat[1]}
      </div>
      <div className="q-opts" role="group" aria-label="Pilihan jawaban">
        {soal.opsi.map((o, i) => {
          const ok = sudah && i === soal.benar;
          const no = sudah && i === pilih && !benar;
          return (
            <button key={o} type="button" className={`q-opt${ok ? " ok" : ""}${no ? " no" : ""}`} onClick={() => jawab(i)} disabled={sudah && !ok && !no} aria-pressed={i === pilih}>
              <span className={`q-k${ok ? " ok-k" : ""}${no ? " no-k" : ""}`}>{HURUF[i]}</span><span lang="ja">{o}</span>
            </button>
          );
        })}
      </div>
      {sudah && (
        <div className="q-ex" role="status">
          <b>{benar ? "Benar!" : "Hampir."}</b> <span lang="ja">{soal.pola}</span> = {soal.arti}
          <small>{soal.terjemah}</small>
        </div>
      )}
      <div className="q-foot">
        <span>{sudah ? "Soal baru besok · lanjut 5 soal ±2 menit" : "Jawab langsung di sini · ganti tiap hari"}</span>
        <Link href={href} className="btn btn-p sm">▶ {sudah ? "Lanjut" : "5 soal"}</Link>
      </div>
    </div>
  );
}
