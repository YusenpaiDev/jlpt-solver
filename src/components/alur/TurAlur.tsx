"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/alur.css";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { honixSrc } from "@/lib/honix-pose";
import { useHonix } from "@/lib/use-honix";
import { LANGKAH_ALUR, type LangkahAlur } from "@/lib/tur-alur";

const HP = "(max-width: 767px)";
const JARAK = 6;

/** Elemen `data-tur` yang kelihatan (rail disembunyiin di HP, bar bawah di desktop). */
function cari(nama: string): HTMLElement | null {
  return [...document.querySelectorAll<HTMLElement>(`[data-tur="${nama}"]`)].find(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  }) ?? null;
}

type Kotak = { top: number; left: number; width: number; height: number };
const ukur = (el: HTMLElement): Kotak => {
  const r = el.getBoundingClientRect();
  return { top: r.top - JARAK, left: r.left - JARAK, width: r.width + JARAK * 2, height: r.height + JARAK * 2 };
};

/* Desktop: kartu nempel di kanan target rail, di bawah target lain; tombol ?
   di pojok kanan → kartu rata kanan. HP: posisi diatur CSS (di atas bar bawah). */
function posisi(k: Kotak, bantuan: boolean): CSSProperties {
  const vw = window.innerWidth, vh = window.innerHeight, lebar = 400;
  if (k.left + k.width < 130) return { left: k.left + k.width + 20, top: Math.min(Math.max(16, k.top - 40), vh - 260) };
  const left = bantuan ? Math.max(16, k.left + k.width - lebar) : Math.min(Math.max(16, k.left), vw - lebar - 20);
  const bawah = k.top + k.height + 16;
  return bawah + 240 > vh ? { left, bottom: vh - k.top + 16 } : { left, top: bawah };
}

/** Tur Honix 7 langkah (HANDOFF-alur-belajar §5): sekeliling gelap, target diberi ring oranye. */
export function TurAlur({ onSelesai }: { onSelesai: () => void }) {
  const { kurangiGerak } = useHonix();
  const [langkah, setLangkah] = useState<LangkahAlur[] | null>(null);
  const [i, setI] = useState(0);
  const [kotak, setKotak] = useState<Kotak | null>(null);
  const [hp] = useState(() => window.matchMedia(HP).matches);
  const kartuRef = useRef<HTMLDivElement>(null);
  const utamaRef = useRef<HTMLButtonElement>(null);

  /* Disaring sekali setelah halaman nempel di DOM. */
  useEffect(() => {
    const id = requestAnimationFrame(() => setLangkah(LANGKAH_ALUR.filter(l => cari(l.target))));
    return () => cancelAnimationFrame(id);
  }, []);

  const n = langkah?.length ?? 0;
  const l = langkah?.[i];
  const akhir = i === n - 1;
  /* Gak ada target sama sekali (mis. bukan di Beranda) → tutup. */
  const selesaiRef = useRef(onSelesai);
  useEffect(() => { selesaiRef.current = onSelesai; }, [onSelesai]);
  useEffect(() => { if (langkah && !langkah.length) selesaiRef.current(); }, [langkah]);

  useLayoutEffect(() => {
    if (!l) return;
    const el = cari(l.target);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dalamNav = Boolean(el.closest(".nav-rail, .bottom-nav, .af-userbar"));
    if (!dalamNav && (r.top < 80 || r.bottom > window.innerHeight - (hp ? 300 : 260))) {
      el.scrollIntoView({ block: hp ? "start" : "center", behavior: kurangiGerak ? "auto" : "smooth" });
    }
    const set = () => setKotak(ukur(el));
    set();
    window.addEventListener("resize", set);
    window.addEventListener("scroll", set, true);
    return () => { window.removeEventListener("resize", set); window.removeEventListener("scroll", set, true); };
  }, [l, hp, kurangiGerak]);

  /* Kartu kenalan nahan diri selama tur jalan (cek kelas ini). */
  useEffect(() => {
    document.body.classList.add("hx-tur-on");
    return () => document.body.classList.remove("hx-tur-on");
  }, []);
  useEffect(() => { utamaRef.current?.focus({ preventScroll: true }); }, [i, langkah]);

  useEffect(() => {
    const tombol = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onSelesai(); }
      else if (e.key === "ArrowRight" && !akhir) { e.preventDefault(); setI(x => x + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); setI(x => Math.max(0, x - 1)); }
      else if (e.key === "Tab" && kartuRef.current) {
        const f = [...kartuRef.current.querySelectorAll<HTMLElement>("button")];
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1)?.focus(); }
        else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0]?.focus(); }
      }
    };
    document.addEventListener("keydown", tombol);
    return () => document.removeEventListener("keydown", tombol);
  });

  if (!langkah || !l) return null;
  return createPortal(
    <div className="rbk">
      {/* Penahan klik: halaman di belakang gak bisa dipencet selama tur. */}
      <div className="tur-blk" aria-hidden="true" />
      {kotak && <div className="tur-hl" style={kotak} aria-hidden="true" />}
      <div ref={kartuRef} key={i} className="tur-c" style={kotak && !hp ? posisi(kotak, l.target === "bantuan") : undefined}
        role="dialog" aria-modal="true" aria-label={`Tur Honix langkah ${i + 1} dari ${n}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- PNG transparan Honix */}
        <img className="hx" src={honixSrc(l.pose)} alt="Honix" />
        <div className="tur-b">
          <div className="tur-e">Tur Honix<span>{i + 1} / {n}</span></div>
          <b>{l.judul}</b>
          <p>{l.isi}</p>
          {l.tahap && <span className="tur-tg">{l.tahap}</span>}
          <div className="tur-d" aria-hidden="true">{langkah.map((_, j) => <i key={j} className={j <= i ? "on" : ""} />)}</div>
          <div className="tur-a">
            {i > 0 && <button type="button" className="btn btn-q" onClick={() => setI(i - 1)}>Balik</button>}
            <span className="sp" />
            <button type="button" className="btn btn-q" onClick={onSelesai}>Lewati tur</button>
            <button ref={utamaRef} type="button" className="btn btn-p" onClick={akhir ? onSelesai : () => setI(i + 1)}>{akhir ? "Mulai misi" : "Lanjut"}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
