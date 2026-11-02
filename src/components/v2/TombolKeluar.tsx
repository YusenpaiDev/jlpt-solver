"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Keluar akun beneran. Dulu "Keluar" cuma link ke /login — sesinya tetap
 * nyala, jadi buka halaman lain langsung masuk lagi. Navigasi penuh (bukan
 * router.push) biar proxy baca cookie yang udah dihapus.
 */
export function TombolKeluar({ className = "nav-item" }: { className?: string }) {
  const [proses, setProses] = useState(false);
  const [gagal, setGagal] = useState(false);

  const keluar = async () => {
    if (proses) return;
    setProses(true); setGagal(false);
    const { error } = await createClient().auth.signOut();
    if (error) { setProses(false); setGagal(true); return; }
    window.location.href = "/login";
  };

  return (
    <button type="button" className={`${className} nav-keluar`} onClick={keluar} disabled={proses} aria-label="Keluar akun">
      <LogOut className="nav-item-icon" size={20} aria-hidden="true" />
      <span className="nav-item-label" role={gagal ? "alert" : undefined}>
        {proses ? "Keluar…" : gagal ? "Gagal keluar, coba lagi" : "Keluar"}
      </span>
    </button>
  );
}
