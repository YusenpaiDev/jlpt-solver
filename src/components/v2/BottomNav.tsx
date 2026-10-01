"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, BookOpen, ListTodo, BookA, Menu, NotebookPen, BarChart3,
  Settings, Sparkles, X,
} from "lucide-react";
import { useUserStats } from "@/lib/use-user-stats";

const BOTTOM_ITEMS = [
  { href: "/",              label: "Beranda",       Icon: Home },
  { href: "/materi",        label: "Materi",        Icon: BookOpen },
  { href: "/lembar-tugas",  label: "Lembar Tugas",  Icon: ListTodo },
  { href: "/kamus",         label: "Kamus",         Icon: BookA },
] as const;

const MORE_ITEMS = [
  { href: "/catatan",       label: "Catatan",       Icon: NotebookPen },
  { href: "/progres",       label: "Progres",       Icon: BarChart3 },
  { href: "/pengaturan",    label: "Pengaturan",    Icon: Settings },
] as const;

/** Mobile navigation; a route change resets the sheet and releases its scroll lock. */
export function BottomNav() {
  const pathname = usePathname();
  return <MobileNav key={pathname} pathname={pathname} />;
}

function MobileNav({ pathname }: { pathname: string }) {
  const { isPro } = useUserStats();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();
  const titleId = useId();
  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  const moreActive = MORE_ITEMS.some(({ href }) => isActive(href)) || isActive("/premium");

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktop.matches) dialog.close();
    };
    const body = document.body;
    const root = document.documentElement;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
      rootOverflow: root.style.overflow,
    };

    // Fixed body also prevents background scrolling in iOS Safari.
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    root.style.overflow = "hidden";
    dialog.showModal();
    dialog.focus();
    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    const trigger = triggerRef.current;

    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      dialog.close();
      Object.assign(body.style, {
        position: previous.position,
        top: previous.top,
        width: previous.width,
        overflow: previous.overflow,
      });
      root.style.overflow = previous.rootOverflow;
      window.scrollTo({ top: scrollY, behavior: "instant" });
      if (trigger?.isConnected && !desktop.matches) trigger.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <>
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
                <Icon strokeWidth={active ? 2 : 1.6} aria-hidden="true" />
                <span className="bn-item-label">{label}</span>
              </Link>
            );
          })}
          <button
            ref={triggerRef}
            type="button"
            className={`bn-item${moreActive || open ? " active" : ""}`}
            aria-current={moreActive ? "page" : undefined}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={dialogId}
            onClick={() => setOpen(true)}
          >
            <Menu strokeWidth={moreActive || open ? 2 : 1.6} aria-hidden="true" />
            <span className="bn-item-label">Lainnya</span>
          </button>
        </div>
      </nav>

      <dialog
        ref={dialogRef}
        id={dialogId}
        className="bn-sheet glass-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const targets = event.currentTarget.querySelectorAll<HTMLElement>("a[href], button");
          const first = targets[0];
          const last = targets[targets.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientY < bounds.top || event.clientY > bounds.bottom ||
              event.clientX < bounds.left || event.clientX > bounds.right) {
            setOpen(false);
          }
        }}
      >
        <div className="bn-sheet-handle" aria-hidden="true" />
        <div className="bn-sheet-header">
          <h2 id={titleId}>Lainnya</h2>
          <button type="button" className="bn-sheet-close" aria-label="Tutup menu Lainnya" onClick={() => setOpen(false)}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Navigasi lainnya">
          {MORE_ITEMS.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`nav-item${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                <Icon className="nav-item-icon" size={20} strokeWidth={active ? 1.8 : 1.6} aria-hidden="true" />
                <span className="nav-item-label">{label}</span>
              </Link>
            );
          })}
          {!isPro && (
            <Link className="nav-upgrade" href="/premium" onClick={() => setOpen(false)} aria-current={isActive("/premium") ? "page" : undefined}>
              <div className="nav-upgrade-icon">
                <Sparkles size={16} fill="currentColor" strokeWidth={1.2} aria-hidden="true" />
              </div>
              <div className="nav-upgrade-text">
                <div className="nav-upgrade-title">Upgrade ke Pro</div>
                <div className="nav-upgrade-sub">Jatah harian lebih lega</div>
              </div>
            </Link>
          )}
        </nav>
      </dialog>
    </>
  );
}
