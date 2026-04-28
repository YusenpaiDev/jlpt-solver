"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sidebar, BottomNav } from "@/components/Sidebar";
import {
  Settings, Bell, ArrowUpRight,
  User, Target, Calendar, CreditCard, BellRing,
  Clock, BookMarked, Languages, Shield, Download,
  Trash2, ChevronRight, Check, AlertTriangle, Loader2, Camera,
} from "lucide-react";

const settingSections = [
  { id: "profil",      label: "Profil & Akun",       icon: User      },
  { id: "notifikasi",  label: "Notifikasi",           icon: BellRing  },
  { id: "belajar",     label: "Preferensi Belajar",  icon: BookMarked},
  { id: "tampilan",    label: "Tampilan",             icon: Settings  },
  { id: "privasi",     label: "Privasi & Data",       icon: Shield    },
];

export default function Pengaturan() {
  const [activeSection, setActiveSection] = useState("profil");

  /* Profil */
  const [nama,         setNama]         = useState("");
  const [email,        setEmail]        = useState("");
  const [targetLevel,  setTargetLevel]  = useState("N2");
  const [ujianDate,    setUjianDate]    = useState("");
  const [avatarUrl,       setAvatarUrl]       = useState<string | null>(null);
  const [avatarPreview,   setAvatarPreview]   = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loadingProfile,  setLoadingProfile]  = useState(true);
  const [saving,          setSaving]          = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Notifikasi */
  const [notifStreak,  setNotifStreak]  = useState(true);
  const [notifReview,  setNotifReview]  = useState(true);
  const [notifUpdate,  setNotifUpdate]  = useState(false);
  const [jamPengingat, setJamPengingat] = useState("20:00");

  /* Preferensi belajar */
  const [kategoriFokus, setKategoriFokus] = useState<string[]>(["文法", "語彙"]);
  const [jumlahSoal,    setJumlahSoal]    = useState(10);
  const [furigana,      setFurigana]      = useState(true);
  const [bahasaJelaskan, setBahasaJelaskan] = useState<"id" | "en">("id");

  /* Tampilan */
  const [fontSize, setFontSize] = useState<"kecil" | "sedang" | "besar">("sedang");

  /* Saved toast */
  const [saved, setSaved] = useState(false);
  function showSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  /* Load profile from Supabase */
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingProfile(false); return; }
      setEmail(user.email ?? "");
      const { data } = await supabase.from("profiles")
        .select("username,target_level,avatar_url")
        .eq("id", user.id).single();
      if (data) {
        setNama(data.username ?? "");
        setTargetLevel(data.target_level ?? "N2");
        setAvatarUrl(data.avatar_url ?? null);
      }
      setLoadingProfile(false);
    }
    load();
  }, []);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // local preview
    const reader = new FileReader();
    reader.onload = ev => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    // upload to supabase storage
    setUploadingAvatar(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (!error) {
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        const url = urlData.publicUrl + `?t=${Date.now()}`;
        setAvatarUrl(url);
        await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      }
    }
    setUploadingAvatar(false);
  }

  async function handleSaveProfil() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles")
        .update({ username: nama, target_level: targetLevel })
        .eq("id", user.id);
    }
    setSaving(false);
    showSaved();
  }

  const levels = ["N1","N2","N3","N4","N5"];
  const kategoris = ["文法","語彙","文字","読解"];

  function toggleKategori(k: string) {
    setKategoriFokus(prev =>
      prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden text-[#d7e2ff]"
      style={{ background: "#071327", fontFamily: "var(--font-manrope)" }}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 md:px-6 py-3 shrink-0 border-b"
        style={{ background: "#071327", borderColor: "rgba(255,255,255,0.04)" }}>
        <div className="flex items-center gap-4 md:gap-8">
          <a href="/" className="flex items-center gap-2">
            <div className="size-6 rounded-md flex items-center justify-center text-[10px] font-black text-[#071327]"
              style={{ background: "linear-gradient(135deg,#bbc6e2,#6b8cba)" }}>S</div>
            <span className="text-sm font-bold tracking-tight text-[#d7e2ff]"
              style={{ fontFamily: "var(--font-jakarta)" }}>Sensei JLPT</span>
          </a>
          <nav className="hidden md:flex items-center gap-0.5">
            {["Materi","Latihan","Pro"].map(item => (
              <button key={item}
                className="px-3 py-1.5 text-sm rounded-lg text-[#8a9bbf] hover:text-[#d7e2ff] hover:bg-white/5 transition-colors">
                {item}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <a href="/premium" className="hidden sm:flex text-[11px] px-4 py-1.5 rounded-full font-medium border transition-colors hover:bg-white/5"
            style={{ borderColor: "rgba(255,255,255,0.1)", color: "#bbc6e2", fontFamily: "var(--font-space)" }}>
            Langganan
          </a>
          <button className="relative size-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors">
            <Bell className="size-4 text-[#8a9bbf]" />
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-red-400 ring-2 ring-[#071327]" />
          </button>
          <div className="size-8 rounded-full flex items-center justify-center text-xs font-bold text-[#071327] ring-2 ring-[#2f4865]"
            style={{ background: "linear-gradient(135deg,#bbc6e2,#4a7abf)" }}>A</div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left Nav Sidebar ── */}
        <Sidebar activeHref="/pengaturan" />

        {/* ── Settings Layout ── */}
        <div className="flex flex-1 min-h-0">

          {/* Section nav */}
          <div className="hidden md:flex w-[200px] shrink-0 flex-col gap-1 py-6 px-3 border-r"
            style={{ background: "#0a1525", borderColor: "rgba(255,255,255,0.03)" }}>
            <p className="text-[9px] font-bold text-[#2a354b] px-3 mb-2"
              style={{ fontFamily: "var(--font-space)" }}>PENGATURAN</p>
            {settingSections.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveSection(id)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-all w-full"
                style={activeSection === id
                  ? { background: "rgba(74,122,191,0.12)", color: "#d7e2ff", boxShadow: "inset 2px 0 0 #4a7abf" }
                  : { color: "#8a9bbf" }}>
                <Icon className={`size-4 shrink-0 ${activeSection === id ? "text-[#6b9cda]" : "text-[#4a5a7a]"}`} />
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 md:px-10 py-6 md:py-8 pb-20 lg:pb-8 relative" style={{ background: "#071327" }}>
            <div className="pointer-events-none absolute top-0 left-1/3 w-[400px] h-[300px] opacity-[0.04] blur-[80px]"
              style={{ background: "radial-gradient(circle,#4a7abf,transparent 70%)" }} />

            <div className="relative max-w-2xl flex flex-col gap-6">

              {/* ── PROFIL ── */}
              {activeSection === "profil" && (
                <>
                  <div>
                    <h2 className="text-xl font-bold text-[#d7e2ff] mb-1"
                      style={{ fontFamily: "var(--font-jakarta)" }}>Profil & Akun</h2>
                    <p className="text-sm text-[#4a5a7a]">Informasi pribadi dan target belajar kamu.</p>
                  </div>

                  {/* Avatar + nama */}
                  <div className="p-6 rounded-2xl flex items-center gap-5"
                    style={{ background: "#101b30" }}>
                    {/* Hidden file input — accepts image from camera/gallery/file */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                    <div className="relative shrink-0 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      {(avatarPreview || avatarUrl) ? (
                        <img
                          src={avatarPreview ?? avatarUrl!}
                          alt="Avatar"
                          className="size-16 rounded-2xl object-cover ring-2 ring-[#2f4865]"
                        />
                      ) : (
                        <div className="size-16 rounded-2xl flex items-center justify-center text-2xl font-black text-[#071327] ring-2 ring-[#2f4865]"
                          style={{ background: "linear-gradient(135deg,#bbc6e2,#4a7abf)" }}>
                          {loadingProfile ? <Loader2 className="size-6 animate-spin text-[#071327]" /> : (nama[0]?.toUpperCase() || "?")}
                        </div>
                      )}
                      <div className="absolute inset-0 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "rgba(0,0,0,0.5)" }}>
                        {uploadingAvatar
                          ? <Loader2 className="size-5 text-white animate-spin" />
                          : <Camera className="size-5 text-white" />}
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#d7e2ff] mb-1">{loadingProfile ? "…" : (nama || "—")}</p>
                      <p className="text-xs text-[#4a5a7a] mb-3">{email}</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="text-[11px] px-3 py-1.5 rounded-lg font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                        style={{ background: "#1f2a3f", color: "#8a9bbf", fontFamily: "var(--font-space)" }}>
                        {uploadingAvatar ? "MENGUNGGAH..." : "GANTI FOTO"}
                      </button>
                    </div>
                  </div>

                  {/* Form */}
                  <div className="p-6 rounded-2xl flex flex-col gap-4" style={{ background: "#101b30" }}>
                    <Field label="NAMA" value={nama} onChange={setNama} />
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-[#4a5a7a]"
                        style={{ fontFamily: "var(--font-space)" }}>EMAIL</label>
                      <input readOnly value={email}
                        className="px-4 py-2.5 rounded-xl text-sm text-[#4a5a7a] outline-none cursor-not-allowed"
                        style={{ background: "#0a111e", border: "1px solid rgba(187,198,226,0.05)", fontFamily: "var(--font-manrope)" }} />
                      <p className="text-[10px] text-[#2a354b]">Email tidak bisa diubah dari sini.</p>
                    </div>
                  </div>

                  {/* Target level */}
                  <div className="p-6 rounded-2xl flex flex-col gap-4" style={{ background: "#101b30" }}>
                    <div>
                      <p className="text-xs font-bold text-[#bbc6e2] mb-1"
                        style={{ fontFamily: "var(--font-space)" }}>TARGET LEVEL</p>
                      <p className="text-[11px] text-[#4a5a7a]">Level JLPT yang sedang kamu persiapkan.</p>
                    </div>
                    <div className="flex gap-2">
                      {levels.map(l => (
                        <button key={l} onClick={() => setTargetLevel(l)}
                          className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                          style={targetLevel === l
                            ? { background: "linear-gradient(135deg,#1a3a6f,#2f5a9a)", color: "#d7e2ff", border: "1px solid rgba(107,156,218,0.4)" }
                            : { background: "#0d1929", color: "#4a5a7a", border: "1px solid rgba(255,255,255,0.04)" }}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tanggal ujian */}
                  <div className="p-6 rounded-2xl flex flex-col gap-3" style={{ background: "#101b30" }}>
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4 text-[#6b9cda]" />
                      <p className="text-xs font-bold text-[#bbc6e2]"
                        style={{ fontFamily: "var(--font-space)" }}>TANGGAL UJIAN JLPT</p>
                    </div>
                    <input type="date" value={ujianDate} onChange={e => setUjianDate(e.target.value)}
                      className="px-4 py-2.5 rounded-xl text-sm text-[#d7e2ff] outline-none"
                      style={{ background: "#0d1929", border: "1px solid rgba(187,198,226,0.08)", fontFamily: "var(--font-manrope)", colorScheme: "dark" }} />
                    {ujianDate && (
                      <p className="text-xs text-[#5ea87a]">
                        {Math.ceil((new Date(ujianDate).getTime() - Date.now()) / 86400000)} hari lagi menuju ujian
                      </p>
                    )}
                  </div>

                  {/* Langganan */}
                  <div className="p-6 rounded-2xl relative overflow-hidden"
                    style={{ background: "#101b30", border: "1px solid rgba(107,156,218,0.12)" }}>
                    <div className="absolute inset-0 opacity-10"
                      style={{ background: "radial-gradient(circle at top right,#4a7abf,transparent 60%)" }} />
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl flex items-center justify-center"
                          style={{ background: "rgba(107,156,218,0.15)" }}>
                          <CreditCard className="size-5 text-[#6b9cda]" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#d7e2ff]">Paket Gratis</p>
                          <p className="text-xs text-[#4a5a7a]">5 analisis tersisa bulan ini</p>
                        </div>
                      </div>
                      <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-[#071327] transition-all hover:brightness-110"
                        style={{ background: "linear-gradient(135deg,#bbc6e2,#6b8cba)", fontFamily: "var(--font-space)" }}>
                        UPGRADE <ArrowUpRight className="size-3" />
                      </button>
                    </div>
                  </div>

                  <SaveButton onSave={handleSaveProfil} saving={saving} />
                </>
              )}

              {/* ── NOTIFIKASI ── */}
              {activeSection === "notifikasi" && (
                <>
                  <div>
                    <h2 className="text-xl font-bold text-[#d7e2ff] mb-1"
                      style={{ fontFamily: "var(--font-jakarta)" }}>Notifikasi</h2>
                    <p className="text-sm text-[#4a5a7a]">Atur kapan dan apa yang ingin kamu terima.</p>
                  </div>

                  <div className="p-6 rounded-2xl flex flex-col gap-5" style={{ background: "#101b30" }}>
                    <Toggle
                      icon="🔥" label="Pengingat Streak"
                      desc="Notif harian kalau kamu belum latihan — biar streak-mu gak putus."
                      value={notifStreak} onChange={setNotifStreak} />
                    <div className="h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
                    <Toggle
                      icon="🗂️" label="Review Jadwal"
                      desc="Ingatkan kata-kata yang perlu diulang hari ini berdasarkan spaced repetition."
                      value={notifReview} onChange={setNotifReview} />
                    <div className="h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
                    <Toggle
                      icon="✨" label="Update Fitur & Promo"
                      desc="Info fitur baru, tips eksklusif, dan penawaran premium."
                      value={notifUpdate} onChange={setNotifUpdate} />
                  </div>

                  {/* Jam pengingat */}
                  <div className="p-6 rounded-2xl flex flex-col gap-3" style={{ background: "#101b30" }}>
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-[#6b9cda]" />
                      <p className="text-xs font-bold text-[#bbc6e2]"
                        style={{ fontFamily: "var(--font-space)" }}>JAM PENGINGAT HARIAN</p>
                    </div>
                    <p className="text-[11px] text-[#4a5a7a]">Notifikasi streak dan review akan dikirim pada jam ini.</p>
                    <input type="time" value={jamPengingat} onChange={e => setJamPengingat(e.target.value)}
                      className="px-4 py-2.5 rounded-xl text-sm text-[#d7e2ff] outline-none w-36"
                      style={{ background: "#0d1929", border: "1px solid rgba(187,198,226,0.08)", fontFamily: "var(--font-manrope)", colorScheme: "dark" }} />
                  </div>

                  <SaveButton onSave={showSaved} />
                </>
              )}

              {/* ── PREFERENSI BELAJAR ── */}
              {activeSection === "belajar" && (
                <>
                  <div>
                    <h2 className="text-xl font-bold text-[#d7e2ff] mb-1"
                      style={{ fontFamily: "var(--font-jakarta)" }}>Preferensi Belajar</h2>
                    <p className="text-sm text-[#4a5a7a]">Sesuaikan pengalaman belajar dengan gaya kamu.</p>
                  </div>

                  {/* Kategori fokus */}
                  <div className="p-6 rounded-2xl flex flex-col gap-4" style={{ background: "#101b30" }}>
                    <div>
                      <p className="text-xs font-bold text-[#bbc6e2] mb-1"
                        style={{ fontFamily: "var(--font-space)" }}>KATEGORI FOKUS</p>
                      <p className="text-[11px] text-[#4a5a7a]">Pilih kategori yang ingin diprioritaskan. Bisa lebih dari satu.</p>
                    </div>
                    <div className="flex gap-2">
                      {kategoris.map(k => {
                        const active = kategoriFokus.includes(k);
                        return (
                          <button key={k} onClick={() => toggleKategori(k)}
                            className="flex-1 py-3 rounded-xl text-sm font-black transition-all"
                            style={active
                              ? { background: "rgba(107,156,218,0.15)", color: "#6b9cda", border: "1px solid rgba(107,156,218,0.35)" }
                              : { background: "#0d1929", color: "#4a5a7a", border: "1px solid rgba(255,255,255,0.04)" }}>
                            {k}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Jumlah soal */}
                  <div className="p-6 rounded-2xl flex flex-col gap-4" style={{ background: "#101b30" }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-[#bbc6e2] mb-1"
                          style={{ fontFamily: "var(--font-space)" }}>JUMLAH SOAL PER SESI</p>
                        <p className="text-[11px] text-[#4a5a7a]">Berapa soal yang ingin dikerjakan tiap sesi latihan.</p>
                      </div>
                      <span className="text-2xl font-extrabold text-[#d7e2ff]"
                        style={{ fontFamily: "var(--font-jakarta)" }}>{jumlahSoal}</span>
                    </div>
                    <input type="range" min={5} max={30} step={5}
                      value={jumlahSoal} onChange={e => setJumlahSoal(Number(e.target.value))}
                      className="w-full accent-[#4a7abf]" />
                    <div className="flex justify-between text-[10px] text-[#2a354b]"
                      style={{ fontFamily: "var(--font-space)" }}>
                      {[5,10,15,20,25,30].map(v => <span key={v}>{v}</span>)}
                    </div>
                  </div>

                  {/* Furigana + Bahasa */}
                  <div className="p-6 rounded-2xl flex flex-col gap-5" style={{ background: "#101b30" }}>
                    <Toggle
                      icon="あ" label="Tampilkan Furigana"
                      desc="Tampilkan bacaan hiragana di atas kanji pada contoh kalimat."
                      value={furigana} onChange={setFurigana} />
                    <div className="h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Languages className="size-4 text-[#6b9cda]" />
                        <p className="text-sm font-semibold text-[#d7e2ff]">Bahasa Penjelasan</p>
                      </div>
                      <p className="text-[11px] text-[#4a5a7a] mb-3">Bahasa yang digunakan AI untuk menjelaskan soal.</p>
                      <div className="flex gap-2">
                        {[{v:"id",l:"🇮🇩 Indonesia"},{v:"en",l:"🇬🇧 English"}].map(({v,l}) => (
                          <button key={v} onClick={() => setBahasaJelaskan(v as "id"|"en")}
                            className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                            style={bahasaJelaskan === v
                              ? { background: "rgba(107,156,218,0.15)", color: "#6b9cda", border: "1px solid rgba(107,156,218,0.35)" }
                              : { background: "#0d1929", color: "#4a5a7a", border: "1px solid rgba(255,255,255,0.04)" }}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <SaveButton onSave={showSaved} />
                </>
              )}

              {/* ── TAMPILAN ── */}
              {activeSection === "tampilan" && (
                <>
                  <div>
                    <h2 className="text-xl font-bold text-[#d7e2ff] mb-1"
                      style={{ fontFamily: "var(--font-jakarta)" }}>Tampilan</h2>
                    <p className="text-sm text-[#4a5a7a]">Sesuaikan tampilan aplikasi.</p>
                  </div>

                  <div className="p-6 rounded-2xl flex flex-col gap-4" style={{ background: "#101b30" }}>
                    <div>
                      <p className="text-xs font-bold text-[#bbc6e2] mb-1"
                        style={{ fontFamily: "var(--font-space)" }}>UKURAN FONT</p>
                      <p className="text-[11px] text-[#4a5a7a] mb-4">Ukuran teks yang ditampilkan di seluruh aplikasi.</p>
                    </div>
                    <div className="flex gap-2">
                      {(["kecil","sedang","besar"] as const).map(f => (
                        <button key={f} onClick={() => setFontSize(f)}
                          className="flex-1 py-3 rounded-xl transition-all capitalize"
                          style={{
                            fontSize: f === "kecil" ? "11px" : f === "sedang" ? "13px" : "15px",
                            fontWeight: fontSize === f ? 700 : 400,
                            background: fontSize === f ? "rgba(107,156,218,0.12)" : "#0d1929",
                            color: fontSize === f ? "#6b9cda" : "#4a5a7a",
                            border: `1px solid ${fontSize === f ? "rgba(107,156,218,0.3)" : "rgba(255,255,255,0.04)"}`,
                          }}>
                          {f === "kecil" ? "Kecil" : f === "sedang" ? "Sedang" : "Besar"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tema */}
                  <div className="p-6 rounded-2xl" style={{ background: "#101b30" }}>
                    <p className="text-xs font-bold text-[#bbc6e2] mb-1"
                      style={{ fontFamily: "var(--font-space)" }}>TEMA</p>
                    <p className="text-[11px] text-[#4a5a7a] mb-4">Pilih tema warna aplikasi.</p>
                    <div className="flex gap-2">
                      {[
                        { id:"dark",  label:"Dark",  preview:"#071327" },
                        { id:"navy",  label:"Navy",  preview:"#0a1628" },
                        { id:"amoled",label:"AMOLED",preview:"#000000" },
                      ].map(t => (
                        <button key={t.id}
                          className="flex-1 flex flex-col items-center gap-2 py-3 rounded-xl transition-all"
                          style={t.id === "dark"
                            ? { background: "rgba(107,156,218,0.12)", border: "1px solid rgba(107,156,218,0.3)" }
                            : { background: "#0d1929", border: "1px solid rgba(255,255,255,0.04)" }}>
                          <div className="size-8 rounded-lg"
                            style={{ background: t.preview, outline: t.id === "dark" ? "2px solid #4a7abf" : "2px solid transparent" }} />
                          <span className="text-[11px]"
                            style={{ color: t.id === "dark" ? "#6b9cda" : "#4a5a7a", fontFamily: "var(--font-space)" }}>
                            {t.label}
                          </span>
                          {t.id === "dark" && <Check className="size-3 text-[#6b9cda]" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <SaveButton onSave={showSaved} />
                </>
              )}

              {/* ── PRIVASI & DATA ── */}
              {activeSection === "privasi" && (
                <>
                  <div>
                    <h2 className="text-xl font-bold text-[#d7e2ff] mb-1"
                      style={{ fontFamily: "var(--font-jakarta)" }}>Privasi & Data</h2>
                    <p className="text-sm text-[#4a5a7a]">Kelola data belajar dan akun kamu.</p>
                  </div>

                  <div className="p-6 rounded-2xl flex flex-col gap-4" style={{ background: "#101b30" }}>
                    <ActionRow
                      icon={<Download className="size-4 text-[#6b9cda]" />}
                      label="Export Data Belajar"
                      desc="Unduh seluruh riwayat soal, statistik, dan kata favorit dalam format JSON."
                      action="EXPORT" actionColor="#6b9cda" />
                    <div className="h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
                    <ActionRow
                      icon={<Target className="size-4 text-[#e07b4a]" />}
                      label="Reset Progress"
                      desc="Hapus semua statistik dan mulai dari awal. Riwayat soal tetap tersimpan."
                      action="RESET" actionColor="#e07b4a" />
                  </div>

                  {/* Hapus akun */}
                  <div className="p-6 rounded-2xl relative overflow-hidden"
                    style={{ background: "#101b30", border: "1px solid rgba(224,90,90,0.12)" }}>
                    <div className="absolute inset-0 opacity-5"
                      style={{ background: "radial-gradient(circle at bottom right,#e05a5a,transparent 60%)" }} />
                    <div className="relative flex items-start gap-4">
                      <div className="size-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "rgba(224,90,90,0.1)" }}>
                        <Trash2 className="size-4 text-[#e05a5a]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-[#d7e2ff] mb-1">Hapus Akun</p>
                        <p className="text-[11px] text-[#4a5a7a] leading-relaxed mb-4">
                          Akun dan seluruh datamu akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
                        </p>
                        <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110"
                          style={{ background: "rgba(224,90,90,0.12)", color: "#e05a5a", border: "1px solid rgba(224,90,90,0.2)", fontFamily: "var(--font-space)" }}>
                          <AlertTriangle className="size-3" /> HAPUS AKUN
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      </div>

      <BottomNav activeHref="/pengaturan" />

      {/* Saved toast */}
      {saved && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold shadow-xl"
          style={{ background: "#1f2a3f", color: "#5ea87a", border: "1px solid rgba(94,168,122,0.25)" }}>
          <Check className="size-4" /> Pengaturan disimpan
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────── */
function Field({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-[#4a5a7a]"
        style={{ fontFamily: "var(--font-space)" }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="px-4 py-2.5 rounded-xl text-sm text-[#d7e2ff] outline-none transition-all"
        style={{
          background: "#0d1929",
          border: "1px solid rgba(187,198,226,0.08)",
          fontFamily: "var(--font-manrope)",
        }}
        onFocus={e => e.currentTarget.style.borderColor = "rgba(107,156,218,0.4)"}
        onBlur={e => e.currentTarget.style.borderColor = "rgba(187,198,226,0.08)"}
      />
    </div>
  );
}

function Toggle({ icon, label, desc, value, onChange }: {
  icon: string; label: string; desc: string;
  value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-xl shrink-0">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-[#d7e2ff] mb-0.5">{label}</p>
        <p className="text-[11px] text-[#4a5a7a] leading-relaxed">{desc}</p>
      </div>
      <button onClick={() => onChange(!value)}
        className="shrink-0 w-11 h-6 rounded-full transition-all relative"
        style={{ background: value ? "#4a7abf" : "#1f2a3f" }}>
        <div className="absolute top-1 size-4 rounded-full transition-all"
          style={{ background: value ? "#d7e2ff" : "#4a5a7a", left: value ? "calc(100% - 20px)" : "4px" }} />
      </button>
    </div>
  );
}

function ActionRow({ icon, label, desc, action, actionColor }: {
  icon: React.ReactNode; label: string; desc: string; action: string; actionColor: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="size-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "rgba(187,198,226,0.06)" }}>{icon}</div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-[#d7e2ff] mb-0.5">{label}</p>
        <p className="text-[11px] text-[#4a5a7a] leading-relaxed">{desc}</p>
      </div>
      <button className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:brightness-110"
        style={{ background: `${actionColor}15`, color: actionColor, fontFamily: "var(--font-space)" }}>
        {action} <ChevronRight className="size-3" />
      </button>
    </div>
  );
}

function SaveButton({ onSave, saving = false }: { onSave: () => void; saving?: boolean }) {
  return (
    <button onClick={onSave} disabled={saving}
      className="self-start flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110 disabled:opacity-60"
      style={{ background: "linear-gradient(135deg,#1a3a6f,#2f5a9a)", color: "#d7e2ff", fontFamily: "var(--font-space)" }}>
      {saving
        ? <><Loader2 className="size-4 animate-spin" /> MENYIMPAN…</>
        : <><Check className="size-4" /> SIMPAN PERUBAHAN</>}
    </button>
  );
}

import type React from "react";
