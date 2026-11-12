"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/gembok.css";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUserStats } from "@/lib/use-user-stats";
import { honixSrc } from "@/lib/honix-pose";
import { tanggalLokal } from "@/lib/aktivitas";
import { DEV_BYPASS } from "@/lib/dev-materi";
import {
  ambilTerkunci, bukaPremium, dengarKunci, JUDUL_KUNCI, langgananTerkunci, ruteTerkunci, setTerkunci, type AlasanKunci,
} from "@/lib/akses-premium";

const KUNCI_POPUP = "honix:popup-premium";

/** true = masa percobaan habis & belum Premium (dibaca tombol mana aja). */
export function useTerkunci(): boolean {
  return useSyncExternalStore(langgananTerkunci, ambilTerkunci, () => false);
}

/** Status dari profil. Dev tanpa login: data contohnya kebaca "habis", jadi
    gembok cuma nyala kalau ?dev=habis biar cek visual lain gak ikut kekunci. */
function useHitungTerkunci(): { siap: boolean; kunci: boolean } {
  const stats = useUserStats();
  /* Dibaca setelah mount biar server & render pertama sama (gak hydration mismatch). */
  const [dev, setDev] = useState<{ siap: boolean; habis: boolean }>({ siap: false, habis: false });
  useEffect(() => {
    if (!DEV_BYPASS) return;
    const t = setTimeout(() => setDev({ siap: true, habis: new URLSearchParams(window.location.search).get("dev") === "habis" }), 0);
    return () => clearTimeout(t);
  }, []);
  if (DEV_BYPASS) return { siap: dev.siap, kunci: dev.habis };
  return { siap: stats.loaded, kunci: stats.loaded && stats.akses.status === "expired" };
}

/**
 * Dipasang sekali di NavRail: isi status kunci bersama, tandain <body> (buat
 * 🔒 di tombol latihan), cegat link ke halaman latihan → pop-up, dan pop-up
 * sekali sehari di Beranda begitu masa percobaan habis.
 */
export function PremiumHost() {
  const { siap, kunci } = useHitungTerkunci();
  const pathname = usePathname();
  const [alasan, setAlasan] = useState<AlasanKunci | null>(null);

  useEffect(() => {
    if (!siap) return;
    setTerkunci(kunci);
    if (kunci) document.body.dataset.terkunci = "1"; else delete document.body.dataset.terkunci;
  }, [siap, kunci]);

  useEffect(() => dengarKunci(a => setAlasan(a)), []);

  /* Link ke halaman latihan dicegat sebelum pindah halaman. */
  useEffect(() => {
    if (!kunci) return;
    const cegat = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || !ruteTerkunci(a.getAttribute("href") ?? "")) return;
      e.preventDefault(); e.stopPropagation();
      bukaPremium("latihan");
    };
    document.addEventListener("click", cegat, true);
    return () => document.removeEventListener("click", cegat, true);
  }, [kunci]);

  /* Sekali sehari di Beranda: "masa percobaan habis". */
  useEffect(() => {
    if (!kunci || pathname !== "/") return;
    try {
      if (localStorage.getItem(KUNCI_POPUP) === tanggalLokal()) return;
      localStorage.setItem(KUNCI_POPUP, tanggalLokal());
    } catch { /* mode privat */ }
    const t = setTimeout(() => bukaPremium("habis"), 900);
    return () => clearTimeout(t);
  }, [kunci, pathname]);

  return alasan ? <PremiumSheet alasan={alasan} onTutup={() => setAlasan(null)} /> : null;
}

/** Penjaga halaman latihan (dibuka langsung lewat URL / router.push): layar gembok, bukan soal. */
export function KunciHalaman({ children }: { children: React.ReactNode }) {
  const { siap, kunci } = useHitungTerkunci();
  useEffect(() => { if (siap) setTerkunci(kunci); }, [siap, kunci]);
  if (!siap || !kunci) return <>{children}</>;
  return (
    <div className="rbk gk-hal">
      <div className="card gk-kartu">
        {/* eslint-disable-next-line @next/next/no-img-element -- PNG transparan Honix */}
        <img className="hx gk-hx" src={honixSrc("tunggu")} alt="Honix" />
        <IsiPremium alasan="latihan" />
        <Link className="btn btn-q" href="/">← Balik ke Beranda</Link>
      </div>
    </div>
  );
}

const UNTUNG = [
  "Latihan Kotoba & Bunpou, misi harian, tes mini",
  "Bank Soal: set latihan format JLPT + 聴解 beraudio",
  "Lembar Tugas, Kamus, Catatan, Sensei AI",
  "Riwayat & progres lanjut terus dari yang udah kamu kerjain",
];

function IsiPremium({ alasan }: { alasan: AlasanKunci }) {
  return (
    <>
      <div className="eyebrow">🔒 Premium</div>
      <h2 className="gk-t">{JUDUL_KUNCI[alasan]}</h2>
      <p className="gk-p">Semua isi Honix tetap bisa kamu lihat. Buat lanjut latihan, buka semuanya dengan Premium.</p>
      <ul className="gk-l">{UNTUNG.map(u => <li key={u}>{u}</li>)}</ul>
      <Link className="btn btn-p btn-lg gk-cta" href="/premium">Lihat paket Premium →</Link>
    </>
  );
}

/** Pop-up ajakan Premium (bottom sheet di HP). */
function PremiumSheet({ alasan, onTutup }: { alasan: AlasanKunci; onTutup: () => void }) {
  const tutupRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const semula = document.activeElement as HTMLElement | null;
    tutupRef.current?.focus({ preventScroll: true });
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onTutup(); };
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("keydown", esc); if (semula?.isConnected) semula.focus({ preventScroll: true }); };
  }, [onTutup]);
  return createPortal(
    <div className="rbk">
      <div className="ov" onClick={e => { if (e.target === e.currentTarget) onTutup(); }}>
        <div className="card sheet gk-sheet" role="dialog" aria-modal="true" aria-label={JUDUL_KUNCI[alasan]}>
          {/* eslint-disable-next-line @next/next/no-img-element -- PNG transparan Honix */}
          <img className="hx gk-hx" src={honixSrc(alasan === "habis" ? "tunggu" : "tunjuk")} alt="Honix" />
          <IsiPremium alasan={alasan} />
          <button ref={tutupRef} type="button" className="btn btn-q" onClick={onTutup}>Nanti aja</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
