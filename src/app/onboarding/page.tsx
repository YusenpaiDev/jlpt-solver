"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Lv = "N5" | "N4" | "N3" | "N2" | "N1";
const LV_NAME: Record<Lv, string> = { N5: "Pemula", N4: "Dasar", N3: "Menengah", N2: "Pra-mahir", N1: "Mahir" };
const LEVELS: { v: Lv; name: string; tag?: string; d: string }[] = [
  { v: "N5", name: "Pemula", d: "Hiragana-katakana lancar, kanji dasar (~100), sapaan sehari-hari." },
  { v: "N4", name: "Dasar", d: "Percakapan sederhana, ~300 kanji, grammar dasar lengkap." },
  { v: "N3", name: "Menengah", tag: "PALING RAME", d: "Jembatan ke level mahir — koran ringan, percakapan natural." },
  { v: "N2", name: "Pra-mahir", d: "Bahasa sehari-hari + bisnis. Syarat umum kerja di Jepang." },
  { v: "N1", name: "Mahir", d: "Nyaris native — teks akademik, nuansa halus, idiom." },
];
const GOALS = [
  { v: 10, t: "🌱 Santai", s: "10 menit · ~8 soal per hari" },
  { v: 20, t: "🔥 Rutin", s: "20 menit · ~15 soal per hari" },
  { v: 40, t: "⚡ Serius — 40+ menit", s: "~35 soal · buat yang deket ujian", wide: true },
];

/* Dua sesi JLPT terdekat (Juli & Desember, hari Minggu pertama — perkiraan). */
function upcomingExams(): { label: string; iso: string; days: number }[] {
  const now = new Date();
  const out: { label: string; iso: string; days: number }[] = [];
  for (let y = now.getFullYear(); y <= now.getFullYear() + 2 && out.length < 2; y++) {
    for (const m of [7, 12]) {
      const d = new Date(y, m - 1, 1);
      if (d.getTime() < now.getTime()) continue;
      const days = Math.round((d.getTime() - now.getTime()) / 86_400_000);
      out.push({ label: `${m === 7 ? "Juli" : "Desember"} ${y}`, iso: `${y}-${String(m).padStart(2, "0")}`, days });
      if (out.length >= 2) break;
    }
  }
  return out;
}

const LS_KEY = "jlpt-onboarding-v1";
const CONFETTI = ["#DD4124", "#E8704F", "#D4A04A", "#8FCB52", "#F0B49A"];
// Posisi confetti deterministik (dihitung sekali, bukan pas render) — biar
// lolos rule purity React & gak micu re-render.
const CONFETTI_PIECES = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37 + 7) % 100,
  bg: CONFETTI[i % CONFETTI.length],
  delay: ((i * 7) % 18) / 10,
}));

