"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Camera, History, BookA } from "lucide-react";

const BOTTOM_ITEMS = [
  { href: "/",              label: "Beranda",  Icon: Home },
  { href: "/materi",        label: "Materi",   Icon: BookOpen },
  { href: "/analisis-foto", label: "Foto",     Icon: Camera },
  { href: "/riwayat-soal",  label: "Riwayat",  Icon: History },
  { href: "/kamus",         label: "Kamus",    Icon: BookA },
] as const;

/**
 * Mobile-only bottom navigation (5 items, compressed from 8).
 * Hidden by default — `.bottom-nav { display: block }` activates at <768px
 * via globals.css. Pair with <NavRail/> for tablet/desktop.
 */
export function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname?.startsWith(href);

  return (
    <nav className="bottom-nav" aria-label="Navigasi bawah">
      <div className="bottom-nav-inner">
        {BOTTOM_ITEMS.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`bn-item${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon strokeWidth={active ? 2 : 1.6} />
              <span className="bn-item-label">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
