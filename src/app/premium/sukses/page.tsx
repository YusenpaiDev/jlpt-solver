"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";

export default function PremiumSukses() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center text-[#d7e2ff]"
      style={{ background: "#071327", fontFamily: "var(--font-manrope)" }}>

      {/* ambient glow */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.06] blur-[100px]"
        style={{ background: "radial-gradient(circle at 50% 40%,#5ea87a,transparent 60%)" }} />

      <div className="relative text-center flex flex-col items-center gap-6 px-8 max-w-md"
        style={{
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
        }}>

        {/* Icon */}
        <div className="size-20 rounded-full flex items-center justify-center relative"
          style={{ background: "rgba(94,168,122,0.15)", border: "1px solid rgba(94,168,122,0.3)" }}>
          <div className="absolute inset-0 rounded-full"
            style={{ boxShadow: "0 0 40px rgba(94,168,122,0.3)" }} />
          <CheckCircle2 className="size-9 text-[#5ea87a] relative" />
        </div>

        {/* Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ background: "#101b30" }}>
          <Sparkles className="size-3 text-[#bbc6e2]" />
          <span className="text-[10px] font-semibold text-[#bbc6e2]"
            style={{ fontFamily: "var(--font-space)" }}>PEMBAYARAN BERHASIL</span>
        </div>

        {/* Heading */}
        <div>
          <h1 className="text-[2.5rem] font-extrabold leading-tight mb-2"
            style={{ fontFamily: "var(--font-jakarta)" }}>
            Selamat! Kamu{" "}
            <span style={{
              background: "linear-gradient(135deg,#5ea87a,#bbc6e2)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              sudah Pro.
            </span>
          </h1>
          <p className="text-sm text-[#8a9bbf] leading-relaxed">
            Akses premium kamu sudah aktif. Selamat belajar — semoga lulus JLPT dengan nilai terbaik! 🎌
          </p>
        </div>

        {/* What's unlocked */}
        <div className="w-full p-5 rounded-2xl text-left"
          style={{ background: "#101b30", border: "1px solid rgba(94,168,122,0.15)" }}>
          <p className="text-[10px] font-bold text-[#5ea87a] mb-3" style={{ fontFamily: "var(--font-space)" }}>
            YANG SUDAH TERBUKA UNTUKMU
          </p>
          <div className="flex flex-col gap-2">
            {[
              "Analisis foto unlimited tanpa batas",
              "Kamus lengkap N1–N5 dengan stroke order",
              "Statistik detail & heatmap progres",
              "Lembar tugas otomatis dari AI",
              "Spaced repetition untuk review kosakata",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2.5">
                <CheckCircle2 className="size-3.5 shrink-0 text-[#5ea87a]" />
                <span className="text-xs text-[#8a9bbf]">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3 w-full">
          <a href="/analisis-foto"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110"
            style={{ background: "linear-gradient(135deg,#3a8a5a,#5ea87a)", color: "#fff", fontFamily: "var(--font-jakarta)" }}>
            Mulai Belajar <ArrowRight className="size-4" />
          </a>
          <a href="/"
            className="px-5 py-3 rounded-xl text-sm font-semibold transition-all hover:bg-white/5"
            style={{ border: "1px solid rgba(255,255,255,0.08)", color: "#8a9bbf" }}>
            Beranda
          </a>
        </div>
      </div>
    </div>
  );
}
