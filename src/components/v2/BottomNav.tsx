"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, BookA, BarChart3 } from "lucide-react";
import { IkonBankSoal } from "./IkonBankSoal";
import { navAktif } from "@/lib/nav-aktif";

/* Nav 5 menu (HANDOFF-alur-belajar §6). Materi di tengah jadi tombol bulat
   yang naik — pintu utama belajar. "Lainnya" hilang: Pengaturan, Langganan,
   dan Keluar lewat avatar di topbar. `tur` = target tur Honix. */
const BOTTOM_ITEMS = [
  { href: "/",              label: "Beranda",  Icon: Home,          tur: "beranda" },
  { href: "/latihan/set",   label: "Latihan",  Icon: IkonBankSoal,  tur: "latihan" },
  { href: "/materi",        label: "Materi",   Icon: BookOpen,      tur: "materi" },
  { href: "/kamus",         label: "Kamus",    Icon: BookA,         tur: "kamus" },
  { href: "/progres",       label: "Progres",  Icon: BarChart3,     tur: "progres" },
] as const;

export function BottomNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="bottom-nav" aria-label="Navigasi bawah">
      <div className="bottom-nav-inner">
        {BOTTOM_ITEMS.map(({ href, label, Icon, tur }) => {
          const active = navAktif(href, pathname);
          if (href === "/materi") {
            return (
              <Link key={href} href={href} className={`bn-item bn-prio${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined} data-tur={tur}>
                <span className="bn-prio-bulat"><Icon strokeWidth={2} aria-hidden="true" /></span>
                <span className="bn-item-label">{label}</span>
              </Link>
            );
          }
          return (
            <Link key={href} href={href} className={`bn-item${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined} data-tur={tur}>
              <Icon strokeWidth={active ? 2 : 1.6} aria-hidden="true" />
              <span className="bn-item-label">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
