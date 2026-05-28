"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import { Check, X, Sparkles, Star } from "lucide-react";

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

type Cycle = "monthly" | "yearly";
type PlanColor = "slate" | "iris" | "gold";

interface PlanFeature {
  t: string;
  on: boolean;
  highlight?: boolean;
}

interface Plan {
  id: "free" | "pro" | "lifetime";
  name: string;
  tagline: string;
  monthly: number | null;
  yearly?: number | null;
  yearlyDiscount?: number;
  lifetimePrice?: number;
  cta: string;
  color: PlanColor;
  popular?: boolean;
  features: PlanFeature[];
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Sensei Free",
    tagline: "Buat eksplor & latihan ringan",
    monthly: 0,
    yearly: 0,
    cta: "Plan kamu sekarang",
    color: "slate",
    features: [
      { t: "10 analisis foto / hari", on: true },
      { t: "50 kotoba di Kamus", on: true },
      { t: "Latihan kilat dasar", on: true },
      { t: "5 chat Sensei AI / hari", on: true },
      { t: "Materi struktural (Kotoba, Bunpou)", on: false },
      { t: "Sensei chat unlimited", on: false },
      { t: "Export PDF / CSV", on: false },
      { t: "Statistik lanjutan", on: false },
      { t: "Prioritas AI (lebih cepat)", on: false },
    ],
  },
  {
    id: "pro",
    name: "Sensei Pro",
    tagline: "Untuk persiapan ujian serius",
    monthly: 89_000,
    yearly: 79_000,
    yearlyDiscount: 11,
    cta: "Pilih Pro",
    popular: true,
    color: "iris",
    features: [
      { t: "Analisis foto unlimited", on: true, highlight: true },
      { t: "Kotoba unlimited di Kamus", on: true, highlight: true },
      { t: "Sensei chat unlimited", on: true, highlight: true },
      { t: "Semua materi struktural", on: true },
      { t: "Latihan kilat + AI personalize", on: true },
      { t: "Export PDF / CSV / Anki", on: true },
      { t: "Statistik lanjutan + insight", on: true },
      { t: "Prioritas AI (2× lebih cepat)", on: true },
      { t: "Akses fitur beta lebih dulu", on: true },
    ],
  },
  {
    id: "lifetime",
    name: "Sensei Lifetime",
    tagline: "Bayar sekali, pakai selamanya",
    monthly: null,
    lifetimePrice: 1_490_000,
    cta: "Beli Lifetime",
    color: "gold",
    features: [
      { t: "Semua fitur Pro · selamanya", on: true, highlight: true },
      { t: "Tidak ada perpanjangan", on: true, highlight: true },
      { t: "Fitur baru gratis selamanya", on: true, highlight: true },
      { t: "Priority support", on: true },
      { t: "Akses Discord komunitas exclusive", on: true },
      { t: "Sertifikat digital pencapaian", on: true },
      { t: "+ semua fitur Pro", on: true },
    ],
  },
];

interface CompareRow {
  label: string;
  free: string | boolean;
  pro: string | boolean;
  life: string | boolean;
}

const COMPARE: CompareRow[] = [
  { label: "Analisis foto",            free: "10 / hari",  pro: "Unlimited",   life: "Unlimited" },
  { label: "Kotoba di Kamus",          free: "50 max",     pro: "Unlimited",   life: "Unlimited" },
  { label: "Sensei AI chat",           free: "5 / hari",   pro: "Unlimited",   life: "Unlimited" },
  { label: "Materi struktural",        free: false,        pro: true,          life: true },
  { label: "Export (PDF/CSV/Anki)",    free: false,        pro: true,          life: true },
  { label: "Statistik lanjutan",       free: false,        pro: true,          life: true },
  { label: "Prioritas AI",             free: false,        pro: "Standard ×2", life: "Standard ×2" },
  { label: "Akses fitur beta",         free: false,        pro: true,          life: true },
  { label: "Discord komunitas",        free: false,        pro: false,         life: true },
  { label: "Sertifikat digital",       free: false,        pro: false,         life: true },
];

const FAQ = [
  { q: "Bisa cancel kapan saja?",                    a: "Bisa banget. Bisa di-cancel langsung dari /pengaturan dan kamu tetap dapat akses Pro sampai akhir periode billing." },
  { q: "Kalau downgrade, kotoba & catatan saya hilang?", a: "Nggak. Semua data kamu aman selamanya. Cuma fitur Pro yang non-aktif. Kalau resub, semua langsung balik." },
  { q: "Pakai metode pembayaran apa?",               a: "Visa/Mastercard, GoPay, OVO, Dana, transfer bank, bahkan QRIS — semua via Midtrans." },
  { q: "Ada garansi uang kembali?",                  a: "Ya — 14 hari refund tanpa pertanyaan. Email aja support@senseijlpt.id." },
  { q: "Bedanya Pro vs Lifetime apa?",               a: "Fitur identik. Pro = subscription. Lifetime = bayar sekali, akses semua fitur Pro selamanya termasuk fitur masa depan." },
];

