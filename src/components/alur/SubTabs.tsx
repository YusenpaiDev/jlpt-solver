"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/alur.css";
import Link from "next/link";
import { BookA, ListTodo, NotebookPen } from "lucide-react";
import { IkonBankSoal } from "@/components/v2/IkonBankSoal";

/* Ikon sama kayak ikon menu lamanya, biar yang dulu buka Bank Soal / Lembar Tugas / Catatan langsung ngenalin. */
const TAB = {
  latihan: { label: "Latihan", isi: [
    { k: "set", t: "Set format JLPT", href: "/latihan/set", Icon: IkonBankSoal },
    { k: "tugas", t: "Lembar Tugas", href: "/latihan/tugas", Icon: ListTodo },
  ] },
  kamus: { label: "Kamus", isi: [
    { k: "kamus", t: "Kamus", href: "/kamus", Icon: BookA },
    { k: "catatan", t: "Catatan", href: "/kamus/catatan", Icon: NotebookPen },
  ] },
} as const;

/** Pil segmented di atas judul halaman (HANDOFF-alur-belajar §6). Tab aktif oranye penuh
    biar kelihatan ini halaman yang punya pilihan. Halamannya sendiri gak diubah. */
export function SubTabs({ grup, aktif }: { grup: keyof typeof TAB; aktif: string }) {
  const g = TAB[grup];
  return (
    <div className="rbk">
      <nav className="subt" aria-label={g.label}>
        {g.isi.map(({ k, t, href, Icon }) => (
          <Link key={k} href={href} className={k === aktif ? "on" : ""} aria-current={k === aktif ? "page" : undefined}>
            <Icon size={18} strokeWidth={k === aktif ? 2 : 1.7} aria-hidden="true" />{t}
          </Link>
        ))}
      </nav>
    </div>
  );
}
