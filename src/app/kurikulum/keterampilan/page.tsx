"use client";

import { useUserStats } from "@/lib/use-user-stats";
import { useKurikulum, type Kurikulum } from "@/lib/use-kurikulum";
import { ATURAN, fiturLive } from "@/lib/kurikulum-config";
import { JENIS_SOAL, labelTingkat, type Grup } from "@/lib/kurikulum";
import { LabelDisiapkan } from "@/components/rencana/LabelDisiapkan";
import { BelumMulai, Disiapkan, Kerangka, KepalaKurikulum } from "@/components/kurikulum/Bagian";

const GRUP: Grup[] = ["文字・語彙", "文法", "読解"];
const pct = (n: number) => Math.round(n * 100);

/** Keterampilan T1/T2/T3 per jenis soal (HANDOFF-kurikulum §7). */
export default function KeterampilanPage() {
  const stats = useUserStats();
  const k = useKurikulum(stats.targetLevel, stats.loaded);
  const crumb = [{ label: "Materi", href: "/materi" }, { label: "Kurikulum", href: "/kurikulum" }, { label: "Keterampilan" }];
  if (!fiturLive("kurikulum")) {
    return <Kerangka stats={stats} crumb={crumb}><Disiapkan judul="Keterampilan T1–T3" isi="Tiap jenis soal punya tingkat sendiri: T1 pengenalan, T2 standar JLPT, T3 jebakan. Naik turun otomatis dari 20 jawaban terakhir." /></Kerangka>;
  }
  return (
    <Kerangka stats={stats} crumb={crumb}>
      {!k.siap ? <p className="ku-muat" role="status">Memuat kurikulum…</p>
        : k.belumMulai ? <BelumMulai level={stats.targetLevel} penempatan={fiturLive("penempatan")} />
        : <><KepalaKurikulum k={k} tab="skill" /><Isi k={k} /></>}
    </Kerangka>
  );
}

function Isi({ k }: { k: Kurikulum }) {
  const A = ATURAN.tingkat;
  return (
    <>
      <div className="card sk-rule">
        <span><b>T1</b> pengenalan</span><span><b>T2</b> standar JLPT</span><span><b>T3</b> jebakan</span>
        <span>Dari {A.jendela} jawaban terakhir: <b>≥ {pct(A.naik)}%</b> naik, <b>&lt; {pct(A.turun)}%</b> turun</span>
        <span>Latihan bebas tetap bisa pilih tingkat mana aja.</span>
        {!fiturLive("soal_orisinal") && <span>Soal bertingkat T1–T3<LabelDisiapkan kecil /></span>}
      </div>
      {GRUP.map(g => {
        const daftar = JENIS_SOAL.filter(j => j.g === g);
        return (
          <section className="card skc" key={g}>
            <div className="skc-h"><div className="h2" lang="ja">{g}</div><span className="note">{daftar.length} jenis soal</span></div>
            {daftar.map(j => {
              const t = k.tingkat.get(j.k);
              const sekarang = t?.tingkat ?? 1;
              const e = t?.e ?? { tingkat: 1, arah: 0 as const, akurasi: null };
              const [teks, cls] = labelTingkat(e, sekarang, A);
              const a = e.akurasi;
              return (
                <div className="skr" key={j.k}>
                  <div className="sk-k" lang="ja">{j.k}</div>
                  <div className="sk-t" aria-label={`Tingkat sekarang T${sekarang}`}>
                    {[1, 2, 3].map(n => <span key={n} className={`tp${n === sekarang ? " on" : n < sekarang ? " past" : ""}`}>T{n}</span>)}
                  </div>
                  <div className="sk-b">
                    <div className="sk-bar" role="img" aria-label={a == null ? "Belum ada jawaban" : `${pct(a)}% benar`}>
                      {a != null && <i style={{ width: `${pct(a)}%`, background: a >= A.naik ? "var(--success)" : a < A.turun ? "var(--warning)" : "var(--pt)" }} />}
                      <em style={{ left: `${pct(A.turun)}%` }} /><em style={{ left: `${pct(A.naik)}%` }} />
                    </div>
                    <span>{a == null ? "–" : `${pct(a)}%`}</span>
                  </div>
                  <div className={`sk-s ${cls}`}>{teks}</div>
                </div>
              );
            })}
          </section>
        );
      })}
      <p className="note" style={{ marginTop: 14 }}><span lang="ja">聴解</span> ikut set Choukai beraudio di Bank Soal, gak pakai tingkat.</p>
    </>
  );
}
