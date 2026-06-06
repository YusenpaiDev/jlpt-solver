"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, BookOpen, History, Camera, ListTodo, BookA, NotebookPen, BarChart3,
  Headphones, Settings, LogOut, Sparkles,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/",              label: "Beranda",       Icon: Home },
  { href: "/materi",        label: "Materi",        Icon: BookOpen },
  { href: "/riwayat-soal",  label: "Riwayat Soal",  Icon: History },
  { href: "/analisis-foto", label: "Analisis Foto", Icon: Camera },
  { href: "/lembar-tugas",  label: "Lembar Tugas",  Icon: ListTodo },
  { href: "/choukai",       label: "Choukai",       Icon: Headphones },
  { href: "/kamus",         label: "Kamus",         Icon: BookA },
  { href: "/catatan",       label: "Catatan",       Icon: NotebookPen },
  { href: "/statistik",     label: "Statistik",     Icon: BarChart3 },
] as const;

/**
 * Left navigation rail (desktop expanded on hover, tablet icon-only, mobile hidden).
 * Auto-detects active route via usePathname — no prop needed.
 *
 * Visibility is driven by globals.css responsive layer:
 *   <1024px = icon-only (tablet), <768px = display: none (mobile).
 * Pair with <BottomNav/> for mobile.
 */
export function NavRail() {
  const pathname = usePathname();
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname?.startsWith(href);

  return (
    <nav className="nav-rail" aria-label="Navigasi utama">
      <Link href="/" className="nav-brand">
        <div className="nav-brand-mark">先</div>
        <div className="nav-brand-text">
          <span className="nav-brand-name">Sensei</span>
          <span className="nav-brand-tag">JLPT · AI</span>
        </div>
      </Link>

      <div className="nav-section-label">Belajar</div>

      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={`nav-item${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="nav-item-icon" size={20} strokeWidth={active ? 1.8 : 1.6} />
            <span className="nav-item-label">{label}</span>
          </Link>
        );
      })}

      <div className="nav-spacer" />

      <Link className="nav-upgrade" href="/premium">
        <div className="nav-upgrade-icon">
          <Sparkles size={14} fill="white" stroke="white" strokeWidth={1.2} />
        </div>
        <div className="nav-upgrade-text">
          <div className="nav-upgrade-title">Upgrade ke Pro</div>
          <div className="nav-upgrade-sub">Analisis unlimited</div>
        </div>
      </Link>

      <Link
        href="/pengaturan"
        className={`nav-item${isActive("/pengaturan") ? " active" : ""}`}
      >
        <Settings className="nav-item-icon" size={20} />
        <span className="nav-item-label">Pengaturan</span>
      </Link>

      <Link href="/login" className="nav-item" aria-label="Keluar">
        <LogOut className="nav-item-icon" size={20} />
        <span className="nav-item-label">Keluar</span>
      </Link>
    </nav>
  );
}
