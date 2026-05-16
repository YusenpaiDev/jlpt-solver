"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sidebar, BottomNav } from "@/components/Sidebar";
import AppHeader from "@/components/AppHeader";
import {
  Search, X, Plus, Trash2, Loader2, NotebookPen, Save,
} from "lucide-react";

interface Catatan {
  id: string;
  judul: string;
  isi: string;
  source: string | null;
  created_at: string;
  updated_at: string;
}

const ACCENTS = ["#4a7abf","#8b5abf","#5ea87a","#e07b4a","#c05abf","#6b9cda","#a67bd4","#4a9abf"];
const accentFor = (idx: number) => ACCENTS[idx % ACCENTS.length];

export default function CatatanPage() {
  const [catatan,    setCatatan]   = useState<Catatan[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [selected,   setSelected]  = useState<string | null>(null);
  const [query,      setQuery]     = useState("");
  const [deletingId, setDeletingId]= useState<string | null>(null);
  const [saving,     setSaving]    = useState(false);
  const [draft,      setDraft]     = useState({ judul: "", isi: "" });
  const [addOpen,    setAddOpen]   = useState(false);
  const [isDirty,    setIsDirty]   = useState(false);

  /* ── Load ── */
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("catatan")
          .select("id, judul, isi, source, created_at, updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });
        const list = (data ?? []) as Catatan[];
        setCatatan(list);
        if (list.length > 0) {
          setSelected(list[0].id);
          setDraft({ judul: list[0].judul, isi: list[0].isi });
        }
      } finally { setLoading(false); }
    })();
  }, []);

  /* ── Select ── */
  const select = (c: Catatan) => {
    setSelected(c.id);
    setDraft({ judul: c.judul, isi: c.isi });
    setIsDirty(false);
    setAddOpen(false);
  };

  /* ── Save existing ── */
  const save = async () => {
    if (!selected || !isDirty || saving) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const now = new Date().toISOString();
      await supabase.from("catatan")
        .update({ judul: draft.judul, isi: draft.isi, updated_at: now })
        .eq("id", selected);
      setCatatan(prev => prev.map(c => c.id === selected
        ? { ...c, judul: draft.judul, isi: draft.isi, updated_at: now } : c));
      setIsDirty(false);
    } finally { setSaving(false); }
  };

  /* ── Add new ── */
  const addNew = async () => {
    if (!draft.isi.trim() || saving) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
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
      setAddOpen(false);
      setIsDirty(false);
    } finally { setSaving(false); }
  };

  /* ── Delete ── */
  const del = async (id: string) => {
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
        }
        return next;
      });
    } finally { setDeletingId(null); }
  };

  const filtered = useMemo(() => catatan.filter(c => {
    const q = query.toLowerCase();
    return !q || c.judul.toLowerCase().includes(q) || c.isi.toLowerCase().includes(q);
  }), [catatan, query]);

  const detail = catatan.find(c => c.id === selected) ?? null;

  return (
    <div className="flex flex-col h-screen overflow-hidden text-[#d7e2ff]" style={{ fontFamily: "var(--font-manrope)" }}>
      <AppHeader activeHref="/catatan" />
      <div className="flex flex-1 min-h-0">
        <Sidebar activeHref="/catatan" />

        <div className="flex flex-1 min-h-0">

          {/* ── Left: list ── (full width on mobile when no note open) */}
          <div className={`w-full md:w-[320px] shrink-0 flex flex-col md:border-r ${(selected || addOpen) ? "hidden md:flex" : "flex"}`}
            style={{ background: "#0a1525", borderColor: "rgba(255,255,255,0.03)" }}>

            {/* Search */}
            <div className="p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#4a5a7a]" />
                <input value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Cari catatan..."
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm text-[#d7e2ff] placeholder-[#2a354b] outline-none"
                  style={{ background: "#101b30", border: "1px solid rgba(187,198,226,0.08)" }}
                  onFocus={e => e.currentTarget.style.borderColor = "rgba(107,156,218,0.4)"}
                  onBlur={e  => e.currentTarget.style.borderColor = "rgba(187,198,226,0.08)"}
                />
                {query && <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="size-3.5 text-[#4a5a7a]" /></button>}
              </div>
            </div>

            {/* Count + Add */}
            <div className="px-4 py-2 border-b flex items-center justify-between"
              style={{ borderColor: "rgba(255,255,255,0.03)" }}>
              <span className="text-xs font-semibold text-[#8a9bbf]" style={{ fontFamily: "var(--font-space)" }}>
                {loading ? "Memuat…" : `${filtered.length} catatan`}
              </span>
              <button onClick={() => { setAddOpen(true); setDraft({ judul: "", isi: "" }); setSelected(null); setIsDirty(false); }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold hover:brightness-110 transition-all"
                style={{ background: "rgba(94,168,122,0.15)", color: "#5ea87a", fontFamily: "var(--font-space)" }}>
                <Plus className="size-3" /> BARU
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto pb-16 lg:pb-0">
              {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="size-5 text-[#4a5a7a] animate-spin" /></div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3 px-4 text-center">
                  <NotebookPen className="size-8 text-[#2a354b]" />
                  <p className="text-xs text-[#4a5a7a]">
                    {catatan.length === 0 ? "Belum ada catatan.\nBuat catatan dari lembar jawab!" : "Tidak ada hasil pencarian."}
                  </p>
                </div>
              ) : filtered.map((c, idx) => {
                const ac = accentFor(idx);
                const isActive = selected === c.id && !addOpen;
                return (
                  <button key={c.id} onClick={() => select(c)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left border-b hover:bg-white/[0.02] transition-all group"
                    style={{ borderColor: "rgba(255,255,255,0.03)", background: isActive ? "rgba(74,122,191,0.08)" : "transparent", boxShadow: isActive ? "inset 2px 0 0 #4a7abf" : "none" }}>
                    <div className="size-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: `${ac}15`, color: ac }}>
                      <NotebookPen className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#d7e2ff] truncate mb-0.5"
                        style={{ fontFamily: "var(--font-jakarta)" }}>{c.judul || "Tanpa judul"}</p>
                      <p className="text-[11px] text-[#4a5a7a] truncate">{c.isi}</p>
                      <p className="text-[10px] text-[#2a354b] mt-1">
                        {new Date(c.updated_at).toLocaleDateString("id-ID", { day:"numeric", month:"short" })}
                      </p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); del(c.id); }} disabled={deletingId === c.id}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:opacity-100 hover:bg-red-500/10 disabled:opacity-40 shrink-0 transition-all">
                      {deletingId === c.id ? <Loader2 className="size-3 text-[#4a5a7a] animate-spin" /> : <Trash2 className="size-3 text-[#dc5050]" />}
                    </button>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Right: editor ── (hidden on mobile when nothing selected) */}
          <div className={`flex-1 flex flex-col min-h-0 ${(!selected && !addOpen) ? "hidden md:flex" : "flex"}`}>
            {addOpen || (detail && !addOpen) ? (
              <>
                {/* Toolbar */}
                <div className="px-4 md:px-10 py-3 border-b flex items-center justify-between shrink-0"
                  style={{ borderColor: "rgba(255,255,255,0.04)", background: "rgba(8,16,36,0.5)" }}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setSelected(null); setAddOpen(false); setIsDirty(false); }}
                      className="md:hidden p-1 -ml-1 rounded-lg hover:bg-white/5 text-[#8a9bbf]" aria-label="Kembali">
                      <X className="size-4" />
                    </button>
                    <NotebookPen className="size-4 text-[#a67bd4]" />
                    <span className="text-xs text-[#4a5a7a]" style={{ fontFamily: "var(--font-space)" }}>
                      {addOpen ? "CATATAN BARU" : detail ? new Date(detail.updated_at).toLocaleDateString("id-ID", { weekday:"long", day:"numeric", month:"long" }) : ""}
                    </span>
                    {detail?.source && !addOpen && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#1f2a3f", color: "#4a5a7a", fontFamily: "var(--font-space)" }}>
                        dari: {detail.source}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!addOpen && detail && (
                      <button
                        onClick={() => del(detail.id)}
                        disabled={deletingId === detail.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all disabled:opacity-40 hover:brightness-110"
                        style={{ background: "rgba(220,80,80,0.15)", color: "#dc5050", fontFamily: "var(--font-space)" }}>
                        {deletingId === detail.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                        {deletingId === detail.id ? "HAPUS…" : "HAPUS"}
                      </button>
                    )}
                    <button
                      onClick={addOpen ? addNew : save}
                      disabled={addOpen ? !draft.isi.trim() || saving : !isDirty || saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all disabled:opacity-40 hover:brightness-110"
                      style={{ background: "rgba(94,168,122,0.2)", color: "#5ea87a", fontFamily: "var(--font-space)" }}>
                      {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                      {saving ? "MENYIMPAN…" : "SIMPAN"}
                    </button>
                  </div>
                </div>

                {/* Editor */}
                <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 flex flex-col gap-4">
                  <input
                    value={draft.judul}
                    onChange={e => { setDraft(d => ({ ...d, judul: e.target.value })); setIsDirty(true); }}
                    placeholder="Judul catatan..."
                    className="w-full text-2xl font-extrabold text-[#d7e2ff] placeholder-[#2a354b] bg-transparent outline-none border-b pb-3"
                    style={{ borderColor: "rgba(255,255,255,0.06)", fontFamily: "var(--font-jakarta)" }}
                  />
                  <textarea
                    value={draft.isi}
                    onChange={e => { setDraft(d => ({ ...d, isi: e.target.value })); setIsDirty(true); }}
                    placeholder="Tulis catatanmu di sini..."
                    className="flex-1 w-full text-sm text-[#bbc6e2] placeholder-[#2a354b] bg-transparent outline-none resize-none leading-relaxed"
                    style={{ fontFamily: "var(--font-manrope)", minHeight: "400px" }}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
                <NotebookPen className="size-12 text-[#4a5a7a]" />
                <p className="text-sm text-[#4a5a7a]">{loading ? "Memuat catatan…" : "Pilih atau buat catatan baru"}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <BottomNav activeHref="/catatan" />
    </div>
  );
}
