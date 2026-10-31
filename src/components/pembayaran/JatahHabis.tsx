"use client";

import "@/styles/pembayaran.css";
import { useEffect, useRef } from "react";
import Link from "next/link";
import type { KuotaHabis } from "@/lib/kuota-habis";

// Compatibility for quota errors retained in an old tab's chat history.
// Current server responses no longer impose a daily quota.
const PESAN = "Pro dan masa percobaan aktif sekarang tanpa kuota harian. Muat ulang halaman untuk memperbarui status akses.";

export function JatahHabisInline({ onTunggu }: {
  kuota: KuotaHabis; onTunggu?: () => void; sempit?: boolean;
}) {
  return <div className="py py-notice" role="status">
    <p>{PESAN}</p>
    <div className="py-notice-a">
      <Link href="/langganan" className="py-btn py-btn-p">Lihat status akses</Link>
      <button type="button" className="py-btn py-btn-q" onClick={onTunggu}>Tutup</button>
    </div>
  </div>;
}

export function JatahHabisDialog({ kuota, onClose }: {
  kuota: KuotaHabis | null; onClose: () => void;
}) {
  return kuota ? <JatahHabisSheet kuota={kuota} onClose={onClose} /> : null;
}

export function JatahHabisSheet({ onClose }: {
  kuota: KuotaHabis; onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
    };
    window.addEventListener("keydown", escape);
    return () => { window.removeEventListener("keydown", escape); previous?.focus?.(); };
  }, []);
  return <div className="py py-mask" onClick={onClose}>
    <div className="py-sheet" role="dialog" aria-modal="true" aria-labelledby="py-jh-judul" onClick={event => event.stopPropagation()}>
      <h3 id="py-jh-judul">Perbarui status akses</h3>
      <p>{PESAN}</p>
      <div className="py-acts">
        <Link href="/langganan" className="py-btn py-btn-p">Lihat status akses</Link>
        <button ref={closeButton} type="button" className="py-btn py-btn-q" onClick={onClose}>Tutup</button>
      </div>
    </div>
  </div>;
}
