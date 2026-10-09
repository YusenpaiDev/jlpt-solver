"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Honix } from "./Honix";
import { useHonix } from "@/lib/use-honix";
import type { LangkahTur } from "@/lib/honix-tur";

const HP = "(max-width: 767px)";
const JARAK = 6;   // lubang sorot lebih lebar dari ikonnya
const CELAH = 14;  // jarak balon ke lubang
const TEPI = 12;   // balon gak boleh mepet tepi layar

/** Elemen `data-tur` yang kelihatan — nav rail `display:none` di HP, bottom
    nav di desktop, lembar panel Bank Soal yang ketutup (`visibility:hidden`). */
function cariTarget(nama: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`[data-tur="${nama}"]`)].filter(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    return el.checkVisibility ? el.checkVisibility({ visibilityProperty: true }) : getComputedStyle(el).visibility !== "hidden";
  });
}

type Kotak = { top: number; left: number; width: number; height: number };

/** Satu sorotan bisa nyakup beberapa elemen (mis. SOAL + OPSI). */
function gabung(els: HTMLElement[]): Kotak | null {
  if (!els.length) return null;
  const rs = els.map(el => el.getBoundingClientRect());
  const top = Math.min(...rs.map(r => r.top)), left = Math.min(...rs.map(r => r.left));
  const bawah = Math.max(...rs.map(r => r.bottom)), kanan = Math.max(...rs.map(r => r.right));
  return { top: top - JARAK, left: left - JARAK, width: kanan - left + JARAK * 2, height: bawah - top + JARAK * 2 };
}

/* Balon di kanan target (nav rail kiri), di atas (bottom nav / target di
   bawah layar), atau di bawahnya. */
function posisiBalon(t: Kotak, hp: boolean): CSSProperties {
  const vw = window.innerWidth, vh = window.innerHeight;
  const lebar = Math.min(400, vw - TEPI * 2);
  const tengahX = t.left + t.width / 2;
  const left = Math.min(Math.max(tengahX - lebar / 2, TEPI), vw - lebar - TEPI);
  if (!hp && t.left + t.width < vw / 3) {
    return { width: lebar, left: t.left + t.width + CELAH, top: Math.min(Math.max(t.top + t.height / 2 - 85, TEPI), vh - 200) };
  }
  if (hp || t.top > vh * 0.6) return { width: lebar, left, bottom: vh - t.top + CELAH };
  return { width: lebar, left, top: t.top + t.height + CELAH };
}

/**
 * Tur sorot (spec 2026-10-09-honix-tur-design). Layar digelapin, satu bagian
 * terang, Honix jelasin lewat balon. Dipakai tur menu (HonixTurHost) dan tur
 * per halaman (HonixTurHalaman). Langkah yang targetnya gak kelihatan dilewati.
 */
