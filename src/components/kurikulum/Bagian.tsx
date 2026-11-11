"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/kurikulum.css";

import Link from "next/link";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import { LabelDisiapkan } from "@/components/rencana/LabelDisiapkan";
import { faseMinggu } from "@/lib/kurikulum-config";
import type { UserStats } from "@/lib/use-user-stats";
import type { Kurikulum, UnitTampil } from "@/lib/use-kurikulum";

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const tglPendek = (t: string) => { const [, m, d] = t.split("-").map(Number); return `${d} ${BULAN[m - 1]}`; };
export const tglPanjang = (t: string) => `${tglPendek(t)} ${t.slice(0, 4)}`;
export const bulanTahun = (t: string | null) => {
  if (!t) return "";
  const [y, m] = t.split("-").map(Number);
  return `${new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long" })} ${y}`;
};

/** Kerangka halaman kurikulum: nav, user bar, breadcrumb, scope .rbk. */
export function Kerangka({ stats, crumb, children }: { stats: UserStats; crumb: { label: string; href?: string }[]; children: React.ReactNode }) {
  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />
      <main className="app-shell">
        <UserBar streakDays={stats.streak} xp={stats.xp} xpTarget={stats.xpTarget} avatarLetter={stats.initial} isPro={stats.isPro} />
        <Breadcrumb items={crumb} />
        <div className="rbk">{children}</div>
      </main>
    </>
  );
}

/** Strip 26 minggu (selesai / dilewati / sebagian / minggu ini). */
export function Strip({ unit }: { unit: UnitTampil[] }) {
  return <div className="utk" aria-hidden="true">{unit.map(u => <i key={u.u} className={u.st === "next" ? "" : u.st} />)}</div>;
}

/** Fitur dimatiin flag → halaman kecil "Sedang disiapkan", tanpa tombol aktif. */
export function Disiapkan({ judul, isi }: { judul: string; isi: string }) {
  return (
    <section className="card ku-prep" style={{ marginTop: 22, display: "block" }}>
      <div className="eyebrow" style={{ color: "var(--info-t)" }}>{judul}<LabelDisiapkan /></div>
      <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 8, lineHeight: 1.55 }}>{isi}</p>
      <div className="kp-x" style={{ fontSize: 12, color: "var(--dim)", marginTop: 12 }}>Belum bisa dipakai hari ini. Sambil nunggu, Kotoba & Bunpou di Materi tetap jalan.</div>
      <Link className="btn btn-g" href="/materi" style={{ marginTop: 16 }}>Ke Materi</Link>
    </section>
  );
}

/** Belum pernah mulai: ajak tes penempatan (atau langsung minggu 1). */
export function BelumMulai({ level, penempatan }: { level: string; penempatan: boolean }) {
  return (
    <section className="card kmc" style={{ marginTop: 18 }}>
      <span>
        <span className="eyebrow">Kurikulum {level}</span>
        <b>26 minggu terarah sampai hari ujian</b>
        <small>{penempatan ? "Mulai dari tes penempatan ±15 menit, biar gak ngulang yang udah kamu bisa." : "Mulai dari minggu 1. Unit yang udah kamu kuasai tetap bisa dilewati."}</small>
      </span>
      <Link className="btn btn-p" href="/penempatan">{penempatan ? "Mulai tes penempatan" : "Mulai kurikulum"}</Link>
    </section>
  );
}

/** Kepala /kurikulum + tab Peta minggu / Keterampilan (§6). */
export function KepalaKurikulum({ k, tab }: { k: Kurikulum; tab: "peta" | "skill" }) {
  const fase = faseMinggu(Math.min(26, k.cur));
  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">{k.kur?.level}{k.kur?.tanggal_ujian ? ` · ujian ${bulanTahun(k.kur.tanggal_ujian)}` : ""}{k.sisaMinggu != null ? ` · ${k.sisaMinggu} minggu lagi` : ""}</div>
          <h1 className="h1">Kurikulum<span className="jp-g" lang="ja">課程</span></h1>
          <p className="sub">{k.cur > 26 ? "Masa cadangan sebelum ujian" : `Minggu ${k.cur} dari 26 · Fase ${fase.t}`}. Tiap minggu satu unit: kata, pola, dan jenis soal.</p>
        </div>
        <Link className="btn btn-p" href="/">Lanjut misi hari ini</Link>
      </div>
      <div className="tabs" role="tablist">
        <Link className={`tab${tab === "peta" ? " on" : ""}`} href="/kurikulum" role="tab" aria-selected={tab === "peta"}>Peta minggu</Link>
        <Link className={`tab${tab === "skill" ? " on" : ""}`} href="/kurikulum/keterampilan" role="tab" aria-selected={tab === "skill"}>Keterampilan</Link>
      </div>
    </>
  );
}
