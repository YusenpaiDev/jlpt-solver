"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Honix, HonixPartikel, type HonixMasuk, type HonixPose } from "./Honix";
import { useHonix } from "@/lib/use-honix";
import { putarHonix, type HonixCue } from "@/lib/honix-sfx";
import { pilihPesan } from "@/lib/honix-pesan";

/**
 * Popup selesai satu set latihan (HANDOFF-honix §4 "Popup selesai latihan").
 * Modal di desktop, lembar bawah di HP — bedanya murni dari CSS.
 */

type Varian = "perfect" | "hi" | "mid" | "lo";

const VARIAN: Record<Varian, { pose: HonixPose; masuk: HonixMasuk; fx: "confetti" | "burst" | "ember" | null; cue: HonixCue }> = {
  perfect: { pose: "lulus", masuk: "in-fly", fx: "confetti", cue: "fanfare" },
  hi: { pose: "senang", masuk: "in-fly", fx: "burst", cue: "chime" },
  mid: { pose: "tunjuk", masuk: "in-slide", fx: null, cue: "ting" },
  lo: { pose: "bangkit", masuk: "in-rise", fx: "ember", cue: "soft" },
};

function varianDari(skor: number, total: number, lulus: boolean): Varian {
  if (lulus || (total > 0 && skor >= total)) return "perfect";
  const pct = total > 0 ? skor / total : 0;
  return pct >= 0.8 ? "hi" : pct >= 0.5 ? "mid" : "lo";
}

const SPK_ON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);
const SPK_OFF = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="m17 9 5 6" /><path d="m22 9-5 6" />
  </svg>
);

export function HonixFinishDialog({
  skor, total, kategori, xp, streak, ekstra, lulus = false,
  onCobaLagi, onLanjut, onPembahasan, onTutup,
}: {
  skor: number;
  total: number;
  /** Label kategori, mis. "文法" / "語彙". Kosong = gak ditampilin. */
  kategori?: string;
  xp: number;
  streak: number;
  /** Kotak statistik ketiga, mis. { nilai: 2, label: "pola perlu diulang" }. */
  ekstra?: { nilai: number | string; label: string };
  /** Bank Soal 過去問: lulus passing score → varian Sempurna walau < 100%. */
  lulus?: boolean;
  /** Tombol utama skor rendah (< 50%). */
  onCobaLagi: () => void;
  /** Tombol utama varian lain. */
  onLanjut: () => void;
  onPembahasan: () => void;
  /** Esc / klik latar. */
  onTutup: () => void;
}) {
  const v = varianDari(skor, total, lulus);
  const cfg = VARIAN[v];
  const { setelan, ubah, kurangiGerak } = useHonix();
  const [pesan] = useState(() => pilihPesan(v, { total }));
  const [angka, setAngka] = useState(() => (kurangiGerak ? skor : 0));
  const [keluar, setKeluar] = useState(false);
  const utamaRef = useRef<HTMLButtonElement>(null);
  const pemicuRef = useRef<Element | null>(null);

  /* Fokus pindah ke tombol utama; balik ke pemicu pas ditutup (§7). */
  useEffect(() => {
    pemicuRef.current = document.activeElement;
    utamaRef.current?.focus();
    return () => { (pemicuRef.current as HTMLElement | null)?.focus?.(); };
  }, []);

  /* chirp pas muncul → angka naik 900ms (mulai 450ms) → bunyi varian. */
  useEffect(() => {
    putarHonix("chirp");
    if (kurangiGerak) {
      const t = setTimeout(() => putarHonix(cfg.cue), 450);
      return () => clearTimeout(t);
    }
    let raf = 0;
    const t0 = performance.now() + 450, dur = 900;
    const langkah = (t: number) => {
      const p = Math.max(0, Math.min(1, (t - t0) / dur));
      setAngka(Math.round(skor * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(langkah);
      else putarHonix(cfg.cue);
    };
    raf = requestAnimationFrame(langkah);
    return () => cancelAnimationFrame(raf);
    // sekali per popup — skor/varian gak berubah selama terbuka
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Tutup pakai fade 200ms dulu, baru panggil callback. */
  const tutupLalu = (f: () => void) => {
    if (keluar) return;
    setKeluar(true);
    setTimeout(f, 200);
  };

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") tutupLalu(onTutup); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  });

  const toggleSuara = () => {
    const nyala = !setelan.suara;
    ubah({ suara: nyala });
    if (nyala) putarHonix("chirp");
  };

  if (typeof document === "undefined") return null;
  const pct = total > 0 ? Math.round((skor / total) * 100) : 0;

  return createPortal(
    <div className={`hx hx-ov${keluar ? " hx-out" : ""}${kurangiGerak ? " hx-rm" : ""}`}
      onClick={() => tutupLalu(onTutup)}>
      <div className={`hx-dlg hx-v-${v}`} role="dialog" aria-modal="true" aria-labelledby="hx-dlg-judul"
        onClick={e => e.stopPropagation()}>
        <button type="button" className="hx-snd" onClick={toggleSuara}
          aria-label={setelan.suara ? "Matikan suara Honix" : "Nyalakan suara Honix"} aria-pressed={setelan.suara}>
          {setelan.suara ? SPK_ON : SPK_OFF}
        </button>
        <div className="hx-dlg-hx">
          <div className="hx-dlg-glow" />
          <Honix pose={cfg.pose} size={170} sizeHp={140} entry={cfg.masuk} alt="Honix" preload />
          {cfg.fx && <HonixPartikel jenis={cfg.fx} />}
        </div>
        <div className="hx-dlg-eye" id="hx-dlg-judul">
          Latihan selesai{kategori ? <> · <span className="hx-jp">{kategori}</span></> : null}
        </div>
        <div className="hx-dlg-score" aria-label={`Skor ${skor} dari ${total}`}>
          <span className="hx-sc-n" aria-hidden="true">{angka}</span>
          <span className="hx-sc-of" aria-hidden="true">/ {total}</span>
        </div>
        <div className="hx-dlg-pct">{pct}% benar</div>
        <p className="hx-dlg-msg">{pesan}</p>
        <div className="hx-dlg-stats">
          <div><b>+{xp}</b><span>XP</span></div>
          <div><b>{streak}</b><span>hari streak</span></div>
          {ekstra && <div><b>{ekstra.nilai}</b><span>{ekstra.label}</span></div>}
        </div>
        <div className="hx-dlg-act">
          <button ref={utamaRef} type="button" className="hx-btn hx-btn-p" onClick={() => tutupLalu(v === "lo" ? onCobaLagi : onLanjut)}>
            {v === "lo" ? "Coba lagi" : "Lanjut latihan"}
          </button>
          <button type="button" className="hx-btn hx-btn-g" onClick={() => tutupLalu(onPembahasan)}>
            Lihat pembahasan
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
