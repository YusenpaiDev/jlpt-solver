"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import { Check, X, Sparkles, Star } from "lucide-react";
import { useUserStats } from "@/lib/use-user-stats";
import { PAKET, type PaketId } from "@/lib/paket";
import { useBayar } from "@/lib/bayar";
import { fiturLive, type FiturBaru } from "@/lib/kurikulum-config";
import { LabelDisiapkan } from "@/components/rencana/LabelDisiapkan";
import { KurikulumPremium, TabelBanding, type GrupBanding } from "@/components/pembayaran/KurikulumPremium";
import { honixSrc, type HonixPose } from "@/lib/honix-pose";
import { OfflineVsHonix } from "@/components/pembayaran/OfflineVsHonix";
import "@/styles/premium-lifetime.css";

type Cycle = "monthly" | "yearly";
type PlanColor = "slate" | "iris" | "gold";

interface PlanFeature {
  t: string;
  on: boolean;
  highlight?: boolean;
  /** fitur kurikulum yang belum tentu live → label "Sedang disiapkan" */
  fitur?: FiturBaru;
}

interface Plan {
  id: "trial" | "pro" | "lifetime";
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
  /** Honix di kepala kartu. */
  honix?: HonixPose;
  /** Lifetime: rincian "termasuk" di bawah poin utama. */
  termasuk?: PlanFeature[];
}

const PLANS: Plan[] = [
  {
    id: "trial",
    name: "Percobaan 7 hari",
    tagline: "Akses penuh selama 7 hari sejak tanggal daftar",
    monthly: 0,
    yearly: 0,
    cta: "Lihat status percobaan",
    color: "slate",
    features: [
      { t: "Bank Soal set latihan format JLPT", on: true },
      { t: "Choukai + audio per soal", on: true },
      { t: "Kotoba 8.342 kata & Bunpou 650 pola, per level N5–N1", on: true },
      { t: "Latihan Kilat & flashcard", on: true },
      { t: "Catatan & Kamus pribadi", on: true },
      { t: "Tes penempatan", on: true, fitur: "penempatan" },
      { t: "Ulangan mingguan", on: true, fitur: "ulangan" },
      { t: "Kotoba tersimpan tanpa batas", on: true },
      { t: "Chat Sensei AI tanpa batas", on: true },
      { t: "Furigana dan lembar tugas AI", on: true },
      { t: "Berakhir 7 hari sejak daftar", on: true },
    ],
  },
  {
    id: "pro",
    name: "Honix Pro",
    tagline: "Serius nyiapin ujian — belajar sampai lulus",
    monthly: 129_000,
    yearly: 99_000,        // per-bulan kalau ambil Paket Ujian 6 bulan (total 594rb)
    yearlyDiscount: 23,
    cta: "Pilih Pro",
    popular: true,
    color: "iris",
    honix: "terbang",
    features: [
      { t: "Kurikulum mingguan sampai hari ujian", on: true, highlight: true, fitur: "kurikulum" },
      { t: "Soal orisinal bertingkat T1–T3", on: true, highlight: true, fitur: "soal_orisinal" },
      { t: "Perkiraan skor per bagian + tren", on: true, fitur: "perkiraan" },
      { t: "Simulasi bulanan", on: true, fitur: "simulasi" },
      { t: "Kotoba tersimpan tanpa batas", on: true, highlight: true },
      { t: "Chat Sensei AI tanpa batas", on: true, highlight: true },
      { t: "Furigana tanpa batas", on: true },
      { t: "Kotoba 8.342 kata & Bunpou 650 pola, per level N5–N1", on: true },
      { t: "Latihan Kilat & flashcard", on: true },
      { t: "Catatan & Kamus pribadi (bisa di-export)", on: true },
      { t: "Bank Soal set latihan format JLPT", on: true },
      { t: "Choukai + audio per soal", on: true },
    ],
  },
  {
    id: "lifetime",
    name: "Honix Lifetime",
    tagline: "Bayar sekali, pakai selamanya",
    monthly: null,
    lifetimePrice: 1_490_000,
    cta: "Beli Lifetime",
    color: "gold",
    honix: "lulus",
    features: [
      { t: "Semua fitur Pro · selamanya", on: true, highlight: true },
      { t: "Tidak ada perpanjangan", on: true, highlight: true },
      { t: "Fitur baru gratis selamanya", on: true, highlight: true },
      { t: "Lanjut N3 → N2 → N1 tanpa bayar lagi", on: true, highlight: true },
    ],
    termasuk: [
      { t: "Kurikulum mingguan sampai hari ujian", on: true, fitur: "kurikulum" },
      { t: "Soal orisinal bertingkat T1–T3", on: true, fitur: "soal_orisinal" },
      { t: "Perkiraan skor + simulasi bulanan", on: true, fitur: "perkiraan" },
      { t: "Sensei AI & Kotoba tersimpan tanpa batas", on: true },
      { t: "Kotoba & Bunpou per level · Latihan Kilat · flashcard", on: true },
      { t: "Bank Soal · Choukai · Catatan & Kamus pribadi", on: true },
    ],
  },
];

