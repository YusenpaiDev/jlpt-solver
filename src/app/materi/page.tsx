"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import {
  Clock, ArrowRight, BookmarkIcon, Headphones, ScrollText, Lock, Folder, Upload, Lightbulb,
} from "lucide-react";

interface BigCardData {
  href?: string;
  id: string;
  jp: string;
  title: string;
  subtitle: string;
  desc: string;
  cta: string;
  accent: "iris" | "amber" | "emerald";
  progressLabel: string;
  progressPct: number;
}

const AVAILABLE: BigCardData[] = [
  {
    id: "kotoba",
    jp: "語",
    title: "Kotoba",
    subtitle: "Kosakata terstruktur",
    desc: "Kotoba dari file lokal kamu (txt/csv/pdf) — di-parse otomatis, dikelompokkan per level & tema, siap dijadikan flashcard.",
    cta: "Coming Soon",
    accent: "iris",
    progressLabel: "Kerjakan persiapan",
    progressPct: 60,
  },
  {
    id: "bunpou",
    href: "/materi/bunpou",
    jp: "文",
    title: "Bunpou",
    subtitle: "Tata Bahasa",
    desc: "Pola grammar JLPT lengkap per level: penjelasan, penyambungan, contoh kalimat.",
    cta: "Buka Bunpou",
    accent: "amber",
    progressLabel: "Sudah tersedia",
    progressPct: 100,
  },
];

const MENDATANG = [
  { id: "kanji",   jp: "字", title: "Kanji",   Icon: BookmarkIcon,  desc: "Karakter per level, urutan stroke, kanji compound." },
  { id: "choukai", jp: "聴", title: "Choukai", Icon: Headphones,    desc: "Latihan listening dengan audio terstruktur." },
  { id: "dokkai",  jp: "読", title: "Dokkai",  Icon: ScrollText,    desc: "Teks bacaan panjang per level dengan pembahasan." },
] as const;

const TIPS: { t: string; d: string; accent: "iris" | "amber" | "emerald" | "rose" }[] = [
  { t: "Konsisten 15 menit/hari", d: "Lebih efektif daripada cramming sebelum ujian. Streak tetap jalan.", accent: "amber" },
  { t: "Aktif pakai kotoba baru", d: "Coba bikin 1 kalimat sendiri untuk tiap kata baru — bukan cuma hafal terjemahan.", accent: "iris" },
  { t: "Mock test mingguan", d: "Sediakan 1 sesi penuh (105 menit) tiap weekend untuk simulasi suasana ujian.", accent: "emerald" },
];

