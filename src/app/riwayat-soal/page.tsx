"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import {
  Search, BarChart3, Clock, Star, ChevronRight, History, Camera, Trash2, Loader2, RefreshCw,
} from "lucide-react";

type Level = "N1" | "N2" | "N3" | "N4" | "N5";
type LevelFilter = Level | "Semua";
type KategoriFilter = "Semua" | "文法" | "語彙" | "読解" | "聴解" | "文字";
type PeriodFilter = "Semua waktu" | "Hari ini" | "Minggu ini" | "Bulan ini";

interface Session {
  id: string;
  level: Level;
  category: string;
  title: string;
  total: number;
  score: number | null;
  created_at: string;
  section?: string | null; // ai_result->section — buat deteksi choukai
  kind?: string | null;    // ai_result->kind — "materi" = bank soal, sembunyiin kalau belum dikerjain
}

const KATEGORI_LABEL: Record<string, string> = {
  "文法": "Bunpou",
  "語彙": "Goi",
  "読解": "Dokkai",
  "聴解": "Choukai",
  "文字": "Moji",
};

const CATEGORY_GLYPH: Record<string, string> = {
  "文法": "文",
  "語彙": "語",
  "読解": "読",
  "聴解": "聴",
  "文字": "字",
  "AI": "全",
};

const LEVEL_OPTS: LevelFilter[] = ["Semua", "N1", "N2", "N3", "N4", "N5"];
const KATEGORI_OPTS: KategoriFilter[] = ["Semua", "文法", "語彙", "読解", "聴解", "文字"];
const PERIODE_OPTS: PeriodFilter[] = ["Semua waktu", "Hari ini", "Minggu ini", "Bulan ini"];

const GROUP_ORDER = ["Hari ini", "Kemarin", "Minggu ini", "Lebih lama"] as const;
type Group = typeof GROUP_ORDER[number];

function dayGroup(iso: string): Group {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "Hari ini";
  if (days < 2) return "Kemarin";
  if (days < 7) return "Minggu ini";
  return "Lebih lama";
}

function relativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "Hari ini";
  if (days < 2) return "Kemarin";
  if (days < 7) return `${days} hari`;
  if (days < 30) return `${Math.floor(days / 7)} minggu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function timeStr(iso: string): string {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function inPeriod(iso: string, p: PeriodFilter): boolean {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  switch (p) {
    case "Hari ini":   return days < 1;
    case "Minggu ini": return days < 7;
    case "Bulan ini":  return days < 30;
    default:           return true;
  }
}

export default function RiwayatSoal() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [userInitial, setUserInitial] = useState("Y");
  const [query, setQuery] = useState("");
  const [levelF, setLevelF] = useState<LevelFilter>("Semua");
  const [kategoriF, setKategoriF] = useState<KategoriFilter>("Semua");
  const [periodF, setPeriodF] = useState<PeriodFilter>("Semua waktu");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const xp = 820;
  const xpTarget = 1000;

  const fetchAll = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFetchError("Kamu perlu login untuk melihat riwayat.");
        return;
      }
      setUserInitial((user.user_metadata?.full_name || user.email || "Y")[0].toUpperCase());

      const [profileRes, sessionRes] = await Promise.all([
        supabase.from("profiles").select("streak").eq("id", user.id).single(),
        supabase.from("sessions")
          .select("id, level, category, title, total, score, created_at, ai_result->section, ai_result->kind")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);
      if (profileRes.data) setStreak(profileRes.data.streak ?? 0);
      if (sessionRes.error) throw sessionRes.error;
      // Choukai punya halaman sendiri (🎧) — jangan ikut tampil di Riwayat.
      // Sembunyiin choukai (punya halaman sendiri) + bank soal (kind:"materi")
      // yang BELUM dikerjain. Materi yang udah ada skornya tetap muncul di sini.
      const rows = ((sessionRes.data ?? []) as Session[]).filter(
        s => s.section !== "choukai" && !(s.kind === "materi" && s.score == null)
      );
      setSessions(rows);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Gagal memuat riwayat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const deleteSession = async (id: string) => {
    setDeletingId(id);
    try {
      const supabase = createClient();
      await supabase.from("sessions").delete().eq("id", id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const deleteAll = async () => {
    if (!confirm("Hapus semua riwayat? Tindakan ini tidak bisa dibatalkan.")) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("sessions").delete().eq("user_id", user.id);
    setSessions([]);
  };

  const resetFilters = () => {
    setLevelF("Semua"); setKategoriF("Semua"); setPeriodF("Semua waktu"); setQuery("");
  };

  /* Stats */
  const totalSessions = sessions.length;
  const totalSoal = sessions.reduce((sum, s) => sum + (s.total ?? 0), 0);
  const scoredSessions = sessions.filter(s => s.score != null && s.total > 0);
  const avgAccuracy = scoredSessions.length > 0
    ? Math.round(scoredSessions.reduce((sum, s) => sum + (s.score! / s.total) * 100, 0) / scoredSessions.length)
    : null;

  /* Akurasi per kategori (for sidebar) */
  const catAccuracy = useMemo(() => {
    const byCat: Record<string, { sum: number; count: number }> = {};
    scoredSessions.forEach(s => {
      const k = s.category;
      byCat[k] ||= { sum: 0, count: 0 };
      byCat[k].sum += (s.score! / s.total) * 100;
      byCat[k].count += 1;
    });
    return KATEGORI_OPTS.slice(1).map(k => {
      const data = byCat[k];
      return {
        jp: k as string,
        label: KATEGORI_LABEL[k] ?? "",
        pct: data ? Math.round(data.sum / data.count) : 0,
        present: !!data,
      };
    });
  }, [scoredSessions]);

  /* Activity heatmap: last 12 weeks × 7 days */
  const activityGrid = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDay = today.getDay(); // current week column
    const counts = new Map<string, number>();
    sessions.forEach(s => {
      const d = new Date(s.created_at);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const weeks: number[][] = [];
    for (let w = 0; w < 12; w++) {
      const col: number[] = [];
      for (let d = 0; d < 7; d++) {
        const daysAgo = (11 - w) * 7 + ((6 - d) - startDay + 7) % 7;
        const day = new Date(today);
        day.setDate(today.getDate() - daysAgo);
        const key = day.toISOString().slice(0, 10);
        const n = counts.get(key) ?? 0;
        const level = n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n === 3 ? 3 : 4;
        col.push(level);
      }
      weeks.push(col);
    }
    return weeks;
  }, [sessions]);

  /* Filter + group */
  const filtered = sessions.filter(s => {
    if (levelF !== "Semua" && s.level !== levelF) return false;
    if (kategoriF !== "Semua" && s.category !== kategoriF) return false;
    if (!inPeriod(s.created_at, periodF)) return false;
    if (query && !s.title.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const grouped = useMemo(() => {
    const g: Record<Group, Session[]> = { "Hari ini": [], "Kemarin": [], "Minggu ini": [], "Lebih lama": [] };
    filtered.forEach(s => g[dayGroup(s.created_at)].push(s));
    return g;
  }, [filtered]);

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

        <header className="rs-header">
          <div>
            <Breadcrumb items={[{ label: "Beranda", href: "/" }, { label: "Riwayat Soal" }]} />
            <h1 className="rs-title">
              Riwayat Soal <span className="rs-title-jp">履歴</span>
            </h1>
            <p className="rs-sub">
              Tiap sesi <Link href="/analisis-foto">Analisis Foto</Link> otomatis tersimpan di sini.
              Klik kartu buat buka kembali soal &amp; pembahasan.
            </p>
          </div>
          <div className="rs-stats">
            <div className="glass-card rs-stat">
              <div className="rs-stat-label">Total sesi</div>
              <div className="rs-stat-value">{loading ? "—" : totalSessions}</div>
            </div>
            <div className="glass-card rs-stat rs-stat-emerald">
              <div className="rs-stat-label">Akurasi rata-rata</div>
              <div className="rs-stat-value">{loading ? "—" : avgAccuracy != null ? `${avgAccuracy}%` : "—"}</div>
            </div>
            <div className="glass-card rs-stat">
              <div className="rs-stat-label">Soal dijawab</div>
              <div className="rs-stat-value">{loading ? "—" : totalSoal.toLocaleString("id-ID")}</div>
            </div>
          </div>
        </header>

        <div className="rs-toolbar">
          <div className="glass-card rs-search">
            <Search size={14} strokeWidth={1.6} style={{ color: "var(--text-tertiary)" }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Cari sesi · label, kanji, atau tanggal..."
            />
            <kbd>⌘K</kbd>
          </div>

          <div className="rs-filter-row">
            <FilterGroup
              label="Level"
              options={LEVEL_OPTS}
              value={levelF}
              onChange={setLevelF}
              accentByLevel
            />
            <FilterGroup
              label="Kategori"
              options={KATEGORI_OPTS}
              value={kategoriF}
              onChange={setKategoriF}
            />
            <FilterGroup
              label="Periode"
              options={PERIODE_OPTS}
              value={periodF}
              onChange={setPeriodF}
            />
            <div className="rs-filter-actions">
              <button type="button" className="reset-link" onClick={resetFilters}>Reset filter</button>
              <button
                type="button"
                onClick={fetchAll}
                className="reset-link"
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                title="Refresh data"
              >
                <RefreshCw size={11} /> Refresh
              </button>
              {sessions.length > 0 && (
                <button
                  type="button"
                  onClick={deleteAll}
                  className="reset-link"
                  style={{ color: "var(--accent-rose)", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <Trash2 size={11} /> Hapus semua
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="rs-workspace">
          <main className="rs-main">
            {loading && (
              <div className="empty-state glass-card">
                <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent-iris)" }} />
                <p>Memuat riwayat...</p>
              </div>
            )}

            {!loading && fetchError && (
              <div className="empty-state glass-card">
                <h3 style={{ color: "var(--accent-rose)" }}>⚠️ {fetchError}</h3>
                <button type="button" onClick={fetchAll} className="btn btn-secondary btn-sm">
                  Coba lagi
                </button>
              </div>
            )}

            {!loading && !fetchError && filtered.length === 0 && (
              <div className="empty-state glass-card">
                <History size={32} strokeWidth={1.2} style={{ color: "var(--text-tertiary)" }} />
                <h3>{sessions.length === 0 ? "Belum ada sesi" : "Tidak ada sesi yang cocok"}</h3>
                <p>
                  {sessions.length === 0
                    ? "Upload foto soal JLPT untuk memulai — sesi tersimpan otomatis di sini."
                    : "Coba ubah filter di atas — atau mulai sesi baru dari Analisis Foto."}
                </p>
                <Link href="/analisis-foto" className="btn btn-primary">
                  <Camera size={14} /> Buka Analisis Foto
                </Link>
              </div>
            )}

            {!loading && !fetchError && filtered.length > 0 && GROUP_ORDER.map(g => {
              const items = grouped[g];
              if (!items?.length) return null;
              return (
                <section key={g} className="rs-group">
                  <div className="rs-group-head">
                    <span className="rs-group-label">{g}</span>
                    <span className="rs-group-count">{items.length} sesi</span>
                    <div className="rs-group-line" />
                  </div>
                  <div className="rs-cards">
                    {items.map(s => (
                      <SessionCard
                        key={s.id}
                        s={s}
                        onDelete={() => deleteSession(s.id)}
                        deleting={deletingId === s.id}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </main>

          <aside className="rs-side">
            <div className="glass-card rs-side-card glow-emerald">
              <div className="rs-side-head">
                <BarChart3 size={13} strokeWidth={1.8} style={{ color: "var(--accent-emerald)" }} />
                Akurasi per Kategori
              </div>
              <div className="cat-bars">
                {catAccuracy.map(c => {
                  const color = c.pct >= 80 ? "emerald" : c.pct >= 65 ? "amber" : c.pct > 0 ? "rose" : "iris";
                  return (
                    <div className="cat-bar-row" key={c.jp}>
                      <div className="cat-bar-label">
                        <span className="cat-jp">{c.jp}</span>
                        <span className="cat-ro">{c.label}</span>
                      </div>
                      <div className="cat-bar-track">
                        {c.present && (
                          <div className={`cat-bar-fill cat-${color}`} style={{ width: `${c.pct}%` }} />
                        )}
                      </div>
                      <span className={`cat-bar-pct cat-pct-${color}`}>
                        {c.present ? `${c.pct}%` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass-card rs-side-card">
              <div className="rs-side-head">
                <Clock size={13} strokeWidth={1.8} style={{ color: "var(--accent-iris)" }} />
                Aktivitas Mingguan
              </div>
              <div className="activity-grid">
                {activityGrid.map((col, ci) => (
                  <div className="ag-col" key={ci}>
                    {col.map((lv, di) => <span key={di} className={`ag-cell lg-${lv}`} />)}
                  </div>
                ))}
              </div>
              <div className="grid-legend">
                <span>Lebih sedikit</span>
                <div className="legend-dots">
                  {[0, 1, 2, 3, 4].map(i => <span key={i} className={`legend-dot lg-${i}`} />)}
                </div>
                <span>Lebih banyak</span>
              </div>
            </div>

            <div className="glass-card rs-side-card">
              <div className="rs-side-head">
                <Star size={13} strokeWidth={1.8} fill="var(--accent-amber)" style={{ color: "var(--accent-amber)" }} />
                Soal Dibintangi
              </div>
              <p className="starred-empty">
                Belum ada soal yang dibintangi.
                <br />
                Tandai soal favorit di halaman Analisis Foto.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

/* ─── Subcomponents ─── */

function FilterGroup<T extends string>({
  label, options, value, onChange, accentByLevel,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  accentByLevel?: boolean;
}) {
  return (
    <div className="filter-group">
      <span className="fg-label">{label}</span>
      <div className="fg-chips">
        {options.map(opt => {
          const active = value === opt;
          const lvCls = accentByLevel && /^N[1-5]$/.test(opt) ? `fg-chip-${opt.toLowerCase()}` : "";
          return (
            <button
              key={opt}
              type="button"
              className={`fg-chip ${active ? "on" : ""} ${lvCls}`}
              onClick={() => onChange(opt)}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SessionCard({
  s, onDelete, deleting,
}: { s: Session; onDelete: () => void; deleting: boolean }) {
  const pct = s.score != null && s.total > 0 ? Math.round((s.score / s.total) * 100) : null;
  const tone: "good" | "mid" | "bad" | "none" =
    pct == null ? "none"
    : pct >= 85 ? "good"
    : pct >= 65 ? "mid"
    : "bad";
  const kategoriRo = KATEGORI_LABEL[s.category] ?? "";
  const isChoukai = s.section === "choukai";
  const glyph = isChoukai ? "聴" : (CATEGORY_GLYPH[s.category] ?? "全");
  const href = isChoukai ? `/choukai/${s.id}` : `/analisis-foto?session=${s.id}`;
  const lvLower = s.level.toLowerCase();

  return (
    <Link href={href} className={`glass-card rs-card rs-card-${tone}`}>
      <div>
        <div className={`rs-glyph rs-glyph-${tone}`}>{glyph}</div>
      </div>

      <div className="rs-card-main">
        <div className="rs-tags">
          <span className={`lv-tag-mini lv-${lvLower}`}>{s.level}</span>
          {kategoriRo && (
            <span className="rs-kategori">
              <span className="rs-kategori-jp">{s.category}</span>
              <span className="rs-kategori-ro">{kategoriRo}</span>
            </span>
          )}
        </div>
        <h3 className="rs-card-title">{s.title}</h3>
        <div className="rs-meta">
          <span className="rs-meta-item">
            <Clock size={10} strokeWidth={1.8} style={{ color: "var(--text-tertiary)" }} />
            {relativeDate(s.created_at)} · {timeStr(s.created_at)}
          </span>
          <span className="rs-meta-item">
            <span className="rs-meta-dot" />
            {s.total} soal
          </span>
        </div>
      </div>

      <div className="rs-card-score">
        {pct != null ? (
          <>
            <ScoreRing accuracy={pct} tone={tone === "none" ? "mid" : tone} />
            <div className="rs-score-meta">
              <div className="rs-score-fraction">
                <strong>{s.score}</strong>
                <span>/ {s.total}</span>
              </div>
              <div className="rs-score-label">benar</div>
            </div>
          </>
        ) : (
          <div className="rs-score-meta">
            <div className="rs-score-fraction" style={{ color: "var(--accent-emerald)" }}>
              <Clock size={18} strokeWidth={2} />
            </div>
            <div className="rs-score-label">dikerjain</div>
          </div>
        )}
      </div>

      <button type="button" className="rs-card-cta" aria-label="Buka sesi">
        <ChevronRight size={14} strokeWidth={2} />
      </button>

      <button
        type="button"
        className="rs-card-del"
        aria-label="Hapus sesi"
        title="Hapus sesi ini"
        disabled={deleting}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
      >
        {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
      </button>
    </Link>
  );
}

function ScoreRing({ accuracy, tone }: { accuracy: number; tone: "good" | "mid" | "bad" }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const offset = c - (accuracy / 100) * c;
  const color =
    tone === "good" ? "var(--accent-emerald)"
    : tone === "mid" ? "var(--accent-amber)"
    : "var(--accent-rose)";
  return (
    <div className="rs-ring">
      <svg width="60" height="60" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r={r} stroke="var(--surface-2)" strokeWidth="4" fill="none" />
        <circle
          cx="30" cy="30" r={r}
          stroke={color} strokeWidth="4" fill="none"
          strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 30 30)"
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke-dashoffset 600ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <span className="rs-ring-pct" style={{ color }}>
        {accuracy}<span className="rs-ring-pct-sym">%</span>
      </span>
    </div>
  );
}
