import "@/styles/rencana-dasar.css";
import "@/styles/premium-kurikulum.css";

import { Fragment } from "react";
import { LabelDisiapkan } from "@/components/rencana/LabelDisiapkan";
import { ASET, FASE, JUMLAH_UNIT, MINGGU_SIMULASI, faseMinggu, fiturLive, semuaLive, type FiturBaru } from "@/lib/kurikulum-config";

const SIKLUS: { w: string; t: string; d: string; fitur: FiturBaru }[] = [
  { w: "Tiap hari", t: "Misi 10 / 20 / 40 menit", d: "Ulang yang jatuh tempo → materi unit minggu ini → latihan sesuai tingkatmu.", fitur: "kurikulum" },
  { w: "Tiap Senin", t: "Ulangan mingguan", d: "±10 menit. Materi & kesalahan minggu lalu, ditanya ulang dalam bentuk baru.", fitur: "ulangan" },
  { w: "Terus jalan", t: "Perkiraan skor", d: "Dari jawaban 30 hari terakhir, per bagian dibanding nilai minimum.", fitur: "perkiraan" },
  { w: "Tiap bulan", t: "Simulasi penuh", d: "Sesuai waktu resmi per bagian. Plus satu lagi 2 minggu sebelum ujian.", fitur: "simulasi" },
];

/** Bagian "Kurikulum 26 minggu sampai hari ujian" di /premium (HANDOFF-kurikulum §3). */
export function KurikulumPremium() {
  const nf = (n: number) => n.toLocaleString("id-ID");
  return (
    <section className="rbk kur" aria-labelledby="kur-judul">
      <div className="eyebrow">Paket Ujian 6 bulan</div>
      <h2 className="kur-t" id="kur-judul">Kurikulum {JUMLAH_UNIT} minggu sampai hari ujian{!fiturLive("kurikulum") && <LabelDisiapkan />}</h2>
      <p className="sub">Tes penempatan nentuin titik mulaimu. Tiap minggu satu unit, tingkat soal naik sendiri, dan ditutup simulasi penuh sebelum ujian.</p>

      <div className="card kmap-c">
        <div className="kmap" role="img" aria-label={FASE.map(f => `${f.t} minggu ${f.minggu[0]} sampai ${f.minggu[1]}`).join(", ") + ", lalu ujian"}>
          {MINGGU_SIMULASI.map(w => <span key={`s${w}`} className="km-s" style={{ gridColumn: w, gridRow: 1 }} title="Simulasi" lang="ja">模</span>)}
          {Array.from({ length: JUMLAH_UNIT }, (_, i) => (
            <i key={i} className="km-c" style={{ gridColumn: i + 1, gridRow: 2, background: faseMinggu(i + 1).warna }} />
          ))}
          <span className="km-x" style={{ gridColumn: JUMLAH_UNIT + 1, gridRow: 2 }} lang="ja">試験</span>
          {FASE.map(f => (
            <div key={f.id} className="km-l" style={{ gridColumn: `${f.minggu[0]} / ${f.minggu[1] + 1}`, gridRow: 3 }}>
              <b>{f.t}</b><small>Minggu {f.minggu[0]}–{f.minggu[1]} · {f.tingkat ? `${f.tingkat} ${f.d}` : f.d}</small>
            </div>
          ))}
        </div>
        <div className="km-leg">
          {FASE.map(f => (
            <div key={f.id}><i style={{ background: f.warna }} /><span>{f.t}{f.tingkat ? ` · ${f.tingkat}` : ""}</span><small>Minggu {f.minggu[0]}–{f.minggu[1]}</small></div>
          ))}
        </div>
        <div className="km-n">
          <span><b className="km-s" lang="ja">模</b> Simulasi bulanan + 2 minggu sebelum ujian</span>
          <span>Tes penempatan bisa langsung lompatin minggu yang udah kamu kuasai</span>
        </div>
      </div>

      <div className="cyc">
        {SIKLUS.map(c => (
          <div className="card cy" key={c.w}>
            <span className="cy-w">{c.w}</span>
            <b>{c.t}</b>
            <p>{c.d}</p>
            {!fiturLive(c.fitur) && (c.fitur === "kurikulum"
              ? <span className="cy-ok">Misi harian udah jalan · isi per unit disiapkan</span>
              : <LabelDisiapkan kecil />)}
          </div>
        ))}
      </div>

      <div className="aset">
        <div className="card as"><b>{nf(ASET.kata)}</b><span>kata, N5–N1</span></div>
        <div className="card as"><b>{nf(ASET.pola)}</b><span>pola Bunpou</span></div>
        <div className="card as"><b>{ASET.setPerLevel}</b><span>set latihan format JLPT per level N1–N3 + Choukai beraudio</span></div>
        <div className="card as"><b>±{nf(ASET.soalOrisinal)}</b><span>soal orisinal bertingkat, di luar <span lang="ja">聴解</span></span>{!fiturLive("soal_orisinal") && <LabelDisiapkan kecil />}</div>
      </div>

      {!semuaLive() && (
        <div className="kur-n">Fitur bertanda <b>Sedang disiapkan</b> belum bisa dipakai hari ini. Yang kamu bayar sekarang: semua fitur Pro yang udah jalan.</div>
      )}
    </section>
  );
}

/* Tabel banding — baris & grup baru (§3 Tabel). Nilai: true = ✓, false = —. */
export interface BarisBanding { label: string; trial: string | boolean; pro: string | boolean; life: string | boolean; fitur?: FiturBaru }
export interface GrupBanding { grup: string; baris: BarisBanding[] }

export function TabelBanding({ grup, render }: { grup: GrupBanding[]; render: (v: string | boolean) => React.ReactNode }) {
  return (
    <>
      {!semuaLive() && (
        <div className="cmp-leg">
          <span><b className="cmp-ok">✓</b> Udah bisa dipakai</span>
          <span><LabelDisiapkan /> Belum bisa dipakai</span>
        </div>
      )}
      <div className="cmp-table glass-card">
        <div className="cmp-row cmp-head">
          <span className="cmp-feature">Fitur</span>
          <span className="cmp-col">Trial 7 hari</span>
          <span className="cmp-col pop">Pro</span>
          <span className="cmp-col gold">Lifetime</span>
        </div>
        {grup.map(g => (
          <Fragment key={g.grup}>
            <div className="cmp-row cmp-grup">{g.grup}</div>
            {g.baris.map(r => {
              const siap = !r.fitur || fiturLive(r.fitur);
              return (
                <div className={`cmp-row${siap ? "" : " cmp-np"}`} key={r.label}>
                  <span className="cmp-feature">{r.label}{!siap && <LabelDisiapkan kecil />}</span>
                  <span className="cmp-col">{render(r.trial)}</span>
                  <span className="cmp-col pop">{render(r.pro)}</span>
                  <span className="cmp-col gold">{render(r.life)}</span>
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </>
  );
}
