"use client";

import { useState } from "react";
import { Eye, EyeOff, ArrowRight, Sparkles, TrendingUp, Camera, BarChart2, Flame, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const avatarColors = ["#4a7abf", "#8b5abf", "#3a9a7a", "#c0844a", "#c05abf"];

export default function Login() {
  const [mode, setMode]           = useState<"login" | "register">("login");
  const [showPass, setShowPass]   = useState(false);
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [username, setUsername]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);

  const supabase = createClient();

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/";
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: username || email.split("@")[0] } },
        });
        if (error) throw error;
        setSuccess("Cek email kamu untuk konfirmasi akun, lalu login.");
        setMode("login");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
      if (msg.includes("Invalid login credentials")) setError("Email atau kata sandi salah.");
      else if (msg.includes("Email not confirmed")) setError("Email belum dikonfirmasi. Cek inbox kamu dan klik link konfirmasi dari Supabase.");
      else if (msg.includes("User already registered")) setError("Email sudah terdaftar. Silakan login.");
      else if (msg.includes("Password should be")) setError("Kata sandi minimal 6 karakter.");
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
  }

  return (
    <div className="text-[#d7e2ff] min-h-screen md:grid md:grid-cols-2"
      style={{ background: "#071327", fontFamily: "var(--font-manrope)" }}>

      {/* ── Left panel ── */}
      <div className="hidden md:flex flex-col justify-center h-full gap-8 px-14 py-16 relative overflow-hidden"
        style={{ background: "#071327" }}>

        <div className="pointer-events-none absolute bottom-0 left-0 w-[500px] h-[500px] opacity-[0.08] blur-[90px]"
          style={{ background: "radial-gradient(circle,#4a7abf,transparent 70%)" }} />
        <div className="pointer-events-none absolute top-1/3 right-0 w-[300px] h-[300px] opacity-[0.05] blur-[70px]"
          style={{ background: "radial-gradient(circle,#8b5abf,transparent 70%)" }} />
        <div className="pointer-events-none absolute right-[-20px] top-[15%] text-[260px] font-black leading-none select-none"
          style={{ color: "transparent", WebkitTextStroke: "1px rgba(187,198,226,0.04)", fontFamily: "var(--font-jakarta)" }}>
          学
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-2.5">
          <div className="size-7 rounded-lg flex items-center justify-center text-xs font-black text-[#071327]"
            style={{ background: "linear-gradient(135deg,#bbc6e2,#6b8cba)" }}>S</div>
          <div>
            <p className="text-sm font-bold text-[#d7e2ff] leading-none"
              style={{ fontFamily: "var(--font-jakarta)" }}>Sensei JLPT</p>
            <p className="text-[9px] text-[#4a5a7a] tracking-widest mt-0.5"
              style={{ fontFamily: "var(--font-space)" }}>THE INTELLIGENT SENSEI</p>
          </div>
        </div>

        {/* Hero */}
        <div className="relative flex flex-col gap-6">
          <div className="flex items-center gap-2 self-start px-3 py-1.5 rounded-full"
            style={{ background: "#1f2a3f" }}>
            <Sparkles className="size-3 text-[#bbc6e2]" />
            <span className="text-[10px] font-semibold text-[#bbc6e2]"
              style={{ fontFamily: "var(--font-space)" }}>N2 VOCABULARY FOCUS</span>
          </div>

          <h1 className="text-[2.4rem] font-extrabold leading-[1.1] tracking-tight text-[#d7e2ff]"
            style={{ fontFamily: "var(--font-jakarta)" }}>
            Belajar JLPT lebih{" "}
            <span style={{ background: "linear-gradient(135deg,#5ea87a,#3a9a6a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              cerdas
            </span>
            {" "}dan lebih{" "}
            <span style={{ background: "linear-gradient(135deg,#6b9cda,#a67bd4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              cepat.
            </span>
          </h1>

          <p className="text-sm text-[#8a9bbf] leading-relaxed">
            AI yang memahami kelemahan kamu dan melatih tepat sasaran setiap hari.
          </p>

          <div className="flex flex-col gap-2.5">
            {[
              { icon: Camera,    accent: "#4a7abf", title: "Analisis foto soal",    desc: "Upload soal, AI langsung jelaskan",       badge: "AI",  badgeBg: "rgba(74,122,191,0.2)",  badgeColor: "#6b9cda" },
              { icon: BarChart2, accent: "#8b5abf", title: "Lacak progres N2 kamu", desc: "Statistik detail per kategori soal",      badge: "Pro", badgeBg: "rgba(139,90,191,0.2)", badgeColor: "#b07ad4" },
              { icon: Flame,     accent: "#5ea87a", title: "Streak harian",          desc: "Konsisten setiap hari menuju N2",         badge: null,  badgeBg: "",                      badgeColor: "" },
            ].map(({ icon: Icon, accent, title, desc, badge, badgeBg, badgeColor }) => (
              <div key={title}
                className="flex items-center gap-3 px-4 py-3 rounded-xl relative overflow-hidden"
                style={{ background: "#101b30" }}>
                <div className="absolute inset-0 opacity-30"
                  style={{ background: `radial-gradient(circle at left,${accent}18,transparent 60%)` }} />
                <div className="relative size-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${accent}20` }}>
                  <Icon className="size-4" style={{ color: accent }} />
                </div>
                <div className="relative flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#d7e2ff]" style={{ fontFamily: "var(--font-jakarta)" }}>{title}</p>
                  <p className="text-[10px] text-[#4a5a7a]">{desc}</p>
                </div>
                {badge && (
                  <span className="relative text-[9px] px-2 py-0.5 rounded-full font-bold shrink-0"
                    style={{ background: badgeBg, color: badgeColor, fontFamily: "var(--font-space)" }}>
                    {badge}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Social proof */}
        <div className="relative flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              {avatarColors.map((c, i) => (
                <div key={i}
                  className="size-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: `linear-gradient(135deg,${c},${c}99)`, borderColor: "#071327", marginLeft: i === 0 ? 0 : -8, zIndex: avatarColors.length - i, position: "relative" }}>
                  {["A","B","C","D","E"][i]}
                </div>
              ))}
            </div>
            <span className="flex items-center gap-1.5 text-xs text-[#8a9bbf]">
              <TrendingUp className="size-3.5 text-[#5ea87a]" />
              +91k pelajar aktif belajar bareng setiap hari
            </span>
          </div>
          <div className="flex items-center gap-2">
            {["N5","N4","N3","N2","N1"].map((l, i) => (
              <div key={l} className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                style={{ background: i === 3 ? "linear-gradient(135deg,#bbc6e2,#6b8cba)" : "#1f2a3f", color: i === 3 ? "#071327" : "#4a5a7a", fontFamily: "var(--font-space)" }}>
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex flex-col justify-center min-h-screen px-6 py-10 md:px-16 relative"
        style={{ background: "#0d1929" }}>

        <div className="pointer-events-none absolute top-0 right-0 w-[400px] h-[300px] opacity-[0.05] blur-[80px]"
          style={{ background: "radial-gradient(circle,#bbc6e2,transparent 70%)" }} />

        <div className="w-full max-w-sm mx-auto relative">

          {/* Tab toggle */}
          <div className="flex mb-8 p-1 rounded-xl" style={{ background: "#1f2a3f" }}>
            {(["login","register"] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(null); setSuccess(null); }}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                style={mode === m ? {
                  background: "linear-gradient(135deg,#0d1929,#162030)",
                  color: "#d7e2ff",
                  boxShadow: "0 1px 6px rgba(0,0,0,0.4)",
                  fontFamily: "var(--font-jakarta)",
                } : {
                  color: "#4a5a7a",
                  fontFamily: "var(--font-jakarta)",
                }}>
                {m === "login" ? "Masuk" : "Daftar"}
              </button>
            ))}
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-[#d7e2ff] mb-1"
              style={{ fontFamily: "var(--font-jakarta)" }}>
              {mode === "login" ? "Selamat Datang" : "Buat Akun Baru"}
            </h2>
            <p className="text-sm text-[#4a5a7a]">
              {mode === "login"
                ? "Masuk untuk melanjutkan perjalanan belajar kamu."
                : "Gratis selamanya. Upgrade kapan saja."}
            </p>
          </div>

          {/* Error / success */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-300"
              style={{ background: "rgba(192,80,80,0.12)", border: "1px solid rgba(192,80,80,0.2)" }}>
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm text-green-300"
              style={{ background: "rgba(94,168,122,0.12)", border: "1px solid rgba(94,168,122,0.2)" }}>
              {success}
            </div>
          )}

          {/* Form */}
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>

            {mode === "register" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-[#4a5a7a]"
                  style={{ fontFamily: "var(--font-space)" }}>NAMA PENGGUNA</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="namakamu"
                  className="w-full px-4 py-3 rounded-xl text-sm text-[#d7e2ff] placeholder-[#2a354b] outline-none transition-all"
                  style={{ background: "#1f2a3f", border: "1px solid rgba(187,198,226,0.08)", fontFamily: "var(--font-manrope)" }}
                  onFocus={e => e.currentTarget.style.borderColor = "rgba(107,156,218,0.4)"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(187,198,226,0.08)"}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-[#4a5a7a]"
                style={{ fontFamily: "var(--font-space)" }}>ALAMAT EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="kamu@email.com"
                required
                className="w-full px-4 py-3 rounded-xl text-sm text-[#d7e2ff] placeholder-[#2a354b] outline-none transition-all"
                style={{ background: "#1f2a3f", border: "1px solid rgba(187,198,226,0.08)", fontFamily: "var(--font-manrope)" }}
                onFocus={e => e.currentTarget.style.borderColor = "rgba(107,156,218,0.4)"}
                onBlur={e => e.currentTarget.style.borderColor = "rgba(187,198,226,0.08)"}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-[#4a5a7a]"
                  style={{ fontFamily: "var(--font-space)" }}>KATA SANDI</label>
                {mode === "login" && (
                  <a href="#" className="text-[11px] text-[#4a7abf] hover:text-[#6b9cda] transition-colors">
                    Lupa sandi?
                  </a>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-[#d7e2ff] placeholder-[#2a354b] outline-none transition-all"
                  style={{ background: "#1f2a3f", border: "1px solid rgba(187,198,226,0.08)", fontFamily: "var(--font-manrope)" }}
                  onFocus={e => e.currentTarget.style.borderColor = "rgba(107,156,218,0.4)"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(187,198,226,0.08)"}
                />
                <button type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4a5a7a] hover:text-[#8a9bbf] transition-colors">
                  {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all hover:brightness-110 mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg,#3a9a6a,#5ea87a)", boxShadow: "0 0 24px rgba(94,168,122,0.35)", fontFamily: "var(--font-jakarta)" }}>
              {loading
                ? <Loader2 className="size-4 animate-spin" />
                : <>{mode === "login" ? "Masuk" : "Buat Akun"} <ArrowRight className="size-4" /></>
              }
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
            <span className="text-xs text-[#2a354b]">atau masuk dengan</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
          </div>

          {/* Google OAuth */}
          <button onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl text-sm font-semibold text-[#8a9bbf] hover:text-[#d7e2ff] hover:bg-white/5 transition-all mb-7"
            style={{ background: "#1f2a3f", border: "1px solid rgba(187,198,226,0.06)", fontFamily: "var(--font-manrope)" }}>
            <span className="font-black text-base" style={{ fontFamily: "sans-serif" }}>G</span>
            Lanjutkan dengan Google
          </button>

          <p className="text-center text-sm text-[#4a5a7a]">
            {mode === "login" ? "Belum punya akun? " : "Sudah punya akun? "}
            <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); setSuccess(null); }}
              className="font-semibold text-[#6b9cda] hover:text-[#bbc6e2] transition-colors">
              {mode === "login" ? "Daftar Sekarang" : "Masuk"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