/** Lifetime vs Pro Bulanan setahun penuh — angkanya dari harga di atas, bukan ditulis tangan. */
const SETAHUN_BULANAN = (PLANS.find(p => p.id === "pro")?.monthly ?? 0) * 12;

/* Trial = akses penuh selama 7 hari, jadi fitur baru ikut kebuka di trial. */
const COMPARE: GrupBanding[] = [
  { grup: "Belajar & latihan", baris: [
    { label: "Bank Soal set latihan format JLPT", trial: "Lengkap", pro: "Lengkap", life: "Lengkap" },
    { label: "Choukai + audio",                   trial: true, pro: true, life: true },
    { label: "Materi Kotoba & Bunpou · 8.342 kata, 650 pola, per level N5–N1", trial: true, pro: true, life: true },
    { label: "Latihan Kilat & flashcard",                     trial: true, pro: true, life: true },
    { label: "Catatan & Kamus pribadi · bisa di-export",      trial: true, pro: true, life: true },
    { label: "Misi harian, kalender cap, strategi ujian",     trial: true, pro: true, life: true },
  ] },
  { grup: "Kurikulum & tes", baris: [
    { label: "Tes penempatan",                        trial: true, pro: true, life: true, fitur: "penempatan" },
    { label: "Kurikulum mingguan sampai hari ujian",  trial: "Penuh", pro: "Penuh", life: "Penuh", fitur: "kurikulum" },
    { label: "Soal orisinal bertingkat T1–T3",        trial: true, pro: true, life: true, fitur: "soal_orisinal" },
    { label: "Ulangan mingguan",                      trial: true, pro: true, life: true, fitur: "ulangan" },
    { label: "Perkiraan skor",                        trial: "Per bagian + tren", pro: "Per bagian + tren", life: "Per bagian + tren", fitur: "perkiraan" },
    { label: "Simulasi bulanan",                      trial: true, pro: true, life: true, fitur: "simulasi" },
  ] },
  { grup: "Sensei AI", baris: [
    { label: "Kotoba tersimpan",   trial: "Tanpa batas", pro: "Tanpa batas", life: "Tanpa batas" },
    { label: "Chat Sensei AI",     trial: "Tanpa batas", pro: "Tanpa batas", life: "Tanpa batas" },
    { label: "Furigana otomatis",  trial: "Tanpa batas", pro: "Tanpa batas", life: "Tanpa batas" },
    { label: "Perpanjangan",       trial: "—",           pro: "Bulanan",     life: "Sekali bayar" },
  ] },
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
    a: "Bisa. Pro itu bulanan — kalau gak diperpanjang, akses Pro berhenti di akhir periode dan akses belajar berakhir. Gak ada ikatan." },
  { q: "Kalau langganan habis, kotoba & catatan saya hilang?",
    a: "Nggak. Semua data kamu tetap ada. Berlangganan kembali untuk melanjutkan belajar. Masa percobaan tidak dimulai ulang." },
  { q: "Bedanya Pro vs Lifetime apa?",
    a: "Fitur identik. Pro dibayar bulanan; Lifetime sekali bayar buat akses selamanya, termasuk fitur yang nyusul nanti." },
  { q: "Bank Soal isinya apa aja?",
    a: "Set latihan format JLPT per level: 文字・語彙, 文法, 読解, plus 聴解 dengan audio yang dipotong per soal. Bukan soal karangan AI, dan tiap soal ada pembahasannya. Sebagian kecil bacaan N1 direkonstruksi karena teksnya rusak waktu diekstrak; itu ditandai di datanya." },
];

const fmt = (n: number) => "Rp " + n.toLocaleString("id-ID");

