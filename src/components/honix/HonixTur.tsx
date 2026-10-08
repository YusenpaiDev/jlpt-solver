"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Honix } from "./Honix";
import { useHonix } from "@/lib/use-honix";
import { LANGKAH_DESKTOP, LANGKAH_HP, type LangkahTur } from "@/lib/honix-tur";

const HP = "(max-width: 767px)";
const JARAK = 6;   // lubang sorot lebih lebar dari ikonnya
const CELAH = 14;  // jarak balon ke lubang
const TEPI = 12;   // balon gak boleh mepet tepi layar

/** Item nav yang kelihatan — nav rail `display:none` di HP, bottom nav di desktop. */
function cariTarget(nama: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tur="${nama}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

type Kotak = { top: number; left: number; width: number; height: number };

/* Balon di kanan target (nav rail kiri), di atas (bottom nav / target di
   bawah layar), atau di bawahnya. */
function posisiBalon(t: Kotak, hp: boolean): CSSProperties {
  const vw = window.innerWidth, vh = window.innerHeight;
  const lebar = Math.min(360, vw - TEPI * 2);
  const tengahX = t.left + t.width / 2;
  const left = Math.min(Math.max(tengahX - lebar / 2, TEPI), vw - lebar - TEPI);
  if (hp || t.top > vh * 0.6) return { width: lebar, left, bottom: vh - t.top + CELAH };
  if (t.left + t.width < vw / 3) {
    return { width: lebar, left: t.left + t.width + CELAH, top: Math.min(Math.max(t.top + t.height / 2 - 90, TEPI), vh - 260) };
  }
  return { width: lebar, left, top: t.top + t.height + CELAH };
}

/**
 * Tur sorot menu navigasi (spec 2026-10-09-honix-tur-design). Layar
 * digelapin, satu ikon nav terang, Honix jelasin lewat balon. Langkah yang
 * targetnya gak ada di halaman ini dilewati.
 */
export function HonixTur({ onSelesai }: { onSelesai: () => void }) {
  const { kurangiGerak } = useHonix();
  const router = useRouter();
  const idJudul = useId(), idIsi = useId();
  const [hp] = useState(() => window.matchMedia(HP).matches);
  const [langkah] = useState<LangkahTur[]>(() =>
    (hp ? LANGKAH_HP : LANGKAH_DESKTOP).filter(l => !l.target || cariTarget(l.target)));
  const [i, setI] = useState(0);
  const [kotak, setKotak] = useState<Kotak | null>(null);
  const balonRef = useRef<HTMLDivElement>(null);
  const utamaRef = useRef<HTMLButtonElement>(null);

  const l = langkah[i];
  const akhir = i === langkah.length - 1;
  const maju = () => setI(n => Math.min(n + 1, langkah.length - 1));
  const mundur = () => setI(n => Math.max(n - 1, 0));

  /* Ukur target tiap ganti langkah + ikut resize/scroll. */
  useLayoutEffect(() => {
    const ukur = () => {
      const el = l.target ? cariTarget(l.target) : null;
      if (!el) { setKotak(null); return; }
      const r = el.getBoundingClientRect();
      setKotak({ top: r.top - JARAK, left: r.left - JARAK, width: r.width + JARAK * 2, height: r.height + JARAK * 2 });
    };
    ukur();
    window.addEventListener("resize", ukur);
    window.addEventListener("scroll", ukur, true);
    return () => { window.removeEventListener("resize", ukur); window.removeEventListener("scroll", ukur, true); };
  }, [l.target]);

  /* Fokus pindah ke tombol utama tiap langkah; balik ke elemen semula pas tutup. */
  useEffect(() => { utamaRef.current?.focus({ preventScroll: true }); }, [i]);
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
            {akhir ? (
              <>
                <button type="button" className="hx-btn hx-btn-g" onClick={onSelesai}>Nanti</button>
                <button ref={utamaRef} type="button" className="hx-btn hx-btn-p"
                  onClick={() => { onSelesai(); router.push("/latihan/kilat"); }}>Mulai latihan</button>
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
