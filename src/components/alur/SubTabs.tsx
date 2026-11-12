"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/alur.css";
import Link from "next/link";

const TAB = {
  latihan: { label: "Latihan", isi: [{ k: "set", t: "Set format JLPT", href: "/latihan/set" }, { k: "tugas", t: "Lembar Tugas", href: "/latihan/tugas" }] },
  kamus: { label: "Kamus", isi: [{ k: "kamus", t: "Kamus", href: "/kamus" }, { k: "catatan", t: "Catatan", href: "/kamus/catatan" }] },
} as const;

/** Pil segmented di atas judul halaman (HANDOFF-alur-belajar §6). Halamannya sendiri gak diubah. */
export function SubTabs({ grup, aktif }: { grup: keyof typeof TAB; aktif: string }) {
  const g = TAB[grup];
  return (
    <div className="rbk">
      <nav className="subt" aria-label={g.label}>
        {g.isi.map(t => (
          <Link key={t.k} href={t.href} className={t.k === aktif ? "on" : ""} aria-current={t.k === aktif ? "page" : undefined}>{t.t}</Link>
        ))}
      </nav>
    </div>
  );
}
