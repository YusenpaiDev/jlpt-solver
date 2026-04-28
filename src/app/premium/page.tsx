"use client";

import { useState } from "react";
import {
  Sparkles, Check, X, Zap, ArrowRight, Camera, BarChart2,
  BookOpen, Flame, Brain, Shield, Headphones, Star, Loader2,
} from "lucide-react";

/* ─── Midtrans Snap types ─────────────────────────────────────── */
declare global {
  interface Window {
    snap?: {
      pay: (token: string, options?: {
        onSuccess?: (result: unknown) => void;
        onPending?: (result: unknown) => void;
        onError?: (result: unknown) => void;
        onClose?: () => void;
      }) => void;
    };
  }
}

/* ─── Plan data ───────────────────────────────────────────────── */
const plans = [
  {
    id: "gratis",
    name: "Gratis",
    desc: "Untuk mulai belajar JLPT",
    priceMonthly: 0,
    priceYearly: 0,
    yearlyTotal: 0,
    accent: "#4a5a7a",
    gradient: "linear-gradient(135deg,#1f2a3f,#101b30)",
    cta: "Mulai Gratis",
    ctaStyle: { background: "#1f2a3f", color: "#bbc6e2" },
    popular: false,
    features: [
      { text: "15 analisis foto per bulan",       ok: true  },
      { text: "Kamus dasar (N5–N4)",              ok: true  },
      { text: "Statistik mingguan",               ok: true  },
      { text: "Latihan kilat harian",             ok: true  },
      { text: "Analisis foto unlimited",          ok: false },
      { text: "Statistik detail & heatmap",       ok: false },
      { text: "Kamus lengkap N1–N5",              ok: false },
      { text: "Lembar tugas otomatis",            ok: false },
      { text: "Mock test N1–N5",                  ok: false },
      { text: "Konsultasi soal 1-on-1",           ok: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    desc: "Untuk belajar serius setiap hari",
    priceMonthly: 49000,
    priceYearly: 33000,
    yearlyTotal: 399000,
    accent: "#6b9cda",
    gradient: "linear-gradient(135deg,#1a3a6f,#0f1a2e)",
    cta: "Mulai Pro",
    ctaStyle: { background: "linear-gradient(135deg,#4a7abf,#6b9cda)", color: "#fff" },
    popular: true,
    features: [
      { text: "Analisis foto unlimited",          ok: true  },
      { text: "Kamus lengkap N1–N5",              ok: true  },
      { text: "Statistik detail & heatmap",       ok: true  },
      { text: "Lembar tugas otomatis AI",         ok: true  },
      { text: "Spaced repetition review",         ok: true  },
      { text: "Streak & sistem XP",               ok: true  },
      { text: "Laporan progres PDF",              ok: true  },
      { text: "Mock test N1–N5",                  ok: false },
      { text: "Analisis kesalahan mendalam AI",   ok: false },
      { text: "Konsultasi soal 1-on-1",           ok: false },
    ],
  },
  {
    id: "sensei",
    name: "Sensei",
    desc: "Untuk yang ingin lulus dengan pasti",
    priceMonthly: 149000,
    priceYearly: 67000,
    yearlyTotal: 799000,
    accent: "#bbc6e2",
    gradient: "linear-gradient(135deg,#2a1a4f,#0f0a25)",
    cta: "Jadi Sensei",
    ctaStyle: { background: "linear-gradient(135deg,#bbc6e2,#6b8cba)", color: "#071327" },
    popular: false,
    features: [
      { text: "Analisis foto unlimited",          ok: true  },
      { text: "Kamus lengkap N1–N5",              ok: true  },
      { text: "Statistik detail & heatmap",       ok: true  },
      { text: "Lembar tugas otomatis AI",         ok: true  },
      { text: "Spaced repetition review",         ok: true  },
      { text: "Streak & sistem XP",               ok: true  },
      { text: "Laporan progres PDF",              ok: true  },
      { text: "Mock test N1–N5 lengkap",          ok: true  },
      { text: "Analisis kesalahan mendalam AI",   ok: true  },
      { text: "Konsultasi soal 1-on-1",           ok: true  },
    ],
  },
];

/* ─── Feature highlights ──────────────────────────────────────── */
const highlights = [
  { icon: Camera,     label: "Analisis Foto AI",      desc: "Upload soal, AI jelaskan grammar & vocab secara instan",       color: "#4a7abf" },
  { icon: BarChart2,  label: "Statistik Mendalam",    desc: "Heatmap aktivitas, akurasi per kategori, spaced repetition",   color: "#5ea87a" },
  { icon: BookOpen,   label: "Kamus N1–N5 Lengkap",   desc: "8.000+ kata dengan contoh kalimat, furigana, dan stroke order", color: "#a67bd4" },
  { icon: Brain,      label: "Lembar Tugas Otomatis", desc: "AI buat soal latihan berdasarkan kelemahanmu",                  color: "#e07b4a" },
  { icon: Flame,      label: "Streak & Gamifikasi",   desc: "Jaga motivasi dengan streak harian dan sistem XP",              color: "#c05abf" },
  { icon: Shield,     label: "Progres Tersimpan",     desc: "Data belajarmu tersimpan aman dan bisa diakses dari mana saja", color: "#6b9cda" },
];

/* ─── FAQ ─────────────────────────────────────────────────────── */
const faqs = [
  { q: "Apakah bisa cancel kapan saja?",              a: "Ya, kamu bisa cancel langganan kapan saja tanpa biaya tambahan. Akses Pro tetap aktif sampai akhir periode." },
  { q: "Metode pembayaran apa yang tersedia?",        a: "Transfer bank, GoPay, OVO, Dana, QRIS, dan kartu kredit/debit Visa/Mastercard." },
  { q: "Apa bedanya Pro dan Sensei?",                 a: "Sensei menambahkan laporan progres PDF bulanan dan akses prioritas ke tim dukungan kami." },
  { q: "Ada trial gratis untuk Pro?",                 a: "Ya! Kamu bisa coba Pro gratis selama 7 hari tanpa perlu memasukkan info pembayaran." },
];


export default function Premium() {
  const [yearly,    setYearly]    = useState(false);
  const [openFaq,   setOpenFaq]   = useState<number | null>(null);
  const [paying,    setPaying]    = useState<string | null>(null); // planId being processed
  const [snapError, setSnapError] = useState<string | null>(null);

  // TODO: load Midtrans/Xendit Snap.js di sini saat API key sudah siap

  const handlePay = async (planId: string) => {
    setSnapError(null);
    setPaying(planId);
    // TODO: ganti dengan Midtrans/Xendit saat API key sudah siap
    await new Promise(r => setTimeout(r, 2000));
    window.location.href = "/premium/sukses";
  };

  return (
    <div className="min-h-screen text-[#d7e2ff]"
      style={{ fontFamily: "var(--font-manrope)" }}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-8 py-4 sticky top-0 z-10"
        style={{ background: "rgba(7,19,39,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-lg flex items-center justify-center text-xs font-black text-[#071327]"
            style={{ background: "linear-gradient(135deg,#bbc6e2,#6b8cba)" }}>S</div>
          <div>
            <p className="text-sm font-bold text-[#d7e2ff] leading-none"
              style={{ fontFamily: "var(--font-jakarta)" }}>Sensei JLPT</p>
            <p className="text-[9px] text-[#4a5a7a] tracking-widest"
              style={{ fontFamily: "var(--font-space)" }}>THE INTELLIGENT SENSEI</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href="/" className="text-sm text-[#8a9bbf] hover:text-[#d7e2ff] transition-colors">Beranda</a>
          <button className="text-sm px-4 py-2 rounded-full font-semibold transition-all hover:brightness-110"
            style={{ background: "linear-gradient(135deg,#bbc6e2,#6b8cba)", color: "#071327", fontFamily: "var(--font-space)", fontSize: "11px" }}>
            MULAI GRATIS
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 pb-24">

        {/* ── Hero ── */}
        <div className="text-center pt-20 pb-16 relative">
          {/* glow blobs */}
          <div className="pointer-events-none absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[300px] opacity-[0.07] blur-[80px]"
            style={{ background: "radial-gradient(circle,#6b8cba,transparent 70%)" }} />

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
            style={{ background: "#101b30" }}>
            <Sparkles className="size-3 text-[#bbc6e2]" />
            <span className="text-[10px] font-semibold text-[#bbc6e2]"
              style={{ fontFamily: "var(--font-space)" }}>PILIH PLAN KAMU</span>
          </div>

          <h1 className="text-[3.2rem] font-extrabold leading-[1.1] tracking-tight mb-4"
            style={{ fontFamily: "var(--font-jakarta)" }}>
            Belajar JLPT tanpa batas,{" "}
            <span style={{
              background: "linear-gradient(135deg,#6b9cda,#bbc6e2,#a67bd4)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              lulus lebih cepat.
            </span>
          </h1>
          <p className="text-base text-[#8a9bbf] max-w-lg mx-auto leading-relaxed mb-8">
            Mulai gratis, upgrade kapan saja. Tidak ada kontrak, tidak ada biaya tersembunyi.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 p-1 rounded-full"
            style={{ background: "#101b30" }}>
            <button onClick={() => setYearly(false)}
              className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={!yearly ? { background: "#1f2a3f", color: "#d7e2ff" } : { color: "#4a5a7a" }}>
              Bulanan
            </button>
            <button onClick={() => setYearly(true)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={yearly ? { background: "#1f2a3f", color: "#d7e2ff" } : { color: "#4a5a7a" }}>
              Tahunan
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: "rgba(94,168,122,0.2)", color: "#5ea87a", fontFamily: "var(--font-space)" }}>
                HEMAT 20%
              </span>
            </button>
          </div>
        </div>

        {/* ── Error banner ── */}
        {snapError && (
          <div className="mb-6 px-5 py-3 rounded-2xl text-sm text-red-300 flex items-center gap-3"
            style={{ background: "rgba(192,80,80,0.12)", border: "1px solid rgba(192,80,80,0.25)" }}>
            <X className="size-4 shrink-0 text-red-400" />
            {snapError}
            <button onClick={() => setSnapError(null)} className="ml-auto text-red-400 hover:text-red-300">
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* ── Pricing cards ── */}
        <div className="grid grid-cols-3 gap-5 mb-20">
          {plans.map(plan => {
            const planKey = plan.id === "gratis" ? null
              : `${plan.id}-${yearly ? "yearly" : "monthly"}`;
            const isLoading = paying === planKey;

            return (
            <div key={plan.id}
              className="flex flex-col rounded-2xl overflow-hidden relative"
              style={{
                background: plan.gradient,
                boxShadow: plan.popular ? `0 0 40px ${plan.accent}25` : "none",
                border: plan.popular ? `1px solid ${plan.accent}40` : "1px solid rgba(255,255,255,0.04)",
              }}>

              {plan.popular && (
                <div className="absolute top-0 inset-x-0 h-0.5"
                  style={{ background: `linear-gradient(90deg,transparent,${plan.accent},transparent)` }} />
              )}

              {plan.popular && (
                <div className="absolute -top-px left-1/2 -translate-x-1/2">
                  <div className="px-3 py-1 rounded-b-lg text-[10px] font-bold"
                    style={{ background: plan.accent, color: "#071327", fontFamily: "var(--font-space)" }}>
                    PALING POPULER
                  </div>
                </div>
              )}

              <div className="p-6 flex flex-col flex-1">
                {/* Plan header */}
                <div className="mb-6 mt-2">
                  <p className="text-xs font-bold mb-1" style={{ color: plan.accent, fontFamily: "var(--font-space)" }}>
                    {plan.name.toUpperCase()}
                  </p>
                  <p className="text-xs text-[#4a5a7a] mb-5">{plan.desc}</p>

                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-extrabold text-[#d7e2ff]"
                      style={{ fontFamily: "var(--font-jakarta)" }}>
                      {plan.priceMonthly === 0
                        ? "Rp 0"
                        : `Rp ${(yearly ? plan.priceYearly : plan.priceMonthly).toLocaleString("id-ID")}`}
                    </span>
                    {plan.priceMonthly > 0 && (
                      <span className="text-xs text-[#4a5a7a] mb-1.5">/bln</span>
                    )}
                  </div>
                  {plan.priceMonthly > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      {yearly ? (
                        <>
                          <p className="text-[10px] text-[#4a5a7a]">
                            Ditagih Rp {plan.yearlyTotal.toLocaleString("id-ID")}/tahun
                          </p>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                            style={{ background: "rgba(94,168,122,0.15)", color: "#5ea87a", fontFamily: "var(--font-space)" }}>
                            HEMAT {Math.round((1 - plan.priceYearly / plan.priceMonthly) * 100)}%
                          </span>
                        </>
                      ) : (
                        <p className="text-[10px] text-[#4a5a7a]">
                          atau Rp {plan.yearlyTotal.toLocaleString("id-ID")}/tahun
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* CTA */}
                <button
                  onClick={() => planKey && handlePay(planKey)}
                  disabled={isLoading || !!paying}
                  className="w-full py-2.5 rounded-xl text-sm font-bold mb-6 transition-all hover:brightness-110 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ ...plan.ctaStyle, fontFamily: "var(--font-jakarta)" }}>
                  {isLoading
                    ? <><Loader2 className="size-3.5 animate-spin" /> Memproses...</>
                    : <>{plan.cta} <ArrowRight className="size-3.5" /></>}
                </button>

                {/* Features */}
                <div className="flex flex-col gap-2.5 flex-1">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      {f.ok
                        ? <Check className="size-3.5 mt-0.5 shrink-0" style={{ color: plan.accent }} />
                        : <X className="size-3.5 mt-0.5 shrink-0 text-[#2a354b]" />
                      }
                      <span className={`text-xs leading-relaxed ${f.ok ? "text-[#8a9bbf]" : "text-[#2a354b]"}`}>
                        {f.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ); })}
        </div>

        {/* ── Feature highlights ── */}
        <div className="mb-20">
          <div className="text-center mb-10">
            <p className="text-[10px] font-semibold text-[#4a5a7a] mb-3"
              style={{ fontFamily: "var(--font-space)" }}>SEMUA YANG KAMU BUTUHKAN</p>
            <h2 className="text-2xl font-extrabold text-[#d7e2ff]"
              style={{ fontFamily: "var(--font-jakarta)" }}>
              Fitur yang bikin belajar terasa beda
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {highlights.map(({ icon: Icon, label, desc, color }) => (
              <div key={label} className="p-5 rounded-2xl relative overflow-hidden"
                style={{ background: "#101b30" }}>
                <div className="absolute inset-0 opacity-10"
                  style={{ background: `radial-gradient(circle at top left,${color},transparent 70%)` }} />
                <div className="relative">
                  <div className="size-9 rounded-xl flex items-center justify-center mb-3"
                    style={{ background: `${color}20` }}>
                    <Icon className="size-4" style={{ color }} />
                  </div>
                  <p className="text-sm font-bold text-[#d7e2ff] mb-1.5"
                    style={{ fontFamily: "var(--font-jakarta)" }}>{label}</p>
                  <p className="text-xs text-[#4a5a7a] leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Testimonials ── */}
        <div className="mb-20">
          <div className="text-center mb-10">
            <p className="text-[10px] font-semibold text-[#4a5a7a] mb-3"
              style={{ fontFamily: "var(--font-space)" }}>TESTIMONI NYATA</p>
            <h2 className="text-2xl font-extrabold text-[#d7e2ff]"
              style={{ fontFamily: "var(--font-jakarta)" }}>
              Mereka sudah lulus. Sekarang giliranmu.
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { name: "Rizki A.", level: "Lulus N3", score: "142/180", avatar: "R", color: "#4a7abf",
                text: "Dalam 3 bulan pakai Sensei JLPT, analisis foto soalnya bikin aku ngerti grammar yang selama ini bingung." },
              { name: "Putri N.", level: "Lulus N2", score: "155/180", avatar: "P", color: "#5ea87a",
                text: "Statistik detail dan heatmap-nya bikin aku tahu persis mana yang harus difokus. Worth banget!" },
              { name: "Dimas K.", level: "Target N1", score: "Pro User", avatar: "D", color: "#a67bd4",
                text: "Kamus dengan stroke order dan quiz cepat-nya beda level dibanding app lain. Gak menyesal upgrade." },
            ].map(({ name, level, score, avatar, color, text }) => (
              <div key={name} className="p-5 rounded-2xl relative overflow-hidden"
                style={{ background: "#101b30" }}>
                <div className="absolute inset-0 opacity-10"
                  style={{ background: `radial-gradient(circle at bottom right,${color},transparent 70%)` }} />
                <div className="relative">
                  <div className="flex gap-0.5 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="size-3 fill-[#f59e0b] text-[#f59e0b]" />
                    ))}
                  </div>
                  <p className="text-xs text-[#8a9bbf] leading-relaxed mb-4">"{text}"</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: `linear-gradient(135deg,${color},${color}99)` }}>{avatar}</div>
                      <div>
                        <p className="text-xs font-bold text-[#d7e2ff]"
                          style={{ fontFamily: "var(--font-jakarta)" }}>{name}</p>
                        <p className="text-[10px] text-[#4a5a7a]">{level}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full"
                      style={{ background: `${color}20`, color, fontFamily: "var(--font-space)" }}>
                      {score}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQ ── */}
        <div className="mb-20">
          <div className="text-center mb-10">
            <p className="text-[10px] font-semibold text-[#4a5a7a] mb-3"
              style={{ fontFamily: "var(--font-space)" }}>FAQ</p>
            <h2 className="text-2xl font-extrabold text-[#d7e2ff]"
              style={{ fontFamily: "var(--font-jakarta)" }}>Pertanyaan yang sering ditanya</h2>
          </div>
          <div className="flex flex-col gap-3 max-w-2xl mx-auto">
            {faqs.map((faq, i) => (
              <button key={i} onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="text-left p-5 rounded-2xl transition-all"
                style={{ background: "#101b30" }}>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-[#d7e2ff]"
                    style={{ fontFamily: "var(--font-jakarta)" }}>{faq.q}</p>
                  <span className="size-5 rounded-full flex items-center justify-center shrink-0 text-sm"
                    style={{ background: "#1f2a3f", color: "#4a5a7a" }}>
                    {openFaq === i ? "−" : "+"}
                  </span>
                </div>
                {openFaq === i && (
                  <p className="text-xs text-[#8a9bbf] leading-relaxed mt-3">{faq.a}</p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Bottom CTA ── */}
        <div className="text-center py-16 px-8 rounded-3xl relative overflow-hidden"
          style={{ background: "#101b30" }}>
          <div className="pointer-events-none absolute inset-0 opacity-10"
            style={{ background: "radial-gradient(circle at center,#6b8cba,transparent 70%)" }} />
          <div className="pointer-events-none absolute top-0 inset-x-0 h-px"
            style={{ background: "linear-gradient(90deg,transparent,#bbc6e2,transparent)" }} />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
              style={{ background: "#1f2a3f" }}>
              <Headphones className="size-3 text-[#bbc6e2]" />
              <span className="text-[10px] font-semibold text-[#bbc6e2]"
                style={{ fontFamily: "var(--font-space)" }}>7 HARI TRIAL GRATIS</span>
            </div>
            <h2 className="text-3xl font-extrabold text-[#d7e2ff] mb-3"
              style={{ fontFamily: "var(--font-jakarta)" }}>
              Siap taklukan JLPT?
            </h2>
            <p className="text-sm text-[#8a9bbf] mb-8">
              Coba Pro gratis 7 hari. Tidak perlu kartu kredit.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button className="flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-sm transition-all hover:brightness-110"
                style={{ background: "linear-gradient(135deg,#bbc6e2,#6b8cba)", color: "#071327", fontFamily: "var(--font-jakarta)" }}>
                <Zap className="size-4" /> Mulai Trial Gratis
              </button>
              <button className="px-7 py-3 rounded-xl text-sm font-semibold transition-all hover:bg-white/5"
                style={{ border: "1px solid rgba(255,255,255,0.08)", color: "#8a9bbf" }}>
                Lihat Demo
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