export default function MateriHub() {
  const [streak, setStreak] = useState(0);
  const [userInitial, setUserInitial] = useState("Y");
  const xp = 820;
  const xpTarget = 1000;

  // TODO: target dari `profiles.target_level` + `profiles.target_date` saat schema tersedia.
  const targetLevel: "N1" | "N2" | "N3" | "N4" | "N5" = "N2";
  const targetDate = "Desember 2026";

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserInitial((user.user_metadata?.full_name || user.email || "Y")[0].toUpperCase());
      const { data } = await supabase.from("profiles").select("streak").eq("id", user.id).single();
      if (data) setStreak(data.streak ?? 0);
    }
    load();
  }, []);

  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />

      <main className="app-shell">
        <UserBar
          streakDays={streak}
          xp={xp}
          xpTarget={xpTarget}
          avatarLetter={userInitial}
          isPro
          hasUnread
        />

        <header className="mat-header">
          <div>
            <Breadcrumb items={[{ label: "Beranda", href: "/" }, { label: "Materi" }]} />
            <h1 className="mat-title">
              Materi <span className="mat-title-jp">教材</span>
            </h1>
            <p className="mat-sub">
              Materi belajar JLPT terstruktur — bukan kotoba personal kamu (itu di{" "}
              <Link href="/kamus">Kamus →</Link>). Drop file lokal kamu, biar AI yang pecah jadi materi terstruktur.
            </p>
          </div>
          <div className="mat-stats">
            <div className="mat-stat-card glass-card">
              <div className="mat-stat-label">Target kamu</div>
              <div className="mat-stat-value">
                <span className={`lv-tag lv-${targetLevel.toLowerCase()}`}>{targetLevel}</span>
                <span className="mat-stat-meta">{targetDate}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="mat-grid">
          <div className="mat-main">
            <section>
              <div className="mat-section-head">
                <h2 className="mat-section-title">
                  Tersedia <span className="mat-section-count">{AVAILABLE.length}</span>
                </h2>
                <span className="mat-section-sub">Klik kartu untuk mulai · sedang dalam persiapan</span>
              </div>
              <div className="mat-card-grid">
                {AVAILABLE.map(c => <BigCard key={c.id} {...c} />)}
              </div>
            </section>

            <section>
              <div className="mat-section-head">
                <h2 className="mat-section-title">
                  Materi mendatang <span className="mat-section-count muted-count">{MENDATANG.length}</span>
                </h2>
                <span className="mat-section-sub">Lagi disiapin, sabar yaa</span>
              </div>
              <div className="mat-soon-grid">
                {MENDATANG.map(({ id, jp, title, Icon, desc }) => (
                  <article className="glass-card soon-card" key={id}>
                    <div className="soon-glyph">
                      {jp}
                      <span className="soon-lock"><Lock size={11} strokeWidth={2} /></span>
                    </div>
                    <div className="soon-body">
                      <h4 className="soon-title">
                        <Icon size={14} strokeWidth={1.6} /> {title}
                      </h4>
                      <p className="soon-desc">{desc}</p>
                    </div>
                    <span className="soon-status">Pending</span>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside className="mat-side">
            <UploadCTA />
            <TipsCard />
            <FolderCard />
          </aside>
        </div>
      </main>
    </>
  );
}

/* ─── Big card (Kotoba / Bunpou) ─── */

function BigCard({ href, jp, title, subtitle, desc, cta, accent, progressLabel, progressPct }: BigCardData) {
  const body = (
    <>
      <div className="bc-glyph-stage">
        <div className={`bc-glow bc-glow-${accent}`} />
        <div className="bc-glyph">{jp}</div>
        {!href && <span className="bc-soon-badge">Soon</span>}
      </div>
      <div className="bc-body">
        <div className="bc-eyebrow">{subtitle}</div>
        <h3 className="bc-title">{title}</h3>
        <p className="bc-desc">{desc}</p>

        <div className="bc-progress-row">
          <div className="bc-progress-meta">
            <span>{progressLabel}</span>
            <span className="bc-progress-pct">{progressPct}%</span>
          </div>
          <div className="bc-progress-track">
            <div
              className={`bc-progress-fill${accent !== "iris" ? ` bcp-${accent}` : ""}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="bc-footer">
          <span className={`bc-cta bc-cta-${accent}`}>
            {href ? <ArrowRight size={12} strokeWidth={2} /> : <Clock size={12} strokeWidth={2} />} {cta}
          </span>
          <span className="bc-arrow" aria-label="Buka">
            <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`glass-card big-card big-card-${accent} interactive`} style={{ textDecoration: "none" }}>
        {body}
      </Link>
    );
  }
  return (
    <article className={`glass-card big-card big-card-${accent} interactive`}>
      {body}
    </article>
  );
}

/* ─── Sidebar cards ─── */

function UploadCTA() {
  return (
    <div className="glass-card upload-cta glow-emerald">
      <div className="upload-cta-icon">
        <Upload size={20} strokeWidth={2} style={{ color: "var(--accent-emerald)" }} />
      </div>
      <h3 className="upload-cta-title">Punya file materi sendiri?</h3>
      <p className="upload-cta-desc">
        Drop PDF, CSV, atau TXT — AI akan parse jadi format
        <code className="upload-code">kanji | reading | arti | level</code>
        siap di-import ke Kamus atau dijadikan halaman materi.
      </p>
      <div className="upload-drop">
        <Folder size={22} strokeWidth={1.6} style={{ color: "var(--text-tertiary)" }} />
        <div>
          <div className="upload-drop-title">Drag &amp; drop file di sini</div>
          <div className="upload-drop-sub">atau klik untuk pilih · max 10 MB</div>
        </div>
      </div>
      <button
        type="button"
        className="btn btn-primary"
        style={{ width: "100%", justifyContent: "center", marginTop: 12 }}
      >
        <Upload size={13} /> Upload file materi
      </button>
    </div>
  );
}

function TipsCard() {
  return (
    <div className="glass-card tips-card">
      <div className="tips-head">
        <Lightbulb size={14} strokeWidth={1.8} style={{ color: "var(--accent-amber)" }} />
        <span className="tips-title">Tips Belajar</span>
      </div>
      <div className="tips-list">
        {TIPS.map(t => (
          <div key={t.t} className="tip-item">
            <span className={`tip-dot tip-${t.accent}`} />
            <div>
              <div className="tip-t">{t.t}</div>
              <div className="tip-d">{t.d}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FolderCard() {
  return (
    <div className="glass-card folder-card">
      <div className="folder-head">
        <Folder size={13} strokeWidth={1.8} style={{ color: "var(--text-tertiary)" }} />
        <span>
          Folder lokal · <code>materi/</code>
        </span>
      </div>
      <p className="folder-desc">
        Folder ini <em>gitignored</em>. Drop file PDF/CSV/TXT ke sini, lalu bilang ke Sensei — file akan
        di-parse otomatis dan jadi materi terstruktur.
      </p>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        style={{ width: "100%", justifyContent: "center" }}
      >
        Buka di Finder
      </button>
    </div>
  );
}
