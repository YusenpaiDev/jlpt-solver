"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/alur.css";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { LabelDisiapkan } from "@/components/rencana/LabelDisiapkan";
import { fiturLive } from "@/lib/kurikulum-config";
import { PACE_MISI, tingkatPace } from "@/lib/misi-harian";
import { createClient } from "@/lib/supabase/client";

/* Pemicu dari mana aja (tombol ? di topbar, Pengaturan, kartu kenalan). */
const pendengar = new Set<() => void>();
export const bukaCaraBelajar = () => pendengar.forEach(f => f());

/* [judul, guna, fitur, flag yang harus live] */
const T5: [string, string, string, Parameters<typeof fiturLive>[0] | null][] = [
  ["Belajar", "Kenalan kata & pola baru", "Materi · Kotoba, Bunpou", null],
  ["Ngapalin", "Biar gak lupa", "Ulang di misi · Latihan Kilat · flashcard Kamus", null],
  ["Latihan soal", "Pakai yang udah dihafal", "Latihan adaptif T1–T3 · Latihan › Lembar Tugas", null],
  ["Cek mingguan", "Seminggu ini nempel gak", "Ulangan Senin ±10 menit", "ulangan"],
  ["Uji format JLPT", "Kayak ujian beneran", "Simulasi bulanan · Latihan › Set format JLPT", "simulasi"],
];

const Prep = ({ f }: { f: Parameters<typeof fiturLive>[0] }) => (fiturLive(f) ? null : <LabelDisiapkan />);

/** Sheet "Cara belajar di Honix" (HANDOFF-alur-belajar §4 C9). Dipasang sekali di NavRail. */
export function CaraBelajarHost() {
  const [buka, setBuka] = useState(false);
  useEffect(() => { const f = () => setBuka(true); pendengar.add(f); return () => { pendengar.delete(f); }; }, []);
  if (!buka) return null;
  return <CaraBelajar onTutup={() => setBuka(false)} />;
}

function CaraBelajar({ onTutup }: { onTutup: () => void }) {
  const [pace, setPace] = useState(20);
  const menit = PACE_MISI[tingkatPace(pace)].m;
  /* Pace dari metadata sesi lokal (gak nembak server). */
  useEffect(() => {
    let batal = false;
    createClient().auth.getSession().then(({ data }) => {
      const m = Number(data.session?.user.user_metadata?.daily_goal_minutes);
      if (!batal && m > 0) setPace(m);
    });
    return () => { batal = true; };
  }, []);
  const tutupRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const semula = document.activeElement as HTMLElement | null;
    tutupRef.current?.focus({ preventScroll: true });
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onTutup(); };
    window.addEventListener("keydown", esc);
    const ov = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.documentElement.style.overflow = ov;
      if (semula?.isConnected) semula.focus({ preventScroll: true });
    };
  }, [onTutup]);

  return createPortal(
    <div className="rbk">
      <div className="ov ov-cara" onClick={e => { if (e.target === e.currentTarget) onTutup(); }}>
        <div className="card sheet cara" role="dialog" aria-modal="true" aria-labelledby="cara-judul">
          <div className="cara-h">
            <div>
              <div className="eyebrow">Cara belajar di Honix</div>
              <h2 id="cara-judul">5 tahap dari belajar sampai ujian</h2>
              <p>Kamu gak perlu ngatur sendiri. Misi harian udah nyampurin tahapnya.</p>
            </div>
            <button ref={tutupRef} type="button" className="btn btn-g" onClick={onTutup}>✕ Tutup</button>
          </div>
          <div className="t5">
            {T5.map(([t, g, f, flag], i) => (
              <div className="t5-i" key={t}>
                <span className="t5-n">{i + 1}</span><b>{t}</b><p>{g}</p>
                <small>{f}{flag && <Prep f={flag} />}</small>
              </div>
            ))}
          </div>
          <div className="ritme">
            <b>Kurikulum yang ngatur urutannya</b>
            <p>Bukan tahap ke-6. Ini jadwal yang jalanin 5 tahap di atas sampai hari ujian.</p>
            <div className="rt">
              <div><span>Tiap hari</span><b>Misi ±{menit} menit</b> · tahap 1–3</div>
              <div><span>Tiap Senin</span><b>Ulangan ±10 menit</b> · tahap 4<Prep f="ulangan" /></div>
              <div><span>Terus jalan</span><b>Perkiraan skor</b> dari 30 hari<Prep f="perkiraan" /></div>
              <div><span>Tiap bulan</span><b>Simulasi</b> · tahap 5<Prep f="simulasi" /></div>
            </div>
          </div>
          <div className="perp">
            <span>Mau jalan sendiri? Gak wajib:</span>
            <Link className="chip" href="/materi" onClick={onTutup}>Materi</Link>
            <Link className="chip" href="/latihan/set" onClick={onTutup}>Latihan · Set format JLPT, Lembar Tugas</Link>
            <Link className="chip" href="/kamus" onClick={onTutup}>Kamus · Kamus, Catatan</Link>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
