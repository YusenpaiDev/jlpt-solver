"use client";

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { BookmarkPlus, Copy, MessageCircle, NotebookPen } from "lucide-react";

const MAKS = 200;

/** Teks seleksi tanpa bacaan furigana — <rt>/<rp> ikut kebawa di toString(). */
function teksBersih(range: Range): string {
  const frag = range.cloneContents();
  frag.querySelectorAll("rt, rp").forEach(n => n.remove());
  return (frag.textContent ?? "").replace(/\s+/g, " ").trim();
}

function diInput(n: Node | null): boolean {
  const el = n instanceof Element ? n : n?.parentElement;
  return !!el?.closest("input, textarea, [contenteditable=''], [contenteditable='true']");
}

type Posisi = { teks: string; x: number; y: number; bawah: boolean };

/**
 * Blok teks di soal/pembahasan → bar kecil [Tanya Sensei] [Simpan ke Kamus]
 * [Catat] [Salin]. Pemanggil yang buka panel/lembar yang sesuai.
 */
export function SeleksiAksi({ wadah, nonaktif, onTanya, onKamus, onCatat }: {
  wadah: RefObject<HTMLElement | null>;
  /** Mis. mode Coret nyala. */
  nonaktif?: boolean;
  onTanya: (teks: string) => void;
  onKamus: (teks: string) => void;
  onCatat: (teks: string) => void;
}) {
  const [pos, setPos] = useState<Posisi | null>(null);
  const [disalin, setDisalin] = useState(false);

  useEffect(() => {
    if (nonaktif) return;
    let raf = 0;
    const baca = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const sel = window.getSelection();
        const root = wadah.current;
        if (!sel || sel.isCollapsed || !sel.rangeCount || !root) { setPos(null); return; }
        const range = sel.getRangeAt(0);
        if (!root.contains(range.commonAncestorContainer) || diInput(range.commonAncestorContainer)) { setPos(null); return; }
        const teks = teksBersih(range);
        if (!teks || teks.length > MAKS) { setPos(null); return; }
        const r = range.getBoundingClientRect();
        // Di layar sentuh menu bawaan HP muncul di atas seleksi → bar ditaruh di bawahnya.
        const bawah = window.matchMedia("(pointer: coarse)").matches || r.top < 64;
        // Kira-kira setengah lebar bar — biar gak kepotong di tepi.
        const separuh = Math.min(240, window.innerWidth / 2);
        const x = Math.min(Math.max(r.left + r.width / 2, separuh), window.innerWidth - separuh);
        setDisalin(false);
        setPos({ teks, x, y: bawah ? r.bottom + 10 : r.top - 10, bawah });
      });
    };
    const tutup = (e: KeyboardEvent) => { if (e.key === "Escape") { window.getSelection()?.removeAllRanges(); setPos(null); } };
    document.addEventListener("selectionchange", baca);
    window.addEventListener("scroll", baca, true);
    window.addEventListener("resize", baca);
    document.addEventListener("keydown", tutup);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("selectionchange", baca);
      window.removeEventListener("scroll", baca, true);
      window.removeEventListener("resize", baca);
      document.removeEventListener("keydown", tutup);
    };
  }, [wadah, nonaktif]);

  if (!pos || nonaktif) return null;

  const jalankan = (f: (t: string) => void) => () => {
    f(pos.teks);
    window.getSelection()?.removeAllRanges();
    setPos(null);
  };
  const salin = async () => {
    try { await navigator.clipboard.writeText(pos.teks); setDisalin(true); } catch { /* izin clipboard ditolak */ }
  };

  /* mousedown dicegah biar klik tombol gak ngilangin seleksi duluan. */
  return createPortal(
    <div
      role="toolbar" aria-label="Aksi teks terpilih"
      className={`seleksi-aksi${pos.bawah ? " bawah" : ""}`}
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={e => e.preventDefault()}
    >
      <button type="button" onClick={jalankan(onTanya)}><MessageCircle size={14} strokeWidth={1.9} />Tanya Sensei</button>
      <button type="button" onClick={jalankan(onKamus)}><BookmarkPlus size={14} strokeWidth={1.9} />Simpan ke Kamus</button>
      <button type="button" onClick={jalankan(onCatat)}><NotebookPen size={14} strokeWidth={1.9} />Catat</button>
      <button type="button" onClick={salin}><Copy size={14} strokeWidth={1.9} />{disalin ? "Tersalin ✓" : "Salin"}</button>
    </div>,
    document.body,
  );
}
