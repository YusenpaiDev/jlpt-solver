"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/rencana-pamer.css";
import { useEffect, useMemo, useState } from "react";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import { useUserStats } from "@/lib/use-user-stats";
import { tanggalLokal } from "@/lib/aktivitas";

type Format = "story" | "feed";
const NAMA_FILE = "honix-jlpt-progres.png";

/** Kartu pamer siap share (handoff Rencana Belajar §11). Gambar dirender server. */
export default function PamerPage() {
  const stats = useUserStats();
  const [format, setFormat] = useState<Format>("story");
  const [nama, setNama] = useState(true);
  const [hp, setHp] = useState(false);
  const [muat, setMuat] = useState(true);
  const [sibuk, setSibuk] = useState<"bagi" | "simpan" | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const ubah = () => setHp(mq.matches);
    mq.addEventListener("change", ubah);
    queueMicrotask(ubah);
    return () => mq.removeEventListener("change", ubah);
  }, []);

  const src = useMemo(() => `/api/kartu-pamer?format=${format}&nama=${nama ? 1 : 0}&tanggal=${tanggalLokal()}`, [format, nama]);
  /* Skala pratinjau sama kayak prototype. */
  const sk = format === "story" ? (hp ? 0.25 : 0.29) : hp ? 0.32 : 0.42;
  const lebar = 1080 * sk, tinggi = (format === "story" ? 1920 : 1080) * sk;

  const ambil = async () => {
    const r = await fetch(src);
    if (!r.ok) throw new Error(`gagal (${r.status})`);
    return new File([await r.blob()], NAMA_FILE, { type: "image/png" });
  };
  const unduh = (f: File) => {
    const u = URL.createObjectURL(f);
    const a = Object.assign(document.createElement("a"), { href: u, download: NAMA_FILE });
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  };
  const bagikan = async () => {
    setSibuk("bagi"); setPesan(null);
    try {
      const f = await ambil();
      if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title: "Progres belajar JLPT" });
      else { unduh(f); setPesan("Browser ini belum bisa langsung bagikan gambar, jadi kartunya diunduh."); }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setPesan("Kartu belum bisa dibuat. Coba lagi sebentar.");
    } finally { setSibuk(null); }
  };
  const simpan = async () => {
    setSibuk("simpan"); setPesan(null);
    try { unduh(await ambil()); } catch { setPesan("Kartu belum bisa dibuat. Coba lagi sebentar."); } finally { setSibuk(null); }
  };

  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />
      <main className="app-shell">
        <UserBar streakDays={stats.streak} xp={stats.xp} xpTarget={stats.xpTarget} avatarLetter={stats.initial} isPro={stats.isPro} />
        <Breadcrumb items={[{ label: "Progres", href: "/progres?tab=waktu" }, { label: "Kartu pamer" }]} />
        <div className="rbk">
          <div className="head"><div>
            <div className="eyebrow">Kartu pamer</div>
            <h1 className="h1">Pamerin progresmu</h1>
            <p className="sub">Gambar siap share ke story atau feed. Email gak pernah masuk kartu.</p>
          </div></div>
          <div className="pm">
            <div className="pv">
              <div className="pv-w" style={{ width: lebar, height: tinggi }}>
                {muat && <div className="pv-load">Nyiapin kartu…</div>}
                {/* eslint-disable-next-line @next/next/no-img-element -- PNG dinamis dari /api/kartu-pamer */}
                <img key={src} src={src} alt="Pratinjau kartu pamer" onLoad={() => setMuat(false)} onError={() => { setMuat(false); setPesan("Pratinjau belum bisa dimuat."); }} />
              </div>
            </div>
            <aside className="card po">
              <div>
                <div className="po-t">Format</div>
                <div className="seg" role="group" aria-label="Format kartu">
                  <button type="button" className={format === "story" ? "on" : ""} aria-pressed={format === "story"} onClick={() => { setMuat(true); setFormat("story"); }}>Story · 1080×1920</button>
                  <button type="button" className={format === "feed" ? "on" : ""} aria-pressed={format === "feed"} onClick={() => { setMuat(true); setFormat("feed"); }}>Feed · 1080×1080</button>
                </div>
              </div>
              <button type="button" className="tg" aria-pressed={nama} onClick={() => { setMuat(true); setNama(x => !x); }}>
                <span>Tampilkan nama<small>dari Pengaturan → Profil</small></span>
                <span className={`sw${nama ? " on" : ""}`} aria-hidden="true" />
              </button>
              <div>
                <div className="po-t">Isi kartu</div>
                <ul className="inc"><li>Total jam belajar</li><li>Streak sekarang</li><li>Kalender cap bulan ini</li><li>Level & sesi target</li><li>Tes mini terbaik</li></ul>
              </div>
              <div className="po-a">
                <button type="button" className="btn btn-p btn-lg" onClick={bagikan} disabled={sibuk !== null}>{sibuk === "bagi" ? "Nyiapin…" : "Bagikan"}</button>
                <button type="button" className="btn btn-g" onClick={simpan} disabled={sibuk !== null}>{sibuk === "simpan" ? "Nyiapin…" : "Simpan gambar"}</button>
              </div>
              {pesan && <p className="note" role="status">{pesan}</p>}
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
