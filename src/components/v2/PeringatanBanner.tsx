"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { usePeringatan } from "@/lib/peringatan";
import { useTandaHarian } from "@/lib/tanda-harian";

/**
 * Satu peringatan paling mendesak, dipajang di atas Beranda.
 *
 * Sisanya tetap di lonceng <UserBar>. Sengaja cuma satu: banner itu tempat yang
 * gak bisa dihindarin, dan tumpukan peringatan di tempat yang gak bisa
 * dihindarin berubah jadi hal yang di-scroll lewat begitu aja.
 *
 * Yang ditutup diem sampai besok, bukan selamanya — kalau syaratnya masih kena
 * hari berikutnya, dia balik lagi. Peringatan yang bisa dibungkam permanen sama
 * aja gak ada.
 */
export function PeringatanBanner() {
  const { utama, loaded } = usePeringatan();
  const { ids: ditutup, tandai } = useTandaHarian("sensei-peringatan-tutup");

  if (!loaded || !utama || ditutup.includes(utama.id)) return null;

  return (
    <div className={`peringatan-banner ${utama.tingkat}`} role="status">
      <span className="pb-ic" aria-hidden>{utama.ikon}</span>
      <div className="pb-teks">
        <strong className="pb-judul">{utama.judul}</strong>
        <span className="pb-pesan">{utama.pesan}</span>
      </div>
      {utama.aksi && (
        <Link href={utama.aksi.href} className="pb-aksi">{utama.aksi.label} →</Link>
      )}
      <button
        type="button"
        className="pb-tutup"
        onClick={() => tandai(utama.id)}
        aria-label="Tutup peringatan"
      >
        <X size={14} />
      </button>
    </div>
  );
}
