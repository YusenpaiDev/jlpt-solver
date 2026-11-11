"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/rencana-misi.css";
import "@/styles/kurikulum.css";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { kirimLaporan, type AlasanLapor } from "@/lib/kurikulum-db";
import { DEV_BYPASS } from "@/lib/dev-materi";

const ALASAN: [AlasanLapor, string][] = [
  ["kunci_salah", "Kunci jawabannya salah"], ["dua_benar", "Ada dua jawaban benar"],
  ["bahasa_aneh", "Bahasanya aneh"], ["lainnya", "Lainnya"],
];

/** Sheet "Laporkan soal ini" (HANDOFF-kurikulum §13). Cuma buat soal buatan kami. */
export function LaporSoal({ soalId, info, onTutup }: { soalId: string; info: string; onTutup: () => void }) {
  const [alasan, setAlasan] = useState<AlasanLapor | null>(null);
  const [catatan, setCatatan] = useState("");
  const [fase, setFase] = useState<"isi" | "kirim" | "terkirim">("isi");
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onTutup(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onTutup]);

  const kirim = async () => {
    if (!alasan) return;
    setFase("kirim"); setGalat(null);
    try {
      if (!DEV_BYPASS) await kirimLaporan(soalId, alasan, catatan);
      setFase("terkirim");
    } catch {
      setFase("isi"); setGalat("Laporan belum kekirim. Coba lagi sebentar.");
    }
  };

  return createPortal(
    <div className="rbk">
      <div className="ov" onClick={e => { if (e.target === e.currentTarget) onTutup(); }}>
        {fase === "terkirim" ? (
          <div className="card sheet lp" role="dialog" aria-modal="true" aria-label="Laporan terkirim">
            <div className="ml-ok">✓</div>
            <h2>Makasih, kami cek.</h2>
            <p>Laporanmu udah masuk. Kalau soalnya memang salah, kami perbaiki dan jawabanmu di soal ini gak dihitung salah.</p>
            <div className="sh-a"><button type="button" className="btn btn-p" onClick={onTutup}>Lanjut latihan</button></div>
          </div>
        ) : (
          <div className="card sheet lp" role="dialog" aria-modal="true" aria-label="Laporkan soal">
            <h2>Laporkan soal ini</h2>
            <p>Soal #{soalId} · <span lang="ja">{info}</span></p>
            <div className="opts">
              {ALASAN.map(([k, t]) => (
                <button key={k} type="button" className={`chip${alasan === k ? " sel" : ""}`} aria-pressed={alasan === k} onClick={() => setAlasan(k)}>{t}</button>
              ))}
            </div>
            <textarea className="ta" rows={3} maxLength={1000} placeholder="Ceritain sedikit (opsional)" aria-label="Detail laporan" value={catatan} onChange={e => setCatatan(e.target.value)} />
            {galat && <p className="bad-t" role="alert" style={{ fontSize: 13 }}>{galat}</p>}
            <div className="sh-a">
              <button type="button" className="btn btn-p" disabled={!alasan || fase === "kirim"} onClick={kirim}>{fase === "kirim" ? "Mengirim…" : "Kirim laporan"}</button>
              <button type="button" className="btn btn-q" onClick={onTutup}>Batal</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
