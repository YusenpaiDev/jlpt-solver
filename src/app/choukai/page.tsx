"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import { Headphones, ChevronRight, Clock, Loader2, RefreshCw } from "lucide-react";

type Level = "N1" | "N2" | "N3" | "N4" | "N5";

interface ChoukaiSession {
  id: string;
  level: Level;
  category: string;
  title: string;
  total: number;
  score: number | null;
  created_at: string;
  ai_result: { section?: string; questions?: unknown[] } | null;
}

function relativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "Hari ini";
  if (days < 2) return "Kemarin";
  if (days < 7) return `${days} hari lalu`;
  if (days < 30) return `${Math.floor(days / 7)} minggu lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function isChoukai(s: { category: string; ai_result: ChoukaiSession["ai_result"] }): boolean {
  if (s.category?.startsWith("聴解")) return true;
  if (s.ai_result?.section === "choukai") return true;
  return false;
}

export default function ChoukaiList() {
  const [sessions, setSessions] = useState<ChoukaiSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [userInitial, setUserInitial] = useState("Y");

  const fetchAll = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFetchError("Kamu perlu login untuk melihat sesi choukai.");
        return;
      }
      setUserInitial((user.user_metadata?.full_name || user.email || "Y")[0].toUpperCase());

      const [profileRes, sessionRes] = await Promise.all([
        supabase.from("profiles").select("streak").eq("id", user.id).single(),
        supabase.from("sessions")
          .select("id, level, category, title, total, score, created_at, ai_result")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);
      if (profileRes.data) setStreak(profileRes.data.streak ?? 0);
      if (sessionRes.error) throw sessionRes.error;

      const all = (sessionRes.data ?? []) as ChoukaiSession[];
      setSessions(all.filter(isChoukai));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Gagal memuat sesi choukai.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />

      <main className="app-shell">
        <UserBar
          streakDays={streak}
          xp={820}
          xpTarget={1000}
          avatarLetter={userInitial}
          isPro
          hasUnread
        />

        <header className="mat-header">
          <div>
            <Breadcrumb items={[{ label: "Beranda", href: "/" }, { label: "Choukai" }]} />
            <h1 className="mat-title">
              Choukai <span className="mat-title-jp">聴解</span>
            </h1>
            <p className="mat-sub">
              Sesi listening JLPT — dengar audio, jawab soal, lihat transkrip + penjelasan.
              Generate sesi baru lewat <code className="upload-code">npm run import</code> dengan JSON dari{" "}
              <Link href="/materi">prompt choukai</Link>.
            </p>
          </div>
          <div className="mat-stats">
            <div className="mat-stat-card glass-card">
              <div className="mat-stat-label">Total sesi</div>
              <div className="mat-stat-value">
                <span className="mat-stat-meta">{sessions.length} choukai</span>
              </div>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="ch-list-empty">
            <Loader2 size={20} className="ch-spin" /> Memuat sesi choukai…
          </div>
        ) : fetchError ? (
          <div className="ch-list-empty">
            <p>{fetchError}</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={fetchAll}>
              <RefreshCw size={13} /> Coba lagi
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="glass-card ch-list-empty">
            <Headphones size={28} strokeWidth={1.6} style={{ color: "var(--accent-iris)" }} />
            <h3>Belum ada sesi Choukai</h3>
            <p>
              Generate JSON soal listening di Claude.ai pakai prompt di{" "}
              <code className="upload-code">materi/PROMPT-CHOUKAI.md</code>, simpan ke{" "}
              <code className="upload-code">materi/import/</code>, lalu jalankan{" "}
              <code className="upload-code">npm run import</code>.
            </p>
          </div>
        ) : (
          <div className="ch-list-grid">
            {sessions.map(s => {
              const totalQ = s.ai_result?.questions?.length ?? s.total ?? 0;
              return (
                <Link key={s.id} href={`/choukai/${s.id}`} className="glass-card ch-list-card interactive">
                  <div className="ch-list-glyph">聴</div>
                  <div className="ch-list-body">
                    <div className="ch-list-meta">
                      <span className={`lv-tag lv-${s.level.toLowerCase()}`}>{s.level}</span>
                      <span className="ch-list-time"><Clock size={11} /> {relativeDate(s.created_at)}</span>
                    </div>
                    <h3 className="ch-list-title">{s.title || "Sesi Choukai"}</h3>
                    <div className="ch-list-foot">
                      <span>{totalQ} soal</span>
                      <ChevronRight size={14} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