export function HonixTur({ daftar, onSelesai, aksiAkhir }: {
  daftar: { desktop: LangkahTur[]; hp?: LangkahTur[] };
  onSelesai: () => void;
  /** Tombol utama di langkah terakhir; tanpa ini cuma "Selesai". */
  aksiAkhir?: { label: string; onClick: () => void };
}) {
  const { kurangiGerak } = useHonix();
  const idJudul = useId(), idIsi = useId();
  const [hp] = useState(() => window.matchMedia(HP).matches);
  /* Disaring setelah halaman nempel di DOM (frame berikutnya) — kalau tur
     kebuka di render yang sama dengan isi halaman, targetnya belum ada. */
  const [langkah, setLangkah] = useState<LangkahTur[] | null>(null);
  const [i, setI] = useState(0);
  const [kotak, setKotak] = useState<Kotak | null>(null);
  const balonRef = useRef<HTMLDivElement>(null);
  const utamaRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (langkah) return; // sekali aja — biar urutan gak geser di tengah tur
    const id = requestAnimationFrame(() => setLangkah(
      ((hp && daftar.hp) || daftar.desktop).filter(l => !l.target || cariTarget(l.target).length > 0)));
    return () => cancelAnimationFrame(id);
  }, [langkah, hp, daftar]);

  const n = langkah?.length ?? 0;
  const l = langkah?.[i];
  const target = l?.target ?? null;
  const akhir = i === n - 1;
  const maju = () => setI(x => Math.min(x + 1, n - 1));
  const mundur = () => setI(x => Math.max(x - 1, 0));

  /* Ukur target tiap ganti langkah + ikut resize/scroll. Target di luar
     layar (kartu soal) di-scroll ke tengah dulu. */
  useLayoutEffect(() => {
    if (!langkah) return;
    const ukur = () => setKotak(target ? gabung(cariTarget(target)) : null);
    const els = target ? cariTarget(target) : [];
    const k = gabung(els);
    if (k && (k.top < 0 || k.top + k.height > window.innerHeight)) {
      els[0].scrollIntoView({ block: "center", behavior: kurangiGerak ? "auto" : "smooth" });
    }
    ukur();
    window.addEventListener("resize", ukur);
    window.addEventListener("scroll", ukur, true);
    return () => { window.removeEventListener("resize", ukur); window.removeEventListener("scroll", ukur, true); };
  }, [langkah, target, kurangiGerak]);

  /* Fokus pindah ke tombol utama tiap langkah; balik ke elemen semula pas tutup. */
  useEffect(() => { utamaRef.current?.focus({ preventScroll: true }); }, [i, langkah]);
  useEffect(() => {
    const semula = document.activeElement as HTMLElement | null;
    return () => { if (semula?.isConnected) semula.focus({ preventScroll: true }); };
  }, []);

  /* Esc = lewati, ←/→ = mundur/maju, Tab dikurung di balon. */
  useEffect(() => {
    const tombol = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onSelesai(); }
      else if (e.key === "ArrowRight" && !akhir) { e.preventDefault(); maju(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); mundur(); }
      else if (e.key === "Tab" && balonRef.current) {
        const fokus = [...balonRef.current.querySelectorAll<HTMLElement>("button")];
        const pertama = fokus[0], terakhir = fokus.at(-1);
        if (e.shiftKey && document.activeElement === pertama) { e.preventDefault(); terakhir?.focus(); }
        else if (!e.shiftKey && document.activeElement === terakhir) { e.preventDefault(); pertama?.focus(); }
      }
    };
    document.addEventListener("keydown", tombol);
    return () => document.removeEventListener("keydown", tombol);
  });

  if (!langkah || !l) return null;
  const tengah = !kotak;
  const gayaBalon: CSSProperties | undefined = kotak ? posisiBalon(kotak, hp) : undefined;

  return createPortal(
    <div className={`hx hx-tur${kurangiGerak ? " hx-rm" : ""}`}>
      {kotak
        ? <div className="hx-tur-lubang" style={kotak} aria-hidden="true" />
        : <div className="hx-tur-redup" aria-hidden="true" />}
      <div
        ref={balonRef} key={i} style={gayaBalon}
        className={`hx-tur-balon${tengah ? " hx-tur-tengah" : ""}`}
        role="dialog" aria-modal="true" aria-labelledby={idJudul} aria-describedby={idIsi}
      >
        <div className="hx-tur-isi">
          <Honix pose={l.pose} size={tengah ? 112 : 64} sizeHp={tengah ? 96 : 56} idle={tengah ? "idle" : "none"} alt="" />
          <div>
            <h3 id={idJudul}>{l.judul}</h3>
            <p id={idIsi}>{l.isi}</p>
          </div>
        </div>
        <div className="hx-tur-kaki">
          <div className="hx-tur-titik" role="img" aria-label={`Langkah ${i + 1} dari ${langkah.length}`}>
            {langkah.map((_, n) => <span key={n} className={n === i ? "hx-on" : n < i ? "hx-lewat" : ""} />)}
          </div>
          <div className="hx-tur-aksi">
            {akhir && aksiAkhir ? (
              <>
                <button type="button" className="hx-btn hx-btn-g" onClick={onSelesai}>Nanti</button>
                <button ref={utamaRef} type="button" className="hx-btn hx-btn-p"
                  onClick={() => { onSelesai(); aksiAkhir.onClick(); }}>{aksiAkhir.label}</button>
              </>
            ) : akhir ? (
              <>
                <button type="button" className="hx-btn hx-btn-g" onClick={mundur}>Kembali</button>
                <button ref={utamaRef} type="button" className="hx-btn hx-btn-p" onClick={onSelesai}>Selesai</button>
              </>
            ) : (
              <>
                <button type="button" className="hx-btn-link" onClick={onSelesai}>Lewati</button>
                {i > 0 && <button type="button" className="hx-btn hx-btn-g" onClick={mundur}>Kembali</button>}
                <button ref={utamaRef} type="button" className="hx-btn hx-btn-p" onClick={maju}>{i === 0 ? "Ayo" : "Lanjut"}</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
