"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import { Check, X, Sparkles, Star } from "lucide-react";
import { useUserStats } from "@/lib/use-user-stats";

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
      { t: "Bank soal 過去問 lengkap", on: true },
      { t: "Choukai + audio per soal", on: true },
      { t: "Materi Kotoba & Bunpou", on: true },
      { t: "50 kotoba tersimpan di Kamus", on: true },
      { t: "5 chat Sensei AI / hari", on: true },
      { t: "2 analisis foto / hari", on: true },
      { t: "Kotoba tersimpan tanpa batas", on: false },
      { t: "50 chat Sensei AI / hari", on: false },
      { t: "10 analisis foto / hari", on: false },
    ],
  },
  {
    id: "pro",
    name: "Sensei Pro",
    tagline: "Serius nyiapin ujian — belajar sampai lulus",
    monthly: 129_000,
    yearly: 99_000,        // per-bulan kalau ambil Paket Ujian 6 bulan (total 594rb)
    yearlyDiscount: 23,
    cta: "Pilih Pro",
    popular: true,
    color: "iris",
    features: [
      { t: "Kotoba tersimpan tanpa batas", on: true, highlight: true },
      { t: "50 chat Sensei AI / hari", on: true, highlight: true },
      { t: "10 analisis foto / hari", on: true, highlight: true },
      { t: "100 furigana / hari", on: true },
      { t: "Bank soal 過去問 lengkap", on: true },
      { t: "Choukai + audio per soal", on: true },
      { t: "Materi Kotoba & Bunpou", on: true },
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
  { label: "Bank soal 過去問",         free: "Lengkap",     pro: "Lengkap",      life: "Lengkap" },
  { label: "Choukai + audio",          free: true,          pro: true,           life: true },
  { label: "Materi Kotoba & Bunpou",   free: true,          pro: true,           life: true },
  { label: "Kotoba tersimpan",         free: "50 max",      pro: "Tanpa batas",  life: "Tanpa batas" },
  { label: "Chat Sensei AI",           free: "5 / hari",    pro: "50 / hari",    life: "50 / hari" },
  { label: "Analisis foto",            free: "2 / hari",    pro: "10 / hari",    life: "10 / hari" },
  { label: "Furigana otomatis",        free: "20 / hari",   pro: "100 / hari",   life: "100 / hari" },
  { label: "Perpanjangan",             free: "—",           pro: "Bulanan",      life: "Sekali bayar" },
];

/* ⚠️ KONTAK: ganti KONTAK_SUPPORT di bawah sama email/WA yang beneran kamu
   pegang sebelum halaman ini dipakai jualan. FAQ lama nyebut
   support@senseijlpt.id — kalau alamat itu gak ada, orang yang mau berhenti
   atau komplain gak punya jalan sama sekali. */
const KONTAK_SUPPORT = "GANTI_INI@email-kamu.com";

const FAQ = [
  { q: "Gimana cara bayarnya?",
    a: `Sekarang masih manual: hubungi ${KONTAK_SUPPORT}, transfer, terus akses Pro-nya diaktifin. Pembayaran otomatis (kartu, GoPay, QRIS) lagi disiapin.` },
  { q: "Bisa berhenti kapan saja?",
    a: "Bisa. Pro itu bulanan — kalau gak diperpanjang, akses Pro berhenti di akhir periode dan akunmu balik ke Free. Gak ada ikatan." },
  { q: "Kalau balik ke Free, kotoba & catatan saya hilang?",
    a: "Nggak. Semua data kamu tetap ada. Yang berubah cuma batas hariannya — dan kotoba di atas 50 tetap kesimpen, cuma gak bisa nambah lagi sampai berlangganan." },
  { q: "Bedanya Pro vs Lifetime apa?",
    a: "Fitur identik. Pro dibayar bulanan; Lifetime sekali bayar buat akses selamanya, termasuk fitur yang nyusul nanti." },
  { q: "Bank soalnya beneran soal asli?",
    a: "Iya — 過去問 dari ujian yang udah lewat, bukan soal karangan AI. Choukai-nya juga pakai audio asli, dipotong per soal. Sebagian kecil soal N1 bacaannya hasil rekonstruksi karena teks aslinya rusak waktu diekstrak; itu ditandai di datanya." },
];

const fmt = (n: number) => "Rp " + n.toLocaleString("id-ID");

export default function Premium() {
  const router = useRouter();
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [paying, setPaying] = useState<string | null>(null);
  const [userInitial, setUserInitial] = useState("Y");
  const stats = useUserStats();
  /* Streak dari useUserStats → streak_saya(). Sebelumnya tiap halaman baca
     profiles.streak sendiri — kolom yang gak pernah di-update, jadi tiap
     halaman nampilin angka beku yang sama. */
  const streak = stats.streak;
  /* Paket aktif dari status PRO yang sebenarnya — whitelist email atau flag
     is_premium hasil bayar (logikanya di access.ts). Skema belum punya kolom
     buat mbedain pro vs lifetime, jadi keduanya kebaca "pro". */
  const currentPlan: "free" | "pro" | "lifetime" = stats.isPro ? "pro" : "free";
  const xp = stats.xp;
  const xpTarget = stats.xpTarget;

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserInitial((user.user_metadata?.full_name || user.email || "Y")[0].toUpperCase());
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
         
        />

        <header className="pr-header">
          <Breadcrumb items={[{ label: "Beranda", href: "/" }, { label: "Premium" }]} />
          <div className="pr-eyebrow">
            <Sparkles size={11} fill="currentColor" strokeWidth={1} />
            Upgrade ke Pro
          </div>
          <h1 className="pr-title">
            Belajar JLPT <span className="pr-title-jp">真剣に</span>.<br />
            Jatah harian <span className="pr-grad">jauh lebih lega</span>.
          </h1>
          <p className="pr-sub">
            Jatah harian naik banyak: 10 analisis foto, 50 chat Sensei, 100 furigana.
            Kotoba tersimpan tanpa batas. Bank soal 過去問 dan choukai beraudio kebuka
            buat semua — mulai Rp 99.000/bulan (Paket Ujian 6 bulan).
          </p>

          <div className="pr-toggle">
            <button
              type="button"
              className={`pr-toggle-btn ${cycle === "monthly" ? "on" : ""}`}
              onClick={() => setCycle("monthly")}
            >
              Bulanan
            </button>
            <button
              type="button"
              className={`pr-toggle-btn ${cycle === "yearly" ? "on" : ""}`}
              onClick={() => setCycle("yearly")}
            >
              Paket Ujian 6 bulan
              <span className="pr-toggle-save">Hemat 23%</span>
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
              quote="Latihan kilat Bunpou-nya nyorot pola yang gw sering salah. Akurasi mock test langsung naik 18%."
              name="Bella · N2 (lulus 2026/03)"
              avatar="B"
              color="iris"
            />
            <Testi
              quote="Best Rp 99k yang gw spend. Bank soal 過去問-nya lengkap — gw bisa latihan jam berapa aja, kayak punya tutor 24/7."
              name="Reza · prep N1"
              avatar="R"
              color="amber"
            />
            <Testi
              quote="Kamus kotoba + flashcard-nya game changer. Vocab gw tumbuh 3× lebih cepat dibanding pake Anki manual."
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
            <span className="plan-period">/ bulan{cycle === "yearly" ? ` · total ${fmt(price * 6)} / 6 bln` : ""}</span>
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
