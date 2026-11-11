"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/rencana-banding.css";
import "@/styles/kurikulum.css";

import { useEffect, useRef, useState } from "react";
import type { Soal } from "@/lib/soal-kurikulum";
import { LaporSoal } from "@/components/kurikulum/LaporSoal";

export interface Jawaban { soal: Soal; pilih: number | null; benar: boolean }

/** Player tes penempatan / ulangan: gaya Latihan Kilat, tanpa umpan balik
    benar-salah, waktu cuma dicatat (HANDOFF-kurikulum §5–6, §10). */
export function Kuis({ soal, segmen, label, belumTahu = false, detikPerSoal, onKeluar, onSelesai }: {
  soal: Soal[];
  /** pembagian bar progres, urut sesuai soal */
  segmen: { k: string; n: number }[];
  label: string;
  belumTahu?: boolean;
  detikPerSoal: number;
  onKeluar: () => void;
  onSelesai: (j: Jawaban[]) => void;
}) {
  const [i, setI] = useState(0);
  const [lapor, setLapor] = useState(false);
  const jawab = useRef<Jawaban[]>([]);
  const q = soal[i];

  const pilih = (n: number | null) => {
    if (!q) return;
    jawab.current = [...jawab.current.slice(0, i), { soal: q, pilih: n, benar: n === q.benar }];
    if (i + 1 >= soal.length) onSelesai(jawab.current);
    else setI(i + 1);
  };

  /* 1–4 buat milih, 0 = belum tahu. */
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (lapor || e.metaKey || e.ctrlKey || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      const n = Number(e.key);
      if (n >= 1 && n <= (q?.opsi.length ?? 0)) pilih(n - 1);
      else if (e.key === "0" && belumTahu) pilih(null);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  if (!q) return null;
  const awal = segmen.map((_, j) => segmen.slice(0, j).reduce((t, x) => t + x.n, 0));
  const sisaMenit = Math.max(1, Math.round(((soal.length - i) * detikPerSoal) / 60));
  return (
    <div className="kuis">
      <div className="pl-top">
        <button type="button" className="btn btn-q" onClick={onKeluar}>✕ Keluar</button>
        <div className="psec" aria-label={`Soal ${i + 1} dari ${soal.length}`}>
          {segmen.map((s, j) => {
            const isi = Math.max(0, Math.min(s.n, i - awal[j]));
            const aktif = i >= awal[j] && i < awal[j] + s.n;
            return <div key={s.k} className={aktif ? "on" : ""} style={{ flex: s.n }}><i><b style={{ width: `${(isi / s.n) * 100}%` }} /></i><span lang="ja">{s.k}</span></div>;
          })}
        </div>
        <span className="pl-m">{i + 1} / {soal.length}</span>
      </div>
      <div className="dr" style={{ marginTop: 0 }}>
        <div className="dr-top">
          <span className="chip sec" lang="ja">{q.grup}{q.jenis ? ` · ${q.jenis}` : ""}</span>
          <span>{label}</span>
        </div>
        <div className="card dr-q" key={q.id}>
          {q.bacaan && <div className="pq-p" lang="ja">{q.bacaan}</div>}
          <p className="pq-q" lang="ja">{q.tanya}</p>
          <div className="pq-o">
            {q.opsi.map((o, n) => <button key={n} type="button" className="op" onClick={() => pilih(n)}><b lang="ja">{o}</b></button>)}
          </div>
          <div className="pq-f">
            {belumTahu ? <button type="button" className="btn btn-g" onClick={() => pilih(null)}>Belum tahu</button> : <span />}
            {/* Soal dari katalog Bank Soal gak dilaporin di sini. */}
            {!q.id.startsWith("dokkai:") && <button type="button" className="btn btn-q pl-rep" onClick={() => setLapor(true)}>⚑ Laporkan soal</button>}
          </div>
        </div>
        <p className="note" style={{ textAlign: "center", marginTop: 14 }}>Waktu cuma dicatat · sisa ±{sisaMenit} menit</p>
      </div>
      {lapor && <LaporSoal soalId={q.id} info={`${q.grup}${q.jenis ? ` · ${q.jenis}` : ""}`} onTutup={() => setLapor(false)} />}
    </div>
  );
}
