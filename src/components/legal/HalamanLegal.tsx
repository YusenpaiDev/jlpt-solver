import Link from "next/link";
import type { ReactNode } from "react";
import "@/styles/legal.css";

export const EMAIL_DUKUNGAN = "yusufnashirsyarifuddin@gmail.com";
export const BERLAKU = "1 November 2026";

export type Bagian = { id: string; judul: string; isi: ReactNode };

/**
 * Kerangka halaman legal (Kebijakan Privasi, Syarat & Ketentuan). Publik —
 * bisa dibuka tanpa login dan oleh akun yang trial-nya habis (lihat proxy.ts).
 * Desktop: daftar isi nempel di kiri, isi di kanan.
 */
export function HalamanLegal({ judul, jp, ringkas, bagian, lain }: {
  judul: string;
  jp: string;
  ringkas: ReactNode;
  bagian: Bagian[];
  lain: { href: string; label: string };
}) {
  return (
    <div className="lgl">
      <header className="lgl-top">
        <Link href="/" className="lgl-brand"><span className="lgl-mark">先</span>Sensei JLPT</Link>
        <Link href={lain.href} className="lgl-lain">{lain.label} →</Link>
      </header>

      <div className="lgl-hero">
        <h1>{judul} <span className="lgl-jp">{jp}</span></h1>
        <p className="lgl-tgl">Berlaku sejak {BERLAKU}</p>
        <div className="lgl-ringkas">{ringkas}</div>
      </div>

      <div className="lgl-grid">
        <nav className="lgl-toc" aria-label="Daftar isi">
          <p>Daftar isi</p>
          <ol>{bagian.map(b => <li key={b.id}><a href={`#${b.id}`}>{b.judul}</a></li>)}</ol>
        </nav>
        <article className="lgl-isi">
          {bagian.map((b, i) => (
            <section key={b.id} id={b.id}>
              <h2><span>{i + 1}.</span> {b.judul}</h2>
              {b.isi}
            </section>
          ))}
          <p className="lgl-kontak">
            Ada pertanyaan? Email <a href={`mailto:${EMAIL_DUKUNGAN}`}>{EMAIL_DUKUNGAN}</a>.
          </p>
        </article>
      </div>
    </div>
  );
}
