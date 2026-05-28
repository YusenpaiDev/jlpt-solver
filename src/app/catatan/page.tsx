"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import {
  Search, NotebookPen, Folder, Tag as TagIcon, Plus, Trash2, Loader2, Check, Star,
  Bold, Italic, Heading2, Quote, Link as LinkIcon, Code, Wand2, Sparkles,
} from "lucide-react";

interface Catatan {
  id: string;
  judul: string;
  isi: string;
  source: string | null;
  created_at: string;
  updated_at: string;
}

type SortMode = "newest" | "alpha" | "star";

function relativeDate(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return `Hari ini · ${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
  if (days < 2) return "Kemarin";
  if (days < 7) return `${days} hari`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

export default function CatatanPage() {
  const [catatan, setCatatan] = useState<Catatan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ judul: "", isi: "" });
  const [isDirty, setIsDirty] = useState(false);
  const [addMode, setAddMode] = useState(false);

  /* UserBar */
  const [streak, setStreak] = useState(0);
  const [userInitial, setUserInitial] = useState("Y");

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserInitial((user.user_metadata?.full_name || user.email || "Y")[0].toUpperCase());

        const [profileRes, catatanRes] = await Promise.all([
          supabase.from("profiles").select("streak").eq("id", user.id).single(),
          supabase.from("catatan")
            .select("id, judul, isi, source, created_at, updated_at")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false }),
        ]);
        if (profileRes.data) setStreak(profileRes.data.streak ?? 0);
        const list = (catatanRes.data ?? []) as Catatan[];
        setCatatan(list);
        if (list.length > 0) {
          setSelected(list[0].id);
          setDraft({ judul: list[0].judul, isi: list[0].isi });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    let result = catatan;
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(c =>
        c.judul.toLowerCase().includes(q) ||
        c.isi.toLowerCase().includes(q)
      );
    }
    if (sort === "alpha") {
      result = [...result].sort((a, b) => a.judul.localeCompare(b.judul, "id"));
    }
    // 'newest' is default order; 'star' has no data — fall back to newest
    return result;
  }, [catatan, query, sort]);

  const detail = useMemo(
    () => catatan.find(c => c.id === selected) ?? null,
    [catatan, selected]
  );

  const select = (c: Catatan) => {
    if (addMode || (isDirty && selected !== c.id)) {
      if (!confirm("Catatan belum disimpan. Tetap pindah?")) return;
    }
    setSelected(c.id);
    setDraft({ judul: c.judul, isi: c.isi });
    setIsDirty(false);
    setAddMode(false);
  };

  const handleNew = () => {
    if (isDirty) {
      if (!confirm("Catatan belum disimpan. Tetap buat baru?")) return;
    }
    setAddMode(true);
    setSelected(null);
    setDraft({ judul: "", isi: "" });
    setIsDirty(false);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!draft.isi.trim() && !draft.judul.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const now = new Date().toISOString();

      if (addMode) {
        const { data, error } = await supabase.from("catatan").insert({
          user_id: user.id,
          judul: draft.judul.trim() || "Catatan baru",
          isi: draft.isi.trim(),
        }).select("id, judul, isi, source, created_at, updated_at").single();
        if (error) throw error;
        const newC = data as Catatan;
        setCatatan(prev => [newC, ...prev]);
        setSelected(newC.id);
        setDraft({ judul: newC.judul, isi: newC.isi });
        setAddMode(false);
        setIsDirty(false);
      } else if (selected) {
        await supabase.from("catatan").update({
          judul: draft.judul, isi: draft.isi, updated_at: now,
        }).eq("id", selected);
        setCatatan(prev => prev.map(c => c.id === selected
          ? { ...c, judul: draft.judul, isi: draft.isi, updated_at: now } : c));
        setIsDirty(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus catatan ini?")) return;
    setDeletingId(id);
    try {
      await createClient().from("catatan").delete().eq("id", id);
      setCatatan(prev => {
        const next = prev.filter(c => c.id !== id);
        if (selected === id) {
          const first = next[0];
          setSelected(first?.id ?? null);
          setDraft(first ? { judul: first.judul, isi: first.isi } : { judul: "", isi: "" });
          setIsDirty(false);
          setAddMode(false);
        }
        return next;
      });
    } finally {
      setDeletingId(null);
    }
  };

  const showEditor = addMode || detail !== null;
  const totalWords = catatan.reduce((sum, c) => sum + wordCount(c.isi), 0);

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

        <header className="ct-header">
          <div>
            <Breadcrumb items={[{ label: "Beranda", href: "/" }, { label: "Catatan" }]} />
            <h1 className="ct-title">
              Catatan <span className="ct-title-jp">メモ</span>
            </h1>
          </div>
          <div className="ct-header-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled
              title="Coming soon — saran AI berdasarkan catatan"
            >
              <Sparkles size={12} fill="currentColor" strokeWidth={1} /> Saran AI
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleNew}
            >
              <Plus size={14} strokeWidth={2.2} /> Catatan Baru
            </button>
          </div>
        </header>

        <div className="ct-workspace">
          {/* Sidebar: search + folders + tags + stats */}
          <aside className="ct-sidebar glass-card">
            <div className="ct-search">
              <Search size={13} strokeWidth={1.6} style={{ color: "var(--text-tertiary)" }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Cari catatan..."
              />
            </div>

            <div className="ct-sb-section">
              <div className="ct-sb-label">
                <Folder size={11} strokeWidth={1.8} /> Folder
              </div>
              <ul className="ct-folder-list">
                <li className="ct-folder-item on">
                  <NotebookPen size={13} strokeWidth={1.6} />
                  <span className="ct-folder-label">Semua</span>
                  <span className="ct-folder-count">{catatan.length}</span>
                </li>
              </ul>
            </div>

            <div className="ct-sb-section">
              <div className="ct-sb-label">
                <TagIcon size={11} strokeWidth={1.8} /> Tag
              </div>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", padding: "0 4px", margin: 0 }}>
                Tag belum tersedia.
              </p>
            </div>

            <div className="ct-sb-stats">
              <div className="ct-sb-stat-row">
                <span>Total kata</span>
                <strong>{totalWords.toLocaleString("id-ID")}</strong>
              </div>
              <div className="ct-sb-stat-row">
                <span>Update terakhir</span>
                <strong>{catatan[0] ? relativeDate(catatan[0].updated_at).split(" · ")[0] : "—"}</strong>
              </div>
            </div>
          </aside>

          {/* Notes list */}
          <section className="ct-list">
            <div className="ct-list-head">
              <div>
                <h3 className="ct-list-title">Semua Catatan</h3>
                <span className="ct-list-count">{filtered.length} catatan</span>
              </div>
              <div className="ct-list-sort">
                <button
                  type="button"
                  className={`sort-chip${sort === "newest" ? " on" : ""}`}
                  onClick={() => setSort("newest")}
                >Terbaru</button>
                <button
                  type="button"
                  className={`sort-chip${sort === "alpha" ? " on" : ""}`}
                  onClick={() => setSort("alpha")}
                >A–Z</button>
                <button
                  type="button"
                  className={`sort-chip${sort === "star" ? " on" : ""}`}
                  onClick={() => setSort("star")}
                  title="Belum ada bintang"
                  disabled
                >
                  <Star size={11} fill="currentColor" strokeWidth={1.2} />
                </button>
              </div>
            </div>

            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12.5 }}>
                {catatan.length === 0
                  ? "Belum ada catatan. Klik 'Catatan Baru' atau simpan dari Analisis Foto."
                  : "Tidak ada catatan cocok dengan pencarian."}
              </div>
            ) : (
              <ul className="ct-note-list">
                {filtered.map(c => {
                  const isActive = selected === c.id && !addMode;
                  return (
                    <li
                      key={c.id}
                      className={`ct-note-card${isActive ? " on" : ""}`}
                      onClick={() => select(c)}
                    >
                      <button
                        type="button"
                        className="ct-note-card-del"
                        title="Hapus"
                        disabled={deletingId === c.id}
                        onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                      >
                        {deletingId === c.id
                          ? <Loader2 size={11} className="animate-spin" />
                          : <Trash2 size={11} />}
                      </button>
                      <h4 className="ct-note-title">{c.judul || "Tanpa judul"}</h4>
                      <p className="ct-note-preview">{c.isi || "(kosong)"}</p>
                      <div className="ct-note-meta">
                        <span className="ct-note-date">{relativeDate(c.updated_at)}</span>
                        <span className="ct-note-words">{wordCount(c.isi)} kata</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Editor */}
          <main className="ct-editor glass-card">
            {showEditor ? (
              <>
                <div className="ed-head">
                  <div className="ed-meta">
                    <span className="ed-saved">
                      {isDirty ? (
                        <><Loader2 size={11} className="animate-spin" /> Belum tersimpan</>
                      ) : (
                        <><Check size={11} strokeWidth={2.4} style={{ color: "var(--accent-emerald)" }} /> Tersimpan</>
                      )}
                    </span>
                    {detail?.source && !addMode && (
                      <span style={{ fontSize: 10.5, color: "var(--text-tertiary)", padding: "2px 8px", background: "var(--surface-2)", borderRadius: 5 }}>
                        dari: {detail.source}
                      </span>
                    )}
                  </div>
                  <div className="ed-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleSave}
                      disabled={saving || (!isDirty && !addMode) || (!draft.judul.trim() && !draft.isi.trim())}
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={2.4} />}
                      {saving ? "Menyimpan..." : "Simpan"}
                    </button>
                    {detail && !addMode && (
                      <button
                        type="button"
                        className="ed-icon-btn danger"
                        title="Hapus"
                        onClick={() => handleDelete(detail.id)}
                        disabled={deletingId === detail.id}
                      >
                        {deletingId === detail.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    )}
                  </div>
                </div>

                <input
                  className="ed-title-input"
                  value={draft.judul}
                  onChange={e => { setDraft(d => ({ ...d, judul: e.target.value })); setIsDirty(true); }}
                  placeholder="Judul catatan..."
                />

                <div className="ed-toolbar">
                  <button type="button" className="ed-tool" disabled title="Heading (coming soon)">
                    <Heading2 size={13} strokeWidth={1.8} />
                  </button>
                  <button type="button" className="ed-tool" disabled title="Bold (coming soon)">
                    <Bold size={13} strokeWidth={1.8} />
                  </button>
                  <button type="button" className="ed-tool" disabled title="Italic (coming soon)">
                    <Italic size={13} strokeWidth={1.8} />
                  </button>
                  <button type="button" className="ed-tool" disabled title="Quote (coming soon)">
                    <Quote size={13} strokeWidth={1.8} />
                  </button>
                  <button type="button" className="ed-tool" disabled title="Link (coming soon)">
                    <LinkIcon size={13} strokeWidth={1.8} />
                  </button>
                  <button type="button" className="ed-tool" disabled title="Code (coming soon)">
                    <Code size={13} strokeWidth={1.8} />
                  </button>
                  <button type="button" className="ed-tool ed-ai" disabled title="Tanya Sensei (coming soon)">
                    <Wand2 size={12} strokeWidth={1.8} />
                    Tanya Sensei
                  </button>
                </div>

                <textarea
                  className="ed-body-textarea"
                  value={draft.isi}
                  onChange={e => { setDraft(d => ({ ...d, isi: e.target.value })); setIsDirty(true); }}
                  placeholder="Tulis catatanmu di sini..."
                />

                <div className="ed-footer">
                  <span>{wordCount(draft.isi)} kata · {Math.max(1, Math.round(wordCount(draft.isi) / 200))} menit baca</span>
                  <span>{detail ? `Diperbarui ${relativeDate(detail.updated_at)}` : "Belum disimpan"}</span>
                </div>
              </>
            ) : (
              <div className="ct-empty">
                <NotebookPen size={32} strokeWidth={1.4} style={{ color: "var(--text-tertiary)" }} />
                <p>{loading ? "Memuat catatan..." : "Pilih atau buat catatan baru"}</p>
                <button type="button" className="btn btn-primary" onClick={handleNew}>
                  <Plus size={14} strokeWidth={2.2} /> Catatan Baru
                </button>
              </div>
            )}
          </main>
        </div>
      </main>
    </>
  );
}