export default function Onboarding() {
  const router = useRouter();
  const [exams, setExams] = useState<{ label: string; iso: string; days: number }[]>([]);
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<Lv | null>(null);
  const [examIso, setExamIso] = useState<string | null>(null);
  const [goal, setGoal] = useState<number | null>(20);
  const [saved, setSaved] = useState(false);

  // Init browser-only (tanggal ujian pakai Date + resume localStorage). Dibungkus
  // fungsi biar lolos rule "no sync setState in effect" (pola sama kayak page lain).
  useEffect(() => {
    async function init() {
      setExams(upcomingExams());
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return;
        const s = JSON.parse(raw);
        if (s.level) setLevel(s.level);
        if (s.examIso !== undefined) setExamIso(s.examIso);
        if (s.goal !== undefined) setGoal(s.goal);
        if (typeof s.step === "number") setStep(Math.min(s.step, 4));
      } catch { /* ignore */ }
    }
    init();
  }, []);
  // Persist step ke localStorage (biar refresh lanjut)
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ step, level, examIso, goal }));
  }, [step, level, examIso, goal]);

  const skippable = step === 2 || step === 3;

  const persist = async () => {
    if (saved) return;
    setSaved(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.auth.updateUser({
        data: {
          target_level: level,
          exam_date: examIso,
          daily_goal_minutes: goal,
          onboarding_completed: true,
        },
      });

      /* Tulis ke tabel juga, jangan cuma ke metadata. Dulu cuma metadata, dan
         trigger handle_new_user() gak nyalin target_level — jadi kolom di
         profiles nyangkut di default 'N3' buat semua orang, dan halaman yang
         baca tabel nampilin level yang gak pernah dipilih user. */
      if (user) {
        await supabase.from("profiles").update({ target_level: level }).eq("id", user.id);
      }

      localStorage.removeItem(LS_KEY);
    } catch { /* biarin — user tetap bisa lanjut */ }
  };

  const go = (n: number) => {
    setStep(n);
    if (n === 4) persist();
  };
  const finish = (dest: string) => { router.replace(dest); };

  const selExam = exams.find(e => e.iso === examIso);

  return (
    <div className="ob-page">
      <div className="ob-frame">
        <div className="ob-bar">
          <div className="ob-dots">
            {[0, 1, 2, 3, 4].map(i => <span key={i} className={`ob-dt${i < step ? " done" : i === step ? " on" : ""}`} />)}
          </div>
          {skippable && <button className="ob-skip" onClick={() => go(Math.min(step + 1, 4))}>Lewati</button>}
        </div>

        <div className="ob-card">
          {/* STEP 0 — Welcome */}
          {step === 0 && (
            <section className="ob-step">
              <div className="ob-wart">
                <div className="ob-wmark">解</div>
                <div><div className="ob-wname">JLPT <span>Solver</span></div><div className="ob-wtag">日本語能力試験 · AI study buddy</div></div>
              </div>
              <h1 className="ob-h1">Selamat datang! 👋</h1>
              <p className="ob-sub">Foto soal, AI yang jelasin. Sebelum mulai, siapin dulu profil belajarmu — <b>1 menit aja</b>, dan semua bisa diganti nanti di Pengaturan.</p>
              <div className="ob-feat">
                <div className="ob-wf"><span className="ob-wfic">📷</span>Upload foto soal → dapet jawaban + pembahasan</div>
                <div className="ob-wf"><span className="ob-wfic">✍️</span>Bank Soal 過去問 asli per level</div>
                <div className="ob-wf"><span className="ob-wfic">🎧</span>Latihan listening 聴解 dengan audio</div>
                <div className="ob-wf"><span className="ob-wfic">📖</span>Kamus kotoba pribadi + flashcard</div>
              </div>
              <div className="ob-foot"><button className="ob-btn ob-btn-p" onClick={() => go(1)}>Mulai →</button></div>
            </section>
          )}

          {/* STEP 1 — Level (wajib) */}
          {step === 1 && (
            <section className="ob-step">
              <h1 className="ob-h1">Lagi ngejar level apa?</h1>
              <p className="ob-sub">Semua soal, kanji harian, dan rekomendasi bakal disesuaiin ke level ini. <b>Bisa diganti kapan aja</b> di Pengaturan.</p>
              <div className="ob-lvls">
                {LEVELS.map(l => (
                  <button key={l.v} className={`ob-lv${level === l.v ? " sel" : ""}`} onClick={() => setLevel(l.v)}>
                    <span className="ob-lvg">{l.v}</span>
                    <span><span className="ob-lvn">{l.name}{l.tag && <span className="ob-lvtag">{l.tag}</span>}</span><span className="ob-lvd">{l.d}</span></span>
                    <span className="ob-lvr" />
                  </button>
                ))}
              </div>
              <div className="ob-foot"><button className="ob-back" onClick={() => go(0)}>← Balik</button><button className="ob-btn ob-btn-p" disabled={!level} onClick={() => go(2)}>Lanjut →</button></div>
            </section>
          )}

          {/* STEP 2 — Exam date (skip) */}
          {step === 2 && (
            <section className="ob-step">
              <div className="ob-glyph">試験</div>
              <h1 className="ob-h1">Udah ada rencana ikut ujian?</h1>
              <p className="ob-sub">Kalau udah, Beranda bakal nampilin countdown menuju hari-H biar makin kepacu.</p>
              <div className="ob-chips">
                {exams.map(e => (
                  <button key={e.iso} className={`ob-chip${examIso === e.iso ? " sel" : ""}`} onClick={() => setExamIso(e.iso)}>
                    <div className="ob-cht">{e.label}</div><div className="ob-chs">≈ {e.days} hari lagi</div>
                  </button>
                ))}
                <button className={`ob-chip wide${examIso === "none" ? " sel" : ""}`} onClick={() => setExamIso("none")}>
                  <div className="ob-cht">Belum tau / cuma belajar dulu</div>
                </button>
              </div>
              <div className="ob-foot"><button className="ob-back" onClick={() => go(1)}>← Balik</button><button className="ob-btn ob-btn-p" onClick={() => go(3)}>Lanjut →</button></div>
            </section>
          )}

          {/* STEP 3 — Daily goal (skip) */}
          {step === 3 && (
            <section className="ob-step">
              <div className="ob-glyph">毎日</div>
              <h1 className="ob-h1">Berapa lama mau latihan tiap hari?</h1>
              <p className="ob-sub">Buat ngatur target streak & jumlah soal Latihan Kilat harianmu.</p>
              <div className="ob-chips">
                {GOALS.map(g => (
                  <button key={g.v} className={`ob-chip${g.wide ? " wide" : ""}${goal === g.v ? " sel" : ""}`} onClick={() => setGoal(g.v)}>
                    <div className="ob-cht">{g.t}</div><div className="ob-chs">{g.s}</div>
                  </button>
                ))}
              </div>
              <div className="ob-foot"><button className="ob-back" onClick={() => go(2)}>← Balik</button><button className="ob-btn ob-btn-p" onClick={() => go(4)}>Lanjut →</button></div>
            </section>
          )}

          {/* STEP 4 — Done */}
          {step === 4 && (
            <section className="ob-step">
              <div className="ob-confetti">
                {CONFETTI_PIECES.map((c, i) => (
                  <span key={i} className="ob-cf" style={{ left: `${c.left}%`, background: c.bg, animationDelay: `${c.delay}s` }} />
                ))}
              </div>
              <div className="ob-glyph">頑張って!</div>
              <h1 className="ob-h1">Siap berangkat 🎌</h1>
              <p className="ob-sub">Profil belajarmu udah kesimpen. Mulai dari mana nih?</p>
              <div className="ob-sum">
                <div className="ob-sumr"><span className="k">TARGET LEVEL</span><span className="v">{level ? `${level} — ${LV_NAME[level]}` : "—"}</span></div>
                {selExam && <div className="ob-sumr"><span className="k">UJIAN</span><span className="v">{selExam.label} <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>· {selExam.days} hari lagi</span></span></div>}
                {goal && <div className="ob-sumr"><span className="k">TARGET HARIAN</span><span className="v">{GOALS.find(g => g.v === goal)?.t} — {goal} menit/hari</span></div>}
              </div>
              <div className="ob-donecta">
                <button className="ob-btn ob-btn-p" onClick={() => finish("/materi")}>▶ Mulai belajar materi</button>
                <button className="ob-btn ob-btn-g" onClick={() => finish("/")}>Buka Beranda</button>
              </div>
              <div className="ob-hintset">Semua bisa diganti di Pengaturan → Target belajar</div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
