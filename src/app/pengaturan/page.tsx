"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import {
  User, Zap, Wand2, Bell, CreditCard, Shield, Trash2, ChevronRight, Camera, Check, Sparkles, X,
} from "lucide-react";
import { useUserStats } from "@/lib/use-user-stats";

type Level = "N1" | "N2" | "N3" | "N4" | "N5";

const SECTIONS = [
  { id: "profile",  label: "Profil",         Icon: User },
  { id: "target",   label: "Target Belajar", Icon: Zap },
  { id: "ai",       label: "Preferensi AI",  Icon: Wand2 },
  { id: "notif",    label: "Notifikasi",     Icon: Bell },
  { id: "sub",      label: "Langganan",      Icon: CreditCard },
  { id: "privacy",  label: "Privasi & Data", Icon: Shield },
  { id: "danger",   label: "Danger Zone",    Icon: Trash2, danger: true },
] as const;

type SectionId = typeof SECTIONS[number]["id"];

export default function Pengaturan() {
  const [active, setActive] = useState<SectionId>("profile");
  const [streak, setStreak] = useState(0);
  const [userInitial, setUserInitial] = useState("Y");
  const stats = useUserStats();
  const xp = stats.xp;
  const xpTarget = stats.xpTarget;

  /* Profile */
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [bahasaUi, setBahasaUi] = useState("Bahasa Indonesia");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  /* Target */
  const [targetLevel, setTargetLevel] = useState<Level>("N2");
  const [ujianDate, setUjianDate] = useState("");
  const [waktuPerHari, setWaktuPerHari] = useState(30);
  const [kategoriFokus, setKategoriFokus] = useState<string[]>(["文法", "語彙", "読解"]);

  /* AI prefs */
  const [aiStyle, setAiStyle] = useState<"concise" | "balanced" | "detailed">("balanced");
  const [aiLang, setAiLang] = useState<"id" | "id-jp" | "jp">("id-jp");
  const [autoExtract, setAutoExtract] = useState(true);
  const [furiganaMode, setFuriganaMode] = useState<"all" | "level" | "off">("all");

  /* Notif */
  const [notifDaily, setNotifDaily] = useState(true);
  const [notifStreak, setNotifStreak] = useState(true);
  const [notifMateri, setNotifMateri] = useState(false);
  const [notifWeekly, setNotifWeekly] = useState(true);
  const [notifPush, setNotifPush] = useState(false);

  /* Privacy */
  const [privLeaderboard, setPrivLeaderboard] = useState(false);
  const [privShareFriends, setPrivShareFriends] = useState(true);
  const [privAiTraining, setPrivAiTraining] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function showSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }
  function showError(msg: string) {
    setErrMsg(msg);
    setTimeout(() => setErrMsg(null), 4000);
  }

  /* Load profile */
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserInitial((user.user_metadata?.full_name || user.email || "Y")[0].toUpperCase());
      setEmail(user.email ?? "");
      const { data: profile } = await supabase.from("profiles")
        .select("username, target_level, avatar_url, streak")
        .eq("id", user.id)
        .single();
      if (profile) {
        setNama(profile.username ?? "");
        // Jangan jatuh ke level tertentu — kalau kolomnya kosong, biarin
        // user_metadata di bawah yang nentuin (itu sumber sebenarnya).
        if (profile.target_level) setTargetLevel(profile.target_level as Level);
        setAvatarUrl(profile.avatar_url ?? null);
        setStreak(profile.streak ?? 0);
      }
      // Target belajar sekarang di-source dari user_metadata (dipakai onboarding
      // + proxy). Override kalau ada.
      const md = user.user_metadata ?? {};
      if (md.target_level) setTargetLevel(md.target_level as Level);
      if (md.exam_date && md.exam_date !== "none") setUjianDate(md.exam_date as string);
      if (typeof md.daily_goal_minutes === "number") setWaktuPerHari(md.daily_goal_minutes as number);
    }
    load();
  }, []);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setUploadingAvatar(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) {
        showError("Gagal upload foto: " + upErr.message);
      } else {
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        const url = urlData.publicUrl + `?t=${Date.now()}`;
        // Persist link ke profiles — CEK error-nya (dulu gagal diam-diam di sini).
        const { error: updErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
        if (updErr) {
          showError("Foto ke-upload tapi gagal disimpan: " + updErr.message);
        } else {
          setAvatarUrl(url);
          showSaved();
        }
      }
    }
    setUploadingAvatar(false);
  }

  async function handleSaveProfile() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles")
        .update({ username: nama })
        .eq("id", user.id);
    }
    setSaving(false);
    showSaved();
  }

  async function handleSaveTarget() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles")
        .update({ target_level: targetLevel })
        .eq("id", user.id);
      // Sinkron ke user_metadata (source of truth buat onboarding + proxy).
      await supabase.auth.updateUser({
        data: { target_level: targetLevel, exam_date: ujianDate || null, daily_goal_minutes: waktuPerHari },
      });
    }
    setSaving(false);
    showSaved();
  }

  function toggleKategori(k: string) {
    setKategoriFokus(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);
  }

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
          isPro={stats.isPro}
         
        />

        <header className="pg-header">
          <Breadcrumb items={[{ label: "Beranda", href: "/" }, { label: "Pengaturan" }]} />
          <h1 className="pg-title">
            Pengaturan <span className="pg-title-jp">設定</span>
          </h1>
          <p className="pg-sub">Atur profil, target belajar, preferensi AI, dan langganan kamu.</p>
        </header>

        <div className="pg-grid">
          <aside className="pg-nav glass-card">
            <ul className="pg-nav-list">
              {SECTIONS.map(s => {
                const isActive = active === s.id;
                const isDanger = "danger" in s && s.danger;
                return (
                  <li
                    key={s.id}
                    className={`pg-nav-item${isActive ? " on" : ""}${isDanger ? " danger" : ""}`}
                    onClick={() => setActive(s.id)}
                  >
                    <s.Icon size={14} strokeWidth={1.6} />
                    <span>{s.label}</span>
                    {isActive && <ChevronRight size={12} strokeWidth={2} />}
                  </li>
                );
              })}
            </ul>
          </aside>

          <div className="pg-main">
            {active === "profile" && (
              <ProfileSection
                nama={nama} setNama={setNama}
                email={email} setEmail={setEmail}
                bahasaUi={bahasaUi} setBahasaUi={setBahasaUi}
                bio={bio} setBio={setBio}
                avatarUrl={avatarUrl}
                avatarPreview={avatarPreview}
                uploadingAvatar={uploadingAvatar}
                userInitial={userInitial}
                fileInputRef={fileInputRef}
                onAvatarChange={handleAvatarChange}
                onSave={handleSaveProfile}
                saving={saving}
              />
            )}
            {active === "target" && (
              <TargetSection
                targetLevel={targetLevel} setTargetLevel={setTargetLevel}
                ujianDate={ujianDate} setUjianDate={setUjianDate}
                waktuPerHari={waktuPerHari} setWaktuPerHari={setWaktuPerHari}
                kategoriFokus={kategoriFokus} toggleKategori={toggleKategori}
                onSave={handleSaveTarget}
                saving={saving}
              />
            )}
            {active === "ai" && (
              <AISection
                aiStyle={aiStyle} setAiStyle={setAiStyle}
                aiLang={aiLang} setAiLang={setAiLang}
                autoExtract={autoExtract} setAutoExtract={setAutoExtract}
                furiganaMode={furiganaMode} setFuriganaMode={setFuriganaMode}
                onSave={showSaved}
              />
            )}
            {active === "notif" && (
              <NotifSection
                daily={notifDaily} setDaily={setNotifDaily}
                streakWarn={notifStreak} setStreakWarn={setNotifStreak}
                materi={notifMateri} setMateri={setNotifMateri}
                weekly={notifWeekly} setWeekly={setNotifWeekly}
                push={notifPush} setPush={setNotifPush}
              />
            )}
            {active === "sub" && <SubscriptionSection />}
            {active === "privacy" && (
              <PrivacySection
                leaderboard={privLeaderboard} setLeaderboard={setPrivLeaderboard}
                shareFriends={privShareFriends} setShareFriends={setPrivShareFriends}
                aiTraining={privAiTraining} setAiTraining={setPrivAiTraining}
              />
            )}
            {active === "danger" && <DangerSection />}
          </div>
        </div>

        {saved && (
          <div className="pg-saved-toast">
            <Check size={14} strokeWidth={2.4} /> Tersimpan
          </div>
        )}
        {errMsg && (
          <div className="pg-saved-toast pg-error-toast">
            <X size={14} strokeWidth={2.4} /> {errMsg}
          </div>
        )}
      </main>
    </>
  );
}