const fmt = (n: number) => "Rp " + n.toLocaleString("id-ID");

export default function Premium() {
  const router = useRouter();
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [paying, setPaying] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [userInitial, setUserInitial] = useState("Y");
  // TODO: load actual plan dari profiles.plan; default "free" untuk sementara
  const currentPlan: "free" | "pro" | "lifetime" = "free";
  const xp = 820;
  const xpTarget = 1000;

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserInitial((user.user_metadata?.full_name || user.email || "Y")[0].toUpperCase());
      const { data } = await supabase.from("profiles").select("streak").eq("id", user.id).single();
      if (data) setStreak(data.streak ?? 0);
      // TODO: load actual plan from profiles.plan once schema has it
    }
    load();
  }, []);

  const handlePay = async (planId: string) => {
    setPaying(planId);
    // TODO: ganti dengan Midtrans/Xendit saat API key siap
    await new Promise(r => setTimeout(r, 1500));
    router.push("/premium/sukses");
  };

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
          hasUnread
        />

        <header className="pr-header">
          <Breadcrumb items={[{ label: "Beranda", href: "/" }, { label: "Premium" }]} />
          <div className="pr-eyebrow">
            <Sparkles size={11} fill="currentColor" strokeWidth={1} />
            Upgrade ke Pro
          </div>
          <h1 className="pr-title">
            Belajar JLPT <span className="pr-title-jp">真剣に</span>.<br />
            Sensei <span className="pr-grad">tanpa batas</span>.
          </h1>
          <p className="pr-sub">
            Lepas semua limit. Analisis berapa pun foto kamu. Tanya Sensei AI sebanyak yang mau.
            Akses semua materi struktural. Mulai dari Rp 79.000/bulan.
          </p>

          <div className="pr-toggle">
            <button
              type="button"
              className={`pr-toggle-btn ${cycle === "monthly" ? "on" : ""}`}
              onClick={() => setCycle("monthly")}
            >
              Bayar bulanan
            </button>
            <button
              type="button"
              className={`pr-toggle-btn ${cycle === "yearly" ? "on" : ""}`}
              onClick={() => setCycle("yearly")}
            >
              Bayar tahunan
              <span className="pr-toggle-save">Hemat 11%</span>
            </button>
          </div>
        </header>

        <div className="pr-plan-grid">
          {PLANS.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              cycle={cycle}
              isCurrent={currentPlan === plan.id}
              paying={paying === plan.id}
              onPay={() => handlePay(plan.id)}
            />
          ))}
        </div>

        <section className="pr-compare">
          <div className="pr-compare-head">
            <h2 className="pr-section-title">Bandingkan semua fitur</h2>
            <p className="pr-section-sub">Lengkap, jujur — tanpa marketing fluff</p>
          </div>
          <div className="cmp-table glass-card">
            <div className="cmp-row cmp-head">
              <span className="cmp-feature">Fitur</span>
              <span className="cmp-col">Free</span>
              <span className="cmp-col pop">Pro</span>
              <span className="cmp-col gold">Lifetime</span>
            </div>
            {COMPARE.map(r => (
              <div className="cmp-row" key={r.label}>
                <span className="cmp-feature">{r.label}</span>
                <span className="cmp-col">{renderCell(r.free)}</span>
                <span className="cmp-col pop">{renderCell(r.pro)}</span>
                <span className="cmp-col gold">{renderCell(r.life)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="pr-testi-section">
          <h2 className="pr-section-title centered">Dari para Senpai 先輩</h2>
          <div className="pr-testi-grid">
            <Testi
              quote="Sensei nge-detect grammar yang gw udah salah berkali-kali di mock test. Akurasi langsung naik 18%."
              name="Bella · N2 (lulus 2026/03)"
              avatar="B"
              color="iris"
            />
            <Testi
              quote="Best Rp 79k yang gw spend tahun ini. Kayak punya tutor pribadi 24/7 — gw bisa foto soal jam berapa aja."
              name="Reza · prep N1"
              avatar="R"
              color="amber"
            />
            <Testi
              quote="Kamus auto-save dari foto = game changer. Vocab gw tumbuh 3× lebih cepat dibanding pake Anki manual."
              name="Putri · N3 → N2"
              avatar="P"
              color="emerald"
            />
          </div>
        </section>

        <section className="pr-faq-section">
          <h2 className="pr-section-title">Pertanyaan yang sering ditanya</h2>
          <div className="pr-faq-list">
            {FAQ.map((f, i) => <FaqItem key={i} item={f} />)}
          </div>
        </section>

        <section className="pr-cta-footer glass-card">
          <div className="pr-cta-bg" />
          <div className="pr-cta-content">
            <h2>Mulai 14 hari free trial.</h2>
            <p>Cancel kapan saja. Tanpa kartu kredit kalau trial. Tanpa hidden cost.</p>
            <div className="pr-cta-row">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                disabled={paying != null}
                onClick={() => handlePay("pro")}
              >
                <Sparkles size={14} fill="currentColor" strokeWidth={1.2} />
                {paying === "pro" ? "Memproses..." : "Coba Pro 14 hari gratis"}
              </button>
              <Link href="#compare" className="btn btn-secondary btn-lg">
                Bandingkan plan dulu →
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

/* ─── Subcomponents ─── */

function PlanCard({
  plan, cycle, isCurrent, paying, onPay,
}: { plan: Plan; cycle: Cycle; isCurrent: boolean; paying: boolean; onPay: () => void }) {
  const isLifetime = plan.id === "lifetime";
  const price = isLifetime
    ? plan.lifetimePrice ?? 0
    : (cycle === "yearly" ? (plan.yearly ?? 0) : (plan.monthly ?? 0));

  return (
    <article className={`glass-card pr-plan plan-${plan.color}${plan.popular ? " popular" : ""}`}>
      {plan.popular && (
        <span className="plan-pop-badge">
          <Star size={9} fill="white" strokeWidth={0} /> PALING POPULER
        </span>
      )}
      {isCurrent && <span className="plan-current-badge">Aktif</span>}

      <div>
        <h3 className="plan-name">{plan.name}</h3>
        <p className="plan-tagline">{plan.tagline}</p>
      </div>

      <div className="plan-price">
        {price === 0 ? (
          <>
            <span className="plan-amount">Rp 0</span>
            <span className="plan-period">selamanya</span>
          </>
        ) : isLifetime ? (
          <>
            <span className="plan-amount">{fmt(price)}</span>
            <span className="plan-period">bayar sekali</span>
          </>
        ) : (
          <>
            <span className="plan-amount">{fmt(price)}</span>
            <span className="plan-period">/ bulan</span>
            {cycle === "yearly" && plan.monthly != null && (
              <span className="plan-original">{fmt(plan.monthly)}</span>
            )}
          </>
        )}
      </div>

      <button
        type="button"
        className={`plan-cta plan-cta-${plan.color}`}
        disabled={isCurrent || paying}
        onClick={onPay}
      >
        {isCurrent ? "Plan kamu sekarang" : paying ? "Memproses..." : plan.cta}
        {!isCurrent && !paying && !isLifetime && plan.id !== "free" && (
          <span className="plan-cta-arrow">→</span>
        )}
      </button>

      <ul className="plan-features">
        {plan.features.map(f => (
          <li key={f.t} className={f.on ? (f.highlight ? "on highlight" : "on") : "off"}>
            {f.on
              ? <Check size={13} strokeWidth={2.4} />
              : <X size={13} strokeWidth={2} />}
            <span>{f.t}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function renderCell(v: string | boolean) {
  if (v === true)  return <Check size={14} strokeWidth={2.4} style={{ color: "var(--accent-emerald)" }} />;
  if (v === false) return <X size={13} strokeWidth={2} style={{ color: "var(--text-muted)" }} />;
  return <span className="cmp-val">{v}</span>;
}

function Testi({
  quote, name, avatar, color,
}: { quote: string; name: string; avatar: string; color: "iris" | "amber" | "emerald" }) {
  return (
    <article className={`glass-card testi-card testi-${color}`}>
      <div className="testi-stars">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={13} fill="var(--accent-amber)" strokeWidth={0} />
        ))}
      </div>
      <p className="testi-quote">&ldquo;{quote}&rdquo;</p>
      <div className="testi-attribution">
        <div className={`testi-avatar testi-av-${color}`}>{avatar}</div>
        <span>{name}</span>
      </div>
    </article>
  );
}

function FaqItem({ item }: { item: { q: string; a: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`pr-faq-item${open ? " open" : ""}`}
      onClick={() => setOpen(o => !o)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(o => !o); } }}
    >
      <div className="pr-faq-q">
        <h4>{item.q}</h4>
        <span className="pr-faq-chev">{open ? "−" : "+"}</span>
      </div>
      {open && <p className="pr-faq-a">{item.a}</p>}
    </div>
  );
}
