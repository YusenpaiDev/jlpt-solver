"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, BookOpen, ListTodo, BookA, NotebookPen, BarChart3,
  Settings, Sparkles,
} from "lucide-react";
import { useIsPro } from "@/lib/use-is-pro";
import { HonixTurHost } from "@/components/honix/HonixTurHost";
import { TombolKeluar } from "./TombolKeluar";
import { lompatDiHalamanSama } from "@/lib/lompat-jangkar";
import { IkonBankSoal } from "./IkonBankSoal";

const NAV_ITEMS = [
  { href: "/",              label: "Beranda",       Icon: Home },
  { href: "/materi",        label: "Materi",        Icon: BookOpen },
  /* Bank Soal belum punya halaman sendiri: lompat ke daftar ujian di Materi. */
  { href: "/materi#bank-soal", label: "Bank Soal",  Icon: IkonBankSoal },
  { href: "/lembar-tugas",  label: "Lembar Tugas",  Icon: ListTodo },
  { href: "/kamus",         label: "Kamus",         Icon: BookA },
  { href: "/catatan",       label: "Catatan",       Icon: NotebookPen },
  { href: "/progres",       label: "Progres",       Icon: BarChart3 },
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
  const isPro = useIsPro();
  /* Bank Soal belum punya halaman sendiri; Strategi ujian ada di bawahnya. */
  const isActive = (href: string) => href === "/materi#bank-soal" ? pathname === "/strategi"
    : href === "/" ? pathname === "/" : pathname?.startsWith(href);

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
        /* Materi = pintu utama belajar — dibikin menonjol biar user baru gak bingung mulai dari mana. */
        const prio = href === "/materi";
        return (
          <Link
            key={href}
            href={href}
            className={`nav-item${active ? " active" : ""}${prio ? " nav-prio" : ""}`}
            aria-current={active ? "page" : undefined}
            data-tur={href === "/" ? "beranda" : href.split("#")[1] ?? href.slice(1)}
            onClick={e => lompatDiHalamanSama(e, href)}
          >
            <Icon className="nav-item-icon" size={20} strokeWidth={active ? 1.8 : 1.6} />
            <span className="nav-item-label">
              {label}
              {prio && <small className="nav-prio-tag">Mulai di sini</small>}
            </span>
          </Link>
        );
      })}

      <div className="nav-spacer" />

      {isPro === false && (
        <Link className="nav-upgrade" href="/premium">
          <div className="nav-upgrade-icon">
            <Sparkles size={16} fill="white" stroke="white" strokeWidth={1.2} />
          </div>
          <div className="nav-upgrade-text">
            <div className="nav-upgrade-title">Upgrade ke Pro</div>
            <div className="nav-upgrade-sub">Chat AI tanpa batas</div>
          </div>
        </Link>
      )}

      <Link
        href="/pengaturan"
        className={`nav-item${isActive("/pengaturan") || isActive("/langganan") ? " active" : ""}`}
        data-tur="pengaturan"
      >
        <Settings className="nav-item-icon" size={20} />
        <span className="nav-item-label">Pengaturan</span>
      </Link>

      <TombolKeluar />

      {/* Tur cara pakai — render lewat portal, jadi ikut jalan di HP walau rail-nya disembunyiin. */}
      <HonixTurHost />
    </nav>
  );
}
