"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/rencana-banding.css";
import { useEffect, useRef, useState } from "react";
import { pisahContoh, salahDiGrup, soalBanding, type PolaBanding, type SoalBanding } from "@/lib/banding-pola";

type Progres = Map<string, { benar: number; salah: number }>;

/** Overlay "Bandingin pola" + drill pilih pola di atas halaman Bunpou (handoff §8). */
export function BandingPola({ grup, level, progres, onCatat, onTutup }: {
  grup: PolaBanding[];
  level: string;
  progres: Progres;
  onCatat: (pattern: string, benar: boolean) => void;
  onTutup: () => void;
}) {
  const [soal, setSoal] = useState<SoalBanding[]>(() => soalBanding(grup));
  const [mode, setMode] = useState<"banding" | "drill">("banding");
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [hist, setHist] = useState<boolean[]>([]);
  const lembar = useRef<HTMLDivElement>(null);
  const tutupRef = useRef(onTutup);
  useEffect(() => { tutupRef.current = onTutup; });

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") tutupRef.current(); };
    window.addEventListener("keydown", esc);
    const sebelum = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = sebelum; };
  }, []);
  useEffect(() => { lembar.current?.scrollTo({ top: 0 }); }, [mode]);

  const n = soal.length;
  const angka = grup.length === 2 ? "Dua" : "Tiga";
  const salah = salahDiGrup(grup, progres);
  const seringSalah = (p: PolaBanding) => { const g = progres.get(p.pattern); return Boolean(g && g.salah >= 2 && g.salah > g.benar); };

  const mulaiDrill = () => { setSoal(soalBanding(grup)); setI(0); setPick(null); setHist([]); setMode("drill"); };
  const jawab = (k: number) => {
    if (pick !== null) return;
    const s = soal[i];
    setPick(k);
    setHist(h => [...h, k === s.jawab]);
    onCatat(grup[s.jawab].pattern, k === s.jawab);
  };
  const lanjut = () => { setI(x => x + 1); setPick(null); };

  const isiBanding = (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Rawan ketuker · Bunpou {level}</div>
          <h1 className="h1">Bandingin pola<span className="jp-g" lang="ja">比較</span></h1>
          <p className="sub">{angka} pola ini sering ketuker.{salah > 0 && ` Kamu udah salah ${salah}× di antara ${grup.length === 2 ? "keduanya" : "ketiganya"}.`}</p>
        </div>
        {n > 0 && <button type="button" className="btn btn-p btn-lg" onClick={mulaiDrill}>Mulai drill · {n} soal</button>}
      </div>
      <div className="pcg">
        {grup.map((p, k) => {
          const ex = p.examples[0];
          const bagi = ex ? pisahContoh(ex.jp, ex.highlight) : null;
          return (
            <article className="card pc" key={p.id}>
              <div className="pc-top"><span className="pc-l">{"ABC"[k]}</span>{seringSalah(p) && <span className="chip sec" style={{ ["--c" as string]: "var(--danger)" }}>Sering salah</span>}</div>
              <div className="pc-p" lang="ja">{p.pattern}</div>
              <div className="pc-a">{p.meaning}</div>
              <div className="pc-d"><span>Pembeda</span>{p.discriminator}</div>
              {ex && (
                <div className="pc-ex">
                  <p lang="ja">{bagi ? <>{bagi[0]}<b>{bagi[1]}</b>{bagi[2]}</> : ex.jp}</p>
                  {ex.id && <small>{ex.id}</small>}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {grup.some(p => p.quickTip) && (
        <div className="card qt"><span>Cara cepat</span>{grup.filter(p => p.quickTip).map(p => <span key={p.id}>{p.quickTip}</span>)}</div>
      )}
    </>
  );

  const ok = hist.filter(Boolean).length;
  const s = soal[i];
  const isiDrill = i >= n ? (
    <div className="dr">
      <div className="card ml">
        <div className="ml-ok">{ok}</div>
        <div className="eyebrow">Drill selesai</div>
        <h2>{ok} dari {n} benar</h2>
        <p>{ok === n ? "Udah gak ketuker. Mantap." : "Pola yang masih salah udah kecatat buat diulang."}</p>
        <div className="ml-a" style={{ marginTop: 22 }}>
          <button type="button" className="btn btn-p btn-lg" onClick={mulaiDrill}>Ulang drill</button>
          <button type="button" className="btn btn-q" onClick={() => setMode("banding")}>Kembali ke perbandingan</button>
        </div>
      </div>
    </div>
  ) : (
    <div className="dr">
      <div className="dr-top"><span>Pilih pola yang tepat</span><span>Soal {i + 1} / {n}</span></div>
      <div className="dr-bar" style={{ gridTemplateColumns: `repeat(${n},1fr)` }} aria-hidden="true">
        {soal.map((_, k) => <i key={k} className={k < i ? (hist[k] ? "ok" : "no") : k === i ? "cur" : ""} />)}
      </div>
      <div className="card dr-q">
        <p className="dr-s" lang="ja">{s.sebelum}<u>{pick !== null ? s.isi : " "}</u>{s.sesudah}</p>
        <div className="dr-o">
          {grup.map((p, k) => (
            <button key={p.id} type="button" disabled={pick !== null} onClick={() => jawab(k)}
              className={`op${pick !== null && k === s.jawab ? " ok" : ""}${pick === k && k !== s.jawab ? " no" : ""}`}>
              <b lang="ja">{p.pattern}</b><small>{p.meaning}</small>
            </button>
          ))}
        </div>
        {pick !== null && (
          <>
            <div className={`fb ${pick === s.jawab ? "ok" : "no"}`} role="status">
              <b>{pick === s.jawab ? "Benar." : `Belum tepat. Jawabannya ${grup[s.jawab].pattern}.`}</b>{grup[s.jawab].discriminator}
            </div>
            <div className="dr-a"><button type="button" className="btn btn-p" onClick={lanjut} autoFocus>{i + 1 < n ? "Soal berikutnya" : "Lihat hasil"}</button></div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="rbk">
      <div className="ov big" onClick={e => { if (e.target === e.currentTarget) onTutup(); }}>
        <div className="card sheet big" ref={lembar} role="dialog" aria-modal="true" aria-label={mode === "banding" ? "Bandingin pola" : "Drill pola mirip"}>
          <button type="button" className="btn btn-g ov-x" onClick={onTutup}>✕ Tutup</button>
          {mode === "banding" ? isiBanding : isiDrill}
        </div>
      </div>
    </div>
  );
}