/* ─── Common subcomponents ─── */

function Card({ title, desc, children, footer }: {
  title: string; desc?: string; children?: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <div className="glass-card pg-card">
      <div className="pg-card-head">
        <h3>{title}</h3>
        {desc && <p>{desc}</p>}
      </div>
      {children && <div className="pg-card-body">{children}</div>}
      {footer && <div>{footer}</div>}
    </div>
  );
}

function Field({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="pg-field">
      <label className="pg-field-label">
        {label}{hint && <span className="pg-field-hint">· {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function SaveBtn({ onSave, saving, children = "Simpan perubahan" }: {
  onSave: () => void; saving?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className="pg-save-row">
      <button type="button" className="btn btn-ghost btn-sm">Batal</button>
      <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>
        {saving ? "Menyimpan..." : children}
      </button>
    </div>
  );
}

interface RadioOption<T extends string> { v: T; t: string; d?: string }
function RadioGroup<T extends string>({ name, options, value, onChange }: {
  name: string; options: RadioOption<T>[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="pg-radio-group">
      {options.map(o => (
        <label key={o.v} className={`pg-radio${value === o.v ? " on" : ""}`}>
          <input
            type="radio"
            name={name}
            value={o.v}
            checked={value === o.v}
            onChange={() => onChange(o.v)}
            style={{ display: "none" }}
          />
          <div className="pg-radio-dot" />
          <div className="pg-radio-meta">
            <div className="pg-radio-title">{o.t}</div>
            {o.d && <div className="pg-radio-desc">{o.d}</div>}
          </div>
        </label>
      ))}
    </div>
  );
}

function Toggle({ label, sub, on, onChange }: {
  label: string; sub?: string; on: boolean; onChange: (on: boolean) => void;
}) {
  return (
    <div className="pg-toggle-row" onClick={() => onChange(!on)}>
      <div>
        <div className="pg-toggle-label">{label}</div>
        {sub && <div className="pg-toggle-sub">{sub}</div>}
      </div>
      <div className={`pg-toggle${on ? " on" : ""}`}>
        <div className="pg-toggle-knob" />
      </div>
    </div>
  );
}

/* ─── Profile section ─── */

function ProfileSection({
  nama, setNama, email, setEmail, bahasaUi, setBahasaUi, bio, setBio,
  avatarUrl, avatarPreview, uploadingAvatar, userInitial, fileInputRef,
  onAvatarChange, onSave, saving,
}: {
  nama: string; setNama: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  bahasaUi: string; setBahasaUi: (v: string) => void;
  bio: string; setBio: (v: string) => void;
  avatarUrl: string | null;
  avatarPreview: string | null;
  uploadingAvatar: boolean;
  userInitial: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const displayAvatar = avatarPreview || avatarUrl;
  return (
    <>
      <Card title="Profil" desc="Info dasar tentang kamu — terlihat di sertifikat & leaderboard">
        <div className="pg-avatar-row">
          <div className="pg-avatar-big">
            {displayAvatar
              ? <Image src={displayAvatar} alt="avatar" width={72} height={72} unoptimized />
              : userInitial}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={onAvatarChange}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
            >
              <Camera size={12} /> {uploadingAvatar ? "Mengunggah..." : "Ganti foto"}
            </button>
            <p className="pg-avatar-hint">JPG / PNG · max 2 MB</p>
          </div>
        </div>
        <Field label="Nama tampilan">
          <input className="pg-input" value={nama} onChange={e => setNama(e.target.value)} />
        </Field>
        <div className="pg-field-row">
          <Field label="Email" hint="Login & notifikasi">
            <input className="pg-input" value={email} onChange={e => setEmail(e.target.value)} disabled />
          </Field>
          <Field label="Bahasa antarmuka">
            <select className="pg-input" value={bahasaUi} onChange={e => setBahasaUi(e.target.value)}>
              <option>Bahasa Indonesia</option>
              <option>English</option>
              <option>日本語</option>
            </select>
          </Field>
        </div>
        <Field label="Bio singkat" hint="Optional · 160 karakter">
          <textarea
            className="pg-input pg-textarea"
            maxLength={160}
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Belajar N2, target Desember 2026. Fokus reading & vocab."
          />
        </Field>
      </Card>
      <SaveBtn onSave={onSave} saving={saving} />
    </>
  );
}

/* ─── Target section ─── */

function TargetSection({
  targetLevel, setTargetLevel, ujianDate, setUjianDate, waktuPerHari, setWaktuPerHari,
  kategoriFokus, toggleKategori, onSave, saving,
}: {
  targetLevel: Level; setTargetLevel: (l: Level) => void;
  ujianDate: string; setUjianDate: (d: string) => void;
  waktuPerHari: number; setWaktuPerHari: (n: number) => void;
  kategoriFokus: string[]; toggleKategori: (k: string) => void;
  onSave: () => void; saving: boolean;
}) {
  const KATEGORIS = [
    { jp: "文法", label: "Bunpou" },
    { jp: "語彙", label: "Goi" },
    { jp: "読解", label: "Dokkai" },
    { jp: "聴解", label: "Choukai" },
    { jp: "文字", label: "Moji" },
  ];
  return (
    <>
      <Card title="Target Belajar" desc="AI akan tune kesulitan soal & rekomendasi sesuai target">
        <Field label="Target level JLPT">
          <div className="pg-lv-grid">
            {(["N5", "N4", "N3", "N2", "N1"] as Level[]).map(lv => (
              <button
                key={lv}
                type="button"
                className={`pg-lv-tile lvt-${lv.toLowerCase()}${targetLevel === lv ? " on" : ""}`}
                onClick={() => setTargetLevel(lv)}
              >
                <span className="pg-lv-letter">{lv}</span>
                {targetLevel === lv && (
                  <span className="lvt-check">
                    <Check size={10} strokeWidth={3} style={{ color: "var(--bg)" }} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Tanggal target ujian">
          <input
            className="pg-input"
            type="date"
            value={ujianDate}
            onChange={e => setUjianDate(e.target.value)}
          />
        </Field>
        <Field label="Waktu belajar per hari (target)" hint="AI akan ingatin kalau kurang">
          <div className="pg-range-wrap">
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              value={waktuPerHari}
              onChange={e => setWaktuPerHari(Number(e.target.value))}
              className="pg-range"
            />
            <span className="pg-range-val">{waktuPerHari} menit</span>
          </div>
        </Field>
        <Field label="Fokus area">
          <div className="pg-focus-grid">
            {KATEGORIS.map(k => {
              const on = kategoriFokus.includes(k.jp);
              return (
                <button
                  key={k.jp}
                  type="button"
                  className={`pg-focus-tile${on ? " on" : ""}`}
                  onClick={() => toggleKategori(k.jp)}
                >
                  <span className="font-jp-sans">{k.jp}</span>
                  <span>{k.label}</span>
                  {on && (
                    <span className="focus-check">
                      <Check size={9} strokeWidth={3} style={{ color: "white" }} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Field>
      </Card>
      <SaveBtn onSave={onSave} saving={saving} />
    </>
  );
}

/* ─── AI prefs section ─── */

function AISection({
  aiStyle, setAiStyle, aiLang, setAiLang,
  autoExtract, setAutoExtract, furiganaMode, setFuriganaMode, onSave,
}: {
  aiStyle: "concise" | "balanced" | "detailed";
  setAiStyle: (v: "concise" | "balanced" | "detailed") => void;
  aiLang: "id" | "id-jp" | "jp";
  setAiLang: (v: "id" | "id-jp" | "jp") => void;
  autoExtract: boolean;
  setAutoExtract: (v: boolean) => void;
  furiganaMode: "all" | "level" | "off";
  setFuriganaMode: (v: "all" | "level" | "off") => void;
  onSave: () => void;
}) {
  return (
    <>
      <Card title="Preferensi AI" desc="Atur bagaimana Sensei AI berkomunikasi dengan kamu">
        <Field label="Gaya penjelasan">
          <RadioGroup
            name="style"
            value={aiStyle}
            onChange={setAiStyle}
            options={[
              { v: "concise",  t: "Singkat",  d: "Penjelasan to-the-point, fokus jawaban" },
              { v: "balanced", t: "Seimbang", d: "Penjelasan + 1-2 contoh tambahan (rekomendasi)" },
              { v: "detailed", t: "Detail",   d: "Penjelasan panjang + breakdown gramatikal lengkap" },
            ]}
          />
        </Field>
        <Field label="Bahasa pembahasan">
          <RadioGroup
            name="lang"
            value={aiLang}
            onChange={setAiLang}
            options={[
              { v: "id",    t: "Bahasa Indonesia",        d: "Pembahasan full Indonesia" },
              { v: "id-jp", t: "Indonesia + Japanese",    d: "Indonesia untuk penjelasan, contoh dalam Jepang" },
              { v: "jp",    t: "日本語のみ",               d: "Mode immersi penuh — penjelasan dalam Jepang" },
            ]}
          />
        </Field>
        <Field label="Auto-extract kosakata">
          <Toggle
            label="Simpan kosakata otomatis dari setiap foto"
            sub="Max 10 kata per foto · auto-saved ke Kamus"
            on={autoExtract}
            onChange={setAutoExtract}
          />
        </Field>
        <Field label="Tampilan furigana default">
          <RadioGroup
            name="furi"
            value={furiganaMode}
            onChange={setFuriganaMode}
            options={[
              { v: "all",   t: "Selalu tampilkan" },
              { v: "level", t: "Berdasarkan level kanji" },
              { v: "off",   t: "Sembunyikan" },
            ]}
          />
        </Field>
      </Card>
      <SaveBtn onSave={onSave} />
    </>
  );
}

/* ─── Notification section ─── */

function NotifSection({
  daily, setDaily, streakWarn, setStreakWarn, materi, setMateri,
  weekly, setWeekly, push, setPush,
}: {
  daily: boolean; setDaily: (v: boolean) => void;
  streakWarn: boolean; setStreakWarn: (v: boolean) => void;
  materi: boolean; setMateri: (v: boolean) => void;
  weekly: boolean; setWeekly: (v: boolean) => void;
  push: boolean; setPush: (v: boolean) => void;
}) {
  return (
    <Card title="Notifikasi" desc="Kapan kamu mau di-ping">
      <Toggle label="Reminder belajar harian"             sub="Setiap hari jam 19:00 (sesuaikan di bawah)" on={daily} onChange={setDaily} />
      <Toggle label="Streak akan hilang"                  sub="2 jam sebelum streak putus"                on={streakWarn} onChange={setStreakWarn} />
      <Toggle label="Materi baru tersedia"                sub="Kalau materi favorit kamu di-update"       on={materi} onChange={setMateri} />
      <Toggle label="Insight mingguan via email"          sub="Setiap Senin pagi — rangkuman progress"   on={weekly} onChange={setWeekly} />
      <Toggle label="Push notification mobile"            sub="Belum tersedia — coming soon"              on={push} onChange={setPush} />
    </Card>
  );
}

/* ─── Subscription section (placeholder) ─── */

function SubscriptionSection() {
  return (
    <>
      <div className="glass-card pg-sub-hero">
        <div className="pg-sub-hero-bg" />
        <div className="pg-sub-hero-row">
          <div>
            <span className="pg-sub-eyebrow">
              <Sparkles size={11} fill="currentColor" strokeWidth={1} /> Plan saat ini
            </span>
            <h2 className="pg-sub-title">Sensei Free</h2>
            <p className="pg-sub-desc">
              Kamu sedang di plan Free · 10 analisis foto/hari · 50 kotoba di Kamus
            </p>
          </div>
          <div className="pg-sub-price">
            <span className="pg-price-amount">Rp 0</span>
            <span className="pg-price-period">/ selamanya</span>
          </div>
        </div>
        <div className="pg-sub-meta">
          <div><span>Plan</span><strong>Free</strong></div>
          <div><span>Limit harian</span><strong>10 analisis</strong></div>
          <div><span>Upgrade tersedia</span><strong>Pro & Lifetime</strong></div>
        </div>
        <div className="pg-sub-actions">
          <Link href="/premium" className="btn btn-primary btn-sm">
            <Sparkles size={12} /> Upgrade ke Pro
          </Link>
          <Link href="/premium" className="btn btn-secondary btn-sm">Lihat semua plan</Link>
        </div>
      </div>

      <Card title="Riwayat tagihan" desc="Belum ada tagihan — kamu masih di plan Free">
        <p style={{ fontSize: 12.5, color: "var(--text-tertiary)", margin: 0 }}>
          Setelah upgrade ke Pro/Lifetime, invoice & receipt akan muncul di sini.
        </p>
      </Card>
    </>
  );
}

/* ─── Privacy section ─── */

function PrivacySection({
  leaderboard, setLeaderboard, shareFriends, setShareFriends, aiTraining, setAiTraining,
}: {
  leaderboard: boolean; setLeaderboard: (v: boolean) => void;
  shareFriends: boolean; setShareFriends: (v: boolean) => void;
  aiTraining: boolean; setAiTraining: (v: boolean) => void;
}) {
  return (
    <>
      <Card title="Privasi" desc="Atur apa yang dilihat orang lain">
        <Toggle label="Tampilkan profil di leaderboard publik" sub="Kalau off, masih kelihatan oleh teman"             on={leaderboard}   onChange={setLeaderboard} />
        <Toggle label="Bagikan progress ke teman"              sub="Teman bisa lihat streak & XP kamu"                  on={shareFriends}  onChange={setShareFriends} />
        <Toggle label="Foto soal boleh dipakai untuk training AI" sub="Anonim, tidak terikat akun kamu · membantu akurasi AI" on={aiTraining}    onChange={setAiTraining} />
      </Card>
      <Card title="Data kamu" desc="Export atau hapus data sesuai keinginan">
        <div className="pg-data-row">
          <button type="button" className="btn btn-secondary btn-sm">Export semua kotoba (CSV)</button>
          <button type="button" className="btn btn-secondary btn-sm">Export riwayat soal (PDF)</button>
          <button type="button" className="btn btn-secondary btn-sm">Export catatan (Markdown ZIP)</button>
        </div>
      </Card>
    </>
  );
}

/* ─── Danger Zone ─── */

function DangerSection() {
  return (
    <Card title="Danger Zone" desc="Aksi yang tidak bisa diundo — pastikan kamu yakin">
      <div className="danger-row">
        <div>
          <div className="danger-title">Reset semua progress</div>
          <p className="danger-desc">Hapus semua riwayat soal, streak, XP, statistik. Kotoba & catatan tetap aman.</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm danger-link">Reset progress</button>
      </div>
      <div className="danger-row">
        <div>
          <div className="danger-title">Hapus semua kotoba</div>
          <p className="danger-desc">Hapus semua entry di Kamus kamu. Tidak bisa di-recover.</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm danger-link">Hapus kotoba</button>
      </div>
      <div className="danger-row strong">
        <div>
          <div className="danger-title">Hapus akun permanen</div>
          <p className="danger-desc">Semua data kamu — profil, kotoba, sesi, catatan, statistik — akan dihapus permanen dari server kami dalam 30 hari.</p>
        </div>
        <button type="button" className="btn danger-btn btn-sm">Hapus akun</button>
      </div>
    </Card>
  );
}