export default function Premium() {
  /* Default Paket Ujian (HANDOFF-kurikulum §3): kurikulumnya nempel di paket ini. */
  const [cycle, setCycle] = useState<Cycle>("yearly");
  const [userInitial, setUserInitial] = useState("Y");
  const stats = useUserStats();
  /* Streak dari useUserStats → streak_saya(). Sebelumnya tiap halaman baca
     profiles.streak sendiri — kolom yang gak pernah di-update, jadi tiap
     halaman nampilin angka beku yang sama. */
  const streak = stats.streak;
  /* Paket aktif dari status PRO yang sebenarnya — whitelist email atau flag
     is_premium hasil bayar (logikanya di access.ts). Skema belum punya kolom
     buat mbedain pro vs lifetime, jadi keduanya kebaca "pro". */
  const currentPlan = stats.isLifetime ? "lifetime" : stats.isPro ? "pro" : stats.akses.status === "trial" ? "trial" : null;
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

  /* Kartu di halaman ini pakai id "pro"/"lifetime" + toggle bulanan/tahunan,
     sedangkan yang dijual sebenarnya tiga paket. Dipetakan di satu tempat
     supaya harga di layar dan harga yang ditagih gak bisa beda. */
  const paketDari = (planId: string): PaketId | null =>
    planId === "lifetime" ? "lifetime"
    : planId === "pro" ? (cycle === "yearly" ? "pro-ujian" : "pro-bulanan")
    : null;

  const { bayar, paying: payingPaket, galat } = useBayar();
  /* Kartu nandain "lagi diproses" pakai id kartunya, bukan id paket. */
  const paying = payingPaket === "lifetime" ? "lifetime" : payingPaket ? "pro" : null;

  const handlePay = (planId: string) => {
    if (planId === "trial") { window.location.assign("/langganan"); return; }
    const paketId = paketDari(planId);
    if (paketId) bayar(paketId);
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
            Pro <span className="pr-grad">tanpa batas pemakaian</span>.
          </h1>
          <p className="pr-sub">
            Coba semua fitur selama 7 hari sejak tanggal daftar. Lanjutkan dengan Pro:
            chat AI, furigana, lembar tugas, dan kosakata tanpa kuota harian
            — mulai Rp 99.000/bulan (Paket Ujian 6 bulan).
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

        <OfflineVsHonix />

        <KurikulumPremium />

        <section className="pr-compare" id="compare">
          <div className="pr-compare-head">
            <h2 className="pr-section-title">Bandingkan semua fitur</h2>
            <p className="pr-section-sub">Lengkap, jujur — tanpa marketing fluff</p>
          </div>
          <TabelBanding grup={COMPARE} render={renderCell} />
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
              quote="Best Rp 99k yang gw spend. Bank soalnya lengkap — gw bisa latihan jam berapa aja, kayak punya tutor 24/7."
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
            <h2>Mulai Pro hari ini.</h2>
            <p>Gak diperpanjang otomatis. Tanpa tagihan otomatis. Tanpa hidden cost.</p>
            <p className="pr-legal">Dengan membayar, kamu setuju dengan <Link href="/syarat">Syarat &amp; Ketentuan</Link> (termasuk pengembalian dana) dan <Link href="/privasi">Kebijakan Privasi</Link>.</p>
            <div className="pr-cta-row">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                disabled={paying != null}
                onClick={() => handlePay("pro")}
              >
                <Sparkles size={14} fill="currentColor" strokeWidth={1.2} />
                {paying === "pro" ? "Memproses..." : `Ambil Pro — ${fmt(PAKET[cycle === "yearly" ? "pro-ujian" : "pro-bulanan"].harga)}`}
              </button>
              <Link href="#compare" className="btn btn-secondary btn-lg">
                Bandingkan plan dulu →
              </Link>
            </div>

            {/* Kegagalan pembayaran WAJIB kelihatan. Kalau cuma di-console,
                orang bakal ngeklik berkali-kali tanpa tau apa yang salah. */}
            {galat && (
              <p className="pr-galat" role="alert">
                <X size={14} strokeWidth={2.4} /> {galat}
              </p>
            )}
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
      {isLifetime && (
        <span className="plan-life-badge">
          <Sparkles size={10} strokeWidth={2.4} /> SEKALI BAYAR
        </span>
      )}
      {isCurrent && <span className="plan-current-badge">Aktif</span>}

      {plan.id === "pro" && cycle === "yearly" && (
        <div className="plan-rib">Termasuk kurikulum 26 minggu sampai hari ujian{!fiturLive("kurikulum") && <LabelDisiapkan kecil />}</div>
      )}

      <div className="plan-head">
        <div>
          <h3 className="plan-name">{plan.name}</h3>
          <p className="plan-tagline">{plan.tagline}</p>
        </div>
        {plan.honix && !isCurrent && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="plan-honix" src={honixSrc(plan.honix)} alt="" aria-hidden="true" />
        )}
      </div>

      <div className="plan-price">
        {price === 0 ? (
          <>
            <span className="plan-amount">Rp 0</span>
            <span className="plan-period">selama 7 hari sejak daftar</span>
          </>
        ) : isLifetime ? (
          <>
            <span className="plan-amount">{fmt(price)}</span>
            <span className="plan-period">bayar sekali</span>
            {SETAHUN_BULANAN > price && (
              <span className="plan-life-hemat">
                Lebih murah dari <b>12 bulan Pro</b> ({fmt(SETAHUN_BULANAN)}) — sesudahnya <b>gratis selamanya</b>.
              </span>
            )}
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
        {!isCurrent && !paying && !isLifetime && plan.id !== "trial" && (
          <span className="plan-cta-arrow">→</span>
        )}
      </button>

      <ul className="plan-features">
        {[...plan.features, ...(plan.termasuk ? [null] : []), ...(plan.termasuk ?? [])].map(f => {
          if (!f) return <li key="termasuk" className="plan-life-sep">termasuk</li>;
          /* Fitur yang belum live: lingkaran putus-putus + teks redup + label. */
          if (f.fitur && !fiturLive(f.fitur)) {
            return <li key={f.t} className="pp"><span className="pp-i" aria-hidden="true" /><span>{f.t}<LabelDisiapkan kecil /></span></li>;
          }
          return (
            <li key={f.t} className={f.on ? (f.highlight ? "on highlight" : "on") : "off"}>
              {f.on
                ? <Check size={13} strokeWidth={2.4} />
                : <X size={13} strokeWidth={2} />}
              <span>{f.t}</span>
            </li>
          );
        })}
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
