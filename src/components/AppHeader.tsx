"use client";

import { useEffect, useState, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bell, Sparkles } from "lucide-react";

const NAV = [
  { label: "Beranda",  href: "/" },
  { label: "Analisis", href: "/analisis-foto" },
  { label: "Latihan",  href: "/lembar-tugas" },
];

interface AppHeaderProps {
  activeHref?: string;
  /** Extra elements injected after the bell (e.g. action buttons for a specific page) */
  rightSlot?: ReactNode;
}

export default function AppHeader({ activeHref = "/", rightSlot }: AppHeaderProps) {
  const [userInitial, setUserInitial] = useState("?");
  const [avatarUrl,   setAvatarUrl]   = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserInitial(
        (user.user_metadata?.full_name || user.email || "?")[0].toUpperCase()
      );
      const { data } = await supabase
        .from("profiles").select("avatar_url").eq("id", user.id).single();
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    }
    load();
  }, []);

  return (
    <header
      className="flex items-center justify-between px-4 md:px-6 py-2.5 shrink-0 backdrop-blur-xl relative z-20"
      style={{
        background: "rgba(2,8,20,0.8)",
        borderBottom: "1px solid rgba(107,156,218,0.12)",
        boxShadow: "0 1px 0 rgba(107,156,218,0.06)",
      }}
    >
      {/* shimmer line */}
      <div className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: "linear-gradient(90deg,transparent,rgba(107,156,218,0.4),rgba(166,123,212,0.3),transparent)" }} />

      {/* ── Left: Logo + Nav ── */}
      <div className="flex items-center gap-5 md:gap-8">
        <a href="/" className="flex items-center gap-2.5">
          <div className="relative size-7 flex items-center justify-center">
            <div className="absolute inset-0 rounded-lg opacity-60 blur-sm"
              style={{ background: "linear-gradient(135deg,#4a7abf,#8b5abf)" }} />
            <div className="relative size-7 rounded-lg flex items-center justify-center font-black text-[11px]"
              style={{ background: "linear-gradient(135deg,#1a3a6f,#3a1a6f)", border: "1px solid rgba(107,156,218,0.4)", color: "#bbc6e2" }}>
              先
            </div>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[13px] font-extrabold tracking-tight text-[#d7e2ff]"
              style={{ fontFamily: "var(--font-jakarta)" }}>Sensei</span>
            <span className="text-[9px] font-bold tracking-widest"
              style={{ fontFamily: "var(--font-space)", color: "#4a7abf" }}>JLPT · AI</span>
          </div>
        </a>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map(item => {
            const active = item.href === activeHref;
            return (
              <a key={item.href} href={item.href}
                className="relative px-3 py-1.5 text-[13px] rounded-lg transition-all"
                style={active
                  ? { color: "#d7e2ff", fontWeight: 600, background: "rgba(107,156,218,0.1)" }
                  : { color: "#6a7a9a" }}>
                {item.label}
                {active && (
                  <span className="absolute bottom-0.5 left-3 right-3 h-px rounded-full"
                    style={{ background: "linear-gradient(90deg,#4a7abf,#8b5abf)" }} />
                )}
              </a>
            );
          })}
        </nav>
      </div>

      {/* ── Right: PRO + Bell + extra slot + Avatar ── */}
      <div className="flex items-center gap-2">
        <a href="/premium"
          className="hidden sm:flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full font-bold transition-all hover:brightness-110"
          style={{
            background: "linear-gradient(135deg,rgba(74,122,191,0.15),rgba(139,90,191,0.15))",
            border: "1px solid rgba(107,156,218,0.25)",
            color: "#a0b4d4",
            fontFamily: "var(--font-space)",
          }}>
          <Sparkles className="size-3 text-[#6b9cda]" />
          PRO
        </a>

        <button className="relative size-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/5">
          <Bell className="size-4 text-[#6a7a9a]" />
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-[#6b9cda] shadow-[0_0_6px_#6b9cda]" />
        </button>

        {rightSlot}

        <a href="/pengaturan" className="relative group">
          <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity blur-sm"
            style={{ background: "linear-gradient(135deg,#4a7abf,#8b5abf)" }} />
          {avatarUrl
            ? <img src={avatarUrl} alt="avatar"
                className="relative size-8 rounded-full object-cover"
                style={{ border: "2px solid rgba(107,156,218,0.35)" }} />
            : <div className="relative size-8 rounded-full flex items-center justify-center text-xs font-black transition-all"
                style={{ background: "linear-gradient(135deg,#1a3a6f,#3a1a6f)", color: "#bbc6e2", border: "1px solid rgba(107,156,218,0.3)", boxShadow: "0 0 0 2px rgba(74,122,191,0.25)" }}>
                {userInitial}
              </div>
          }
        </a>
      </div>
    </header>
  );
}
