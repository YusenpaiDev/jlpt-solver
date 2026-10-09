"use client";

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { BookmarkPlus, Copy, MessageCircle, NotebookPen } from "lucide-react";

const MAKS = 200;
const PANEL = "(min-width: 1024px)"; // panel Sensei/Kamus/Catatan cuma ada di sini (hidden lg:flex)

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
 * [Catat] [Salin]. Tanya & Catat cuma kalau panel kanan kelihatan (≥1024px).
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
  const [panel, setPanel] = useState(false);
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
        const adaPanel = window.matchMedia(PANEL).matches;
        // Kira-kira setengah lebar bar (4 tombol vs 2) — biar gak kepotong di tepi.
        const separuh = Math.min(adaPanel ? 240 : 130, window.innerWidth / 2);
        const x = Math.min(Math.max(r.left + r.width / 2, separuh), window.innerWidth - separuh);
        setPanel(adaPanel);
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
      {panel && <button type="button" onClick={jalankan(onTanya)}><MessageCircle size={14} strokeWidth={1.9} />Tanya Sensei</button>}
      <button type="button" onClick={jalankan(onKamus)}><BookmarkPlus size={14} strokeWidth={1.9} />Simpan ke Kamus</button>
      {panel && <button type="button" onClick={jalankan(onCatat)}><NotebookPen size={14} strokeWidth={1.9} />Catat</button>}
      <button type="button" onClick={salin}><Copy size={14} strokeWidth={1.9} />{disalin ? "Tersalin ✓" : "Salin"}</button>
    </div>,
    document.body,
  );
}
