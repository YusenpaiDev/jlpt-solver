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

/* `dok` = layar sentuh: bar nempel di bawah layar, bukan di dekat seleksi —
   menu bawaan iOS/Android (Salin, Cari Tahu, …) bisa muncul di atas ATAU di
   bawah seleksi dan posisinya gak bisa diatur dari web, jadi pasti tabrakan. */
type Posisi = { teks: string; x: number; y: number; bawah: boolean; dok: boolean };

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
    /* Mouse masih ditahan = lagi ngeblok. Bar baru muncul setelah dilepas —
       kalau muncul di tengah drag dan kursor lewat di atasnya, seleksi melar
       sampai posisi bar di DOM (ujung <body>) dan ngeblok satu halaman. */
    let ditahan = false;
    const tekan = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || (e.target as Element | null)?.closest?.(".seleksi-aksi")) return;
      ditahan = true; setPos(null);
    };
    const lepas = (e: PointerEvent) => { if (e.pointerType === "mouse" && ditahan) { ditahan = false; baca(); } };
    const baca = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (ditahan) return;
        const sel = window.getSelection();
        const root = wadah.current;
        if (!sel || sel.isCollapsed || !sel.rangeCount || !root) { setPos(null); return; }
        const range = sel.getRangeAt(0);
        if (!root.contains(range.commonAncestorContainer) || diInput(range.commonAncestorContainer)) { setPos(null); return; }
        const teks = teksBersih(range);
        if (!teks || teks.length > MAKS) { setPos(null); return; }
        const r = range.getBoundingClientRect();
        const dok = window.matchMedia("(pointer: coarse)").matches;
        const bawah = r.top < 64;
        // Kira-kira setengah lebar bar — dijaga tetap di dalam kolom soal, biar
        // gak kepotong di tepi layar atau numpuk ke nav rail.
        const separuh = Math.min(240, window.innerWidth / 2);
        const kolom = root.getBoundingClientRect();
        const kiri = Math.max(separuh + 8, kolom.left + separuh);
        const kanan = Math.min(window.innerWidth - separuh - 8, kolom.right - separuh);
        const x = Math.min(Math.max(r.left + r.width / 2, kiri), Math.max(kiri, kanan));
        setDisalin(false);
        setPos({ teks, x, y: bawah ? r.bottom + 10 : r.top - 10, bawah, dok });
      });
    };
    const tutup = (e: KeyboardEvent) => { if (e.key === "Escape") { window.getSelection()?.removeAllRanges(); setPos(null); } };
    document.addEventListener("selectionchange", baca);
    document.addEventListener("pointerdown", tekan, true);
    document.addEventListener("pointerup", lepas, true);
    window.addEventListener("scroll", baca, true);
    window.addEventListener("resize", baca);
    document.addEventListener("keydown", tutup);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("selectionchange", baca);
      document.removeEventListener("pointerdown", tekan, true);
      document.removeEventListener("pointerup", lepas, true);
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
      className={`seleksi-aksi${pos.dok ? " dok" : pos.bawah ? " bawah" : ""}`}
      style={pos.dok ? undefined : { left: pos.x, top: pos.y }}
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
