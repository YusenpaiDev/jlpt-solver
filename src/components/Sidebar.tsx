"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  House, History, Camera, BookOpen, BarChart2,
  Settings, LogOut, Zap, ArrowUpRight, Flame, ClipboardList,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────── */
interface Profile {
  username: string | null;
  target_level: string;
  xp: number;
  streak: number;
  is_premium: boolean;
  last_active: string | null;
  avatar_url: string | null;
}

/* ─── Nav ───────────────────────────────────────────────────── */
const navItems = [
  { icon: House,         label: "Beranda",        href: "/"               },
  { icon: History,       label: "Riwayat Soal",   href: "/riwayat-soal"   },
  { icon: Camera,        label: "Analisis Foto",   href: "/analisis-foto"  },
  { icon: ClipboardList, label: "Lembar Tugas",    href: "/lembar-tugas"   },
  { icon: BookOpen,      label: "Kamus",           href: "/kamus"          },
  { icon: BarChart2,     label: "Statistik",       href: "/statistik"      },
];

const XP_PER_LEVEL = 1000;

/* ─── Sidebar ───────────────────────────────────────────────── */
export function Sidebar({ activeHref }: { activeHref: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("username, target_level, xp, streak, is_premium, last_active, avatar_url")
        .eq("id", user.id)
        .single();
      if (!data) return;

      /* ── Streak update ── */
      const today = new Date().toISOString().split("T")[0];
      let newStreak = data.streak ?? 0;

      if (data.last_active !== today) {
        const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
        newStreak = data.last_active === yesterday ? newStreak + 1 : 1;
        await supabase
          .from("profiles")
          .update({ streak: newStreak, last_active: today })
          .eq("id", user.id);
      }

      setProfile({ ...data, streak: newStreak, avatar_url: data.avatar_url ?? null });
    }
    load();
  }, []);

  /* ── Derived values ── */
  const displayName   = profile?.username || "Pengguna";
  const initial       = displayName[0].toUpperCase();
  const targetLevel   = profile?.target_level || "N3";
  const xp            = profile?.xp ?? 0;
  const streak        = profile?.streak ?? 0;
  const xpInLevel     = xp % XP_PER_LEVEL;
  const xpPct         = Math.round((xpInLevel / XP_PER_LEVEL) * 100);
  const isPremium     = profile?.is_premium ?? false;

  return (
    <aside
      className="w-[220px] shrink-0 hidden lg:flex flex-col justify-between py-4 px-3 backdrop-blur-xl"
      style={{
        background: "rgba(8,16,36,0.55)",
        borderRight: "1px solid rgba(107,156,218,0.1)",
        boxShadow: "inset -1px 0 0 rgba(255,255,255,0.03), 4px 0 24px rgba(0,0,0,0.3)",
      }}
    >
      <div className="flex flex-col gap-0.5">

        {/* ── User card ── */}
        <div className="mb-4 p-3 rounded-xl relative overflow-hidden backdrop-blur-md"
          style={{
            background: "rgba(30,50,90,0.35)",
            border: "1px solid rgba(107,156,218,0.15)",
            boxShadow: "0 2px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}>
          <div className="absolute inset-0 opacity-40"
            style={{ background: "radial-gradient(circle at top right,rgba(74,122,191,0.3),transparent 70%)" }} />

          <div className="relative flex items-center gap-3">
            {/* Avatar */}
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="size-9 rounded-full object-cover ring-2 ring-[#2f4865] shrink-0"
              />
            ) : (
              <div className="size-9 rounded-full flex items-center justify-center text-sm font-bold text-white ring-2 ring-[#2f4865] shrink-0"
                style={{ background: "linear-gradient(135deg,#4a7abf,#2f4865)" }}>
                {profile ? initial : "…"}
              </div>
            )}

            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[#d7e2ff] truncate"
                  style={{ fontFamily: "var(--font-jakarta)" }}>
                  {profile ? displayName : "Memuat..."}
                </span>
                {isPremium && (
                  <span className="text-[8px] px-1 py-0.5 rounded font-black"
                    style={{ background: "linear-gradient(135deg,#bbc6e2,#6b8cba)", color: "#071327", fontFamily: "var(--font-space)" }}>
                    PRO
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: "#2f4865", color: "#8ab4e8", fontFamily: "var(--font-space)" }}>
                  JLPT {targetLevel}
                </span>
                <span className="text-[9px] text-[#4a5a7a]">target</span>
              </div>
            </div>
          </div>

          {/* XP bar */}
          <div className="relative mt-3">
            <div className="flex justify-between text-[9px] text-[#4a5a7a] mb-1"
              style={{ fontFamily: "var(--font-space)" }}>
              <span>XP</span>
              <span>{xpInLevel} / {XP_PER_LEVEL}</span>
            </div>
            <div className="h-1 rounded-full" style={{ background: "#1f2a3f" }}>
              <div className="h-1 rounded-full transition-all duration-700"
                style={{
                  width: `${profile ? xpPct : 0}%`,
                  background: "linear-gradient(90deg,#4a7abf,#bbc6e2)",
                }} />
            </div>
          </div>

          {/* Streak row */}
          {streak > 0 && (
            <div className="relative mt-2 flex items-center gap-1.5">
              <Flame className="size-3 text-[#e07b4a]" />
              <span className="text-[9px] font-bold text-[#e07b4a]"
                style={{ fontFamily: "var(--font-space)" }}>
                {streak} HARI STREAK
              </span>
            </div>
          )}
        </div>

        {/* ── Nav links ── */}
        {navItems.map(({ icon: Icon, label, href }) => {
          const active = href === activeHref;
          return (
            <a key={label} href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                active ? "text-[#d7e2ff] font-medium" : "text-[#8a9bbf] hover:text-[#d7e2ff]"
              }`}
              style={active ? {
                background: "rgba(74,122,191,0.15)",
                boxShadow: "inset 2px 0 0 #4a7abf, 0 0 12px rgba(74,122,191,0.1)",
                border: "1px solid rgba(74,122,191,0.2)",
                fontFamily: "var(--font-manrope)",
              } : {
                fontFamily: "var(--font-manrope)",
                border: "1px solid transparent",
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = ""; }}
            >
              <Icon className={`size-4 shrink-0 ${active ? "text-[#6b9cda]" : "text-[#4a5a7a]"}`} />
              {label}
            </a>
          );
        })}
      </div>

      {/* ── Bottom section ── */}
      <div className="flex flex-col gap-1">
        {!isPremium && (
          <div className="mb-3 p-3 rounded-xl relative overflow-hidden backdrop-blur-md"
            style={{
              background: "rgba(20,35,70,0.5)",
              border: "1px solid rgba(187,198,226,0.12)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}>
            <div className="absolute inset-0 opacity-30"
              style={{ background: "radial-gradient(circle at bottom left,rgba(107,140,186,0.4),transparent 70%)" }} />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Zap className="size-3 text-[#bbc6e2]" />
                <span className="text-[10px] font-semibold text-[#bbc6e2]"
                  style={{ fontFamily: "var(--font-space)" }}>UPGRADE KE PRO</span>
              </div>
              <p className="text-[10px] text-[#8a9bbf] mb-2.5 leading-relaxed">Analisis unlimited & tips eksklusif</p>
              <a href="/premium"
                className="w-full text-[10px] font-bold py-1.5 rounded-lg text-[#071327] flex items-center justify-center gap-1"
                style={{ background: "linear-gradient(135deg,#bbc6e2,#6b8cba)", fontFamily: "var(--font-space)" }}>
                MULAI GRATIS <ArrowUpRight className="size-3" />
              </a>
            </div>
          </div>
        )}
        <a href="/pengaturan"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#8a9bbf] hover:text-[#d7e2ff] hover:bg-white/5 transition-colors">
          <Settings className="size-4 text-[#4a5a7a]" /> Pengaturan
        </a>
        <a href="/login"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#8a9bbf] hover:text-red-400 hover:bg-red-500/5 transition-colors">
          <LogOut className="size-4 text-[#4a5a7a]" /> Keluar
        </a>
      </div>
    </aside>
  );
}

/* ─── Bottom Navigation (mobile only) ──────────────────────── */
export function BottomNav({ activeHref }: { activeHref: string }) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 flex lg:hidden border-t"
      style={{ background: "#0d1929", borderColor: "rgba(255,255,255,0.06)" }}
    >
      {navItems.map(({ icon: Icon, label, href }) => {
        const active = href === activeHref;
        return (
          <a
            key={label}
            href={href}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors"
            style={{ color: active ? "#6b9cda" : "#4a5a7a" }}
          >
            <Icon className="size-5 shrink-0" />
            <span
              className="text-[9px] font-semibold leading-none"
              style={{ fontFamily: "var(--font-space)" }}
            >
              {label.split(" ")[0]}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
