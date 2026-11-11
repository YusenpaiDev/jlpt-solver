"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/rencana-janji.css";
import { LABEL, PACE, paceBerikut, penilaianJanji } from "@/lib/janji-belajar";
import type { SesiUjian } from "@/lib/sesi-ujian";

/** Kekejar / mepet / belum + perbaikan + atur sesi & pace (handoff Rencana Belajar §5).
 *  `ujian`: YYYY-MM-DD, "none", atau "" (belum milih). Nempel di onboarding & Pengaturan. */
export function JanjiBelajar({ level, ujian, pace, sesi, onUbah, sisa = 1 }: {
  level: string;
  ujian: string;
  pace: number;
  sesi: SesiUjian[];
  onUbah: (ujian: string, pace: number) => void;
  /** bagian materi yang belum dikuasai (hasil tes penempatan) */
  sisa?: number;
}) {
  const hariKe = (iso: string) => sesi.find(s => s.iso === iso)?.hari ?? null;
  const nilai = (iso: string, m: number) => penilaianJanji(level, hariKe(iso), m, sisa);
  const v = nilai(ujian, pace);

  const perbaikan = [];
  if (v && v.v !== "ok") {
    const p = paceBerikut(pace);
    if (p) {
      const nv = nilai(ujian, p.m)!;
      perbaikan.push(
        <button key="pace" type="button" className="card fx" onClick={() => onUbah(ujian, p.m)}>
          <b>Naikin ke {p.e} {p.t} · {p.m} menit</b><span className={`vt v-${nv.v}`}>Jadi: {LABEL[nv.v][0]}</span>
        </button>,
      );
    }
    const i = sesi.findIndex(s => s.iso === ujian);
    const lanjut = i >= 0 ? sesi[i + 1] : undefined;
    if (lanjut) {
      const nv = nilai(lanjut.iso, pace)!;
      perbaikan.push(
        <button key="sesi" type="button" className="card fx" onClick={() => onUbah(lanjut.iso, pace)}>
          <b>Pindah ke {lanjut.label}</b><span className={`vt v-${nv.v}`}>Jadi: {LABEL[nv.v][0]}</span>
        </button>,
      );
    }
  }

  const maks = v ? Math.max(v.butuh, v.punya, 1) : 1;
  return (
    <div className="rbk rbk-janji">
      {v ? (
        <div className={`card jn-v v-${v.v}`} role="status">
          <div className="jn-vl"><i />{LABEL[v.v][0]}</div>
          <p>{LABEL[v.v][1]} Butuh <b>±{v.butuh} jam</b>, waktu yang kamu punya sampai ujian <b>±{v.punya} jam</b>.</p>
          <div className="jb"><span>Butuh</span><div className="jb-t"><i style={{ width: `${(v.butuh / maks) * 100}%`, background: "var(--surface-3)", boxShadow: "inset 0 0 0 1px var(--line-2)" }} /></div><b>{v.butuh} jam</b></div>
          <div className="jb"><span>Kamu punya</span><div className="jb-t"><i style={{ width: `${(v.punya / maks) * 100}%`, background: "var(--vc)" }} /></div><b>{v.punya} jam</b></div>
        </div>
      ) : (
        <div className="card jn-v v-none" role="status">
          <div className="jn-vl"><i />Belum bisa dihitung</div>
          <p>Belum ada tanggal ujian. Misi harian tetap jalan. Pilih sesi kapan aja biar Honix bisa hitung.</p>
        </div>
      )}
      {perbaikan.length > 0 && <div className="jn-fix">{perbaikan}</div>}
      <div className="jn-adj">
        <div>
          <label>Sesi ujian</label>
          {sesi.map(s => <button key={s.iso} type="button" className={`chip${s.iso === ujian ? " sel" : ""}`} aria-pressed={s.iso === ujian} onClick={() => onUbah(s.iso, pace)}>{s.label}</button>)}
          <button type="button" className={`chip${ujian === "none" ? " sel" : ""}`} aria-pressed={ujian === "none"} onClick={() => onUbah("none", pace)}>Belum tau</button>
        </div>
        <div>
          <label>Pace</label>
          {PACE.map(p => <button key={p.m} type="button" className={`chip${p.m === pace ? " sel" : ""}`} aria-pressed={p.m === pace} onClick={() => onUbah(ujian, p.m)}>{p.e} {p.t} · {p.m} mnt</button>)}
        </div>
      </div>
    </div>
  );
}
