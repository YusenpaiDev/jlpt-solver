"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Mail, Lock, Eye, EyeOff, User as UserIcon, ArrowRight, Check, Sparkles,
  Shield, Zap, AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground } from "@/components/v2";

type Mode = "signin" | "signup";
type Level = "N5" | "N4" | "N3" | "N2" | "N1";

export default function Login() {
  const [mode, setMode] = useState<Mode>("signin");
  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [targetLevel, setTargetLevel] = useState<Level>("N2");
  const [agreed, setAgreed] = useState(true);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Full navigation (bukan router.push) — jaminan cookie auth kekirim ke
        // server dulu, jadi middleware langsung liat user (gak perlu refresh manual).
        window.location.assign("/");
        return;
      } else {
        if (!agreed) {
          setError("Setujui syarat & privasi dulu.");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: username || email.split("@")[0], target_level: targetLevel } },
        });
        if (error) throw error;
        setSuccess("Cek email kamu untuk konfirmasi akun, lalu masuk.");
        setMode("signin");
        setPassword("");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
      if (msg.includes("Invalid login credentials")) setError("Email atau password salah.");
      else if (msg.includes("Email not confirmed")) setError("Email belum dikonfirmasi. Cek inbox kamu untuk link konfirmasi.");
      else if (msg.includes("User already registered")) setError("Email sudah terdaftar. Silakan masuk.");
      else if (msg.includes("Password should be")) setError("Password minimal 6 karakter.");
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  const passwordStrength = password.length === 0 ? 0
    : password.length < 6 ? 1
    : password.length < 8 ? 2
    : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 3
    : 2;

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setSuccess(null);
  };

  return (
    <>
      <AuroraBackground />
      <div className="lg-shell">
        <main className="lg-form-pane">
          <Link href="/" className="lg-brand">
            <div className="lg-brand-mark">先</div>
            <div className="lg-brand-text">
              <span className="lg-brand-name">Sensei</span>
              <span className="lg-brand-tag">JLPT · AI</span>
            </div>
          </Link>

          <div className="lg-tabs">
            <button
              type="button"
              className={`lg-tab${mode === "signin" ? " on" : ""}`}
              onClick={() => switchMode("signin")}
            >
              Masuk
            </button>
            <button
              type="button"
              className={`lg-tab${mode === "signup" ? " on" : ""}`}
              onClick={() => switchMode("signup")}
            >
              Daftar
              <span className="lg-tab-pill">Gratis</span>
            </button>
          </div>

          <div className="lg-form-wrap">
            {mode === "signin" ? (
              <>
                <h1 className="lg-title">Selamat datang kembali.</h1>
                <p className="lg-sub">
                  Lanjutkan progres belajarmu — tinggal sedikit lagi ke target JLPT.
                </p>
              </>
            ) : (
              <>
                <h1 className="lg-title">Mulai belajar smart.</h1>
                <p className="lg-sub">
                  Gratis selamanya — 10 analisis foto/hari + 50 kotoba. Upgrade kapan aja.
                </p>
              </>
            )}

            {error && (
              <div className="lg-error">
                <AlertCircle size={14} strokeWidth={1.8} /> {error}
              </div>
            )}
            {success && (
              <div className="lg-success">
                <Check size={14} strokeWidth={2.2} /> {success}
              </div>
            )}

            <div className="lg-social">
              <button
                type="button"
                className="lg-social-btn"
                onClick={handleGoogle}
                disabled={loading}
              >
                <GoogleLogo />
                {mode === "signin" ? "Lanjut" : "Daftar"} dengan Google
              </button>
            </div>

            <div className="lg-divider">
              <span>atau pakai email</span>
            </div>

            <form className="lg-form" onSubmit={handleSubmit}>
              {mode === "signup" && (
                <FormField label="Nama">
                  <span className="lg-field-icon"><UserIcon size={14} /></span>
                  <input
                    type="text"
                    placeholder="Nama lengkap kamu"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoFocus
                  />
                </FormField>
              )}
              <FormField label="Email">
                <span className="lg-field-icon"><Mail size={14} /></span>
                <input
                  type="email"
                  placeholder="kamu@gmail.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoFocus={mode === "signin"}
                  required
                />
              </FormField>
              <FormField
                label="Password"
                footer={
                  mode === "signin"
                    ? <button type="button" className="lg-forgot">Lupa password?</button>
                    : (password.length > 0
                        ? <PasswordStrength level={passwordStrength} />
                        : <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Minimal 8 karakter, kombinasi huruf besar + angka</span>)
                }
              >
                <span className="lg-field-icon"><Lock size={14} /></span>
                <input
                  type={showPass ? "text" : "password"}
                  placeholder={mode === "signin" ? "••••••••" : "Minimal 8 karakter"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="lg-eye"
                  onClick={() => setShowPass(p => !p)}
                  aria-label={showPass ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </FormField>

              {mode === "signup" && (
                <div className="lg-field">
                  <label className="lg-field-label">Target level JLPT</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                    {(["N5", "N4", "N3", "N2", "N1"] as Level[]).map(lv => (
                      <button
                        key={lv}
                        type="button"
                        className={`pg-lv-tile${targetLevel === lv ? " on" : ""}`}
                        onClick={() => setTargetLevel(lv)}
                        style={{ padding: 10 }}
                      >
                        <span className="pg-lv-letter" style={{ fontSize: 14 }}>{lv}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mode === "signin" ? (
                <label className="lg-remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                  />
                  <span>Tetap login di device ini</span>
                </label>
              ) : (
                <label className="lg-remember">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={e => setAgreed(e.target.checked)}
                  />
                  <span>
                    Setuju dengan <a href="#" onClick={e => e.preventDefault()}>Syarat</a> &amp;{" "}
                    <a href="#" onClick={e => e.preventDefault()}>Privasi</a>
                  </span>
                </label>
              )}

              <button type="submit" className="lg-primary-cta" disabled={loading}>
                {loading ? (
                  <>Memproses...</>
                ) : mode === "signin" ? (
                  <>Masuk <ArrowRight size={14} strokeWidth={2} /></>
                ) : (
                  <><Sparkles size={13} fill="white" strokeWidth={1.2} /> Buat akun &amp; mulai</>
                )}
              </button>
            </form>

            <p className="lg-switch">
              {mode === "signin" ? (
                <>Belum punya akun? <button type="button" onClick={() => switchMode("signup")}>Daftar gratis →</button></>
              ) : (
                <>Sudah punya akun? <button type="button" onClick={() => switchMode("signin")}>Masuk →</button></>
              )}
            </p>
          </div>

          <footer className="lg-footer">
            <span>© 2026 Sensei JLPT</span>
            <span className="lg-footer-sep">·</span>
            <a href="#" onClick={e => e.preventDefault()}>Syarat</a>
            <a href="#" onClick={e => e.preventDefault()}>Privasi</a>
            <a href="#" onClick={e => e.preventDefault()}>Bantuan</a>
          </footer>
        </main>

        <VisualPanel />
      </div>
    </>
  );
}

/* ─── Subcomponents ─── */

function FormField({
  label, footer, children,
}: { label: string; footer?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="lg-field">
      <label className="lg-field-label">{label}</label>
      <div className="lg-field-input">{children}</div>
      {footer && <div className="lg-field-footer">{footer}</div>}
    </div>
  );
}

function PasswordStrength({ level }: { level: number }) {
  const label = level === 1 ? "Lemah" : level === 2 ? "Sedang" : level >= 3 ? "Bagus" : "—";
  const color = level === 1 ? "var(--accent-rose)" : level === 2 ? "var(--accent-amber)" : "var(--accent-emerald)";
  return (
    <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, display: "flex", gap: 3, height: 4 }}>
        {[1, 2, 3, 4].map(i => (
          <span
            key={i}
            style={{
              flex: 1,
              borderRadius: 2,
              background: i <= level ? color : "var(--surface-2)",
              boxShadow: i <= level ? `0 0 4px ${color}` : "none",
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color }}>
        {label}
      </span>
    </div>
  );
}

function VisualPanel() {
  return (
    <section className="lg-visual">
      <div className="lg-visual-bg" />

      <div className="lg-kanji-stage">
        <div className="lg-kanji-glow" />
        <div className="lg-kanji-glyph">学</div>
      </div>

      <div className="lg-mini-card lg-mini-1">
        <div className="lg-mini-head">
          <span className="lg-mini-tag">N2</span>
          <span className="lg-mini-meta">11/12</span>
        </div>
        <div className="lg-mini-jp">読解 Mock</div>
        <div className="lg-mini-bar"><span style={{ width: "92%" }} /></div>
      </div>

      <div className="lg-mini-card lg-mini-2">
        <div className="lg-mini-streak">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="url(#flameLg)" aria-hidden>
            <defs>
              <linearGradient id="flameLg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#E8C57E" />
                <stop offset="0.6" stopColor="#D4A04A" />
                <stop offset="1" stopColor="#A4243B" />
              </linearGradient>
            </defs>
            <path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4-1 4 3 4 3 1 0-3-2-4 0-7z" />
          </svg>
          <span>5 hari streak</span>
        </div>
      </div>

      <div className="lg-mini-card lg-mini-3">
        <div className="lg-mini-eyebrow">Kosakata baru</div>
        <div className="lg-mini-kanji">諦</div>
        <div className="lg-mini-reading">あきら・める</div>
      </div>

      <div className="lg-visual-content">
        <span className="lg-visual-eyebrow">
          <Sparkles size={11} fill="currentColor" strokeWidth={1} />
          Sensei JLPT
        </span>
        <h2 className="lg-visual-title">
          Foto soal.<br />
          Dapatkan pembahasan.<br />
          <span className="grad">Hafal lebih cepat.</span>
        </h2>

        <ul className="lg-visual-bullets">
          <li>
            <span className="lvb-icon iris"><Zap size={11} strokeWidth={1.6} /></span>
            Analisis foto soal Jepang dalam detik
          </li>
          <li>
            <span className="lvb-icon emerald"><Check size={11} strokeWidth={2.4} /></span>
            Kotoba auto-tersimpan ke Kamus
          </li>
          <li>
            <span className="lvb-icon amber"><Shield size={11} strokeWidth={1.6} /></span>
            14 hari free trial, cancel kapan saja
          </li>
        </ul>

        <div className="lg-visual-social-proof">
          <div className="lg-avatars">
            {["B", "R", "P", "M", "+"].map((a, i) => (
              <span key={i} className={`lg-mini-avatar lg-av-${i}`}>{a}</span>
            ))}
          </div>
          <div className="lg-proof-text">
            <strong>2,400+ pelajar</strong>
            <span>sudah lulus JLPT pakai Sensei</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function GoogleLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7L13 19.5C14.7 14.9 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.4l-6.5-5.5c-1.9 1.5-4.4 2.4-7.5 2.4-5.3 0-9.7-3.1-11.3-7.6l-6.6 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 2.1-2.1 3.9-3.9 5.1h0l6.5 5.5c-.5.4 7.1-5.2 7.1-14.6 0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
