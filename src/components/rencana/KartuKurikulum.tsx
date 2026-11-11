"use client";

import "@/styles/kurikulum.css";
import Link from "next/link";
import { LabelDisiapkan } from "@/components/rencana/LabelDisiapkan";
import { BelumMulai, Strip } from "@/components/kurikulum/Bagian";
import { FASE, JUMLAH_UNIT, faseMinggu, fiturLive } from "@/lib/kurikulum-config";
import { dimulai } from "@/lib/kurikulum";
import { useKurikulum } from "@/lib/use-kurikulum";

/** Kartu Kurikulum paling atas /materi, versi "Sedang disiapkan"
    (HANDOFF-materi-bank-soal §2.2): bikin penasaran, tanpa tombol. */
export function KartuKurikulumDisiapkan({ level, kata, pola }: { level: string; kata: number; pola: number }) {
  return (
    <section className="card ku-prep" aria-label="Kurikulum, sedang disiapkan">
      <div>
        <div className="eyebrow" style={{ color: "var(--info-t)" }}>Kurikulum {level}<LabelDisiapkan /></div>
        <b className="kp-t">{JUMLAH_UNIT} minggu terarah sampai hari ujian</b>
        <p>Tiap minggu satu unit: kata, pola, dan jenis soal. Tingkat soal naik sendiri. Sambil nunggu, Kotoba & Bunpou di bawah tetap jalan dan progresnya ikut kebawa.</p>
        <div className="kp-ph">
          {FASE.map(f => (
            <div key={f.id} style={{ flex: f.minggu[1] - f.minggu[0] + 1 }}>
              <i style={{ background: f.warna }} />
              <b>{f.t}</b>
              <small>Minggu {f.minggu[0]}–{f.minggu[1]}{f.tingkat ? ` · ${f.tingkat}` : ""}</small>
            </div>
          ))}
        </div>
        <div className="kp-x">Belum ada tombol di sini. Kartu ini berubah sendiri begitu kurikulum siap.</div>
      </div>
      <div className="kp-as">
        <div><b>{kata.toLocaleString("id-ID")}</b><span>kata {level}</span></div>
        <div><b>{pola}</b><span>pola Bunpou</span></div>
        <div><b>T1–T3</b><span>soal orisinal bertingkat</span></div>
        <div><b>{JUMLAH_UNIT}</b><span>unit mingguan</span></div>
      </div>
    </section>
  );
}

/** Kartu Kurikulum live di /materi (HANDOFF-kurikulum §6 "Kartu di Materi"). */
export function KartuKurikulumLive({ level }: { level: string }) {
  const k = useKurikulum(level);
  if (!k.siap) return <section className="card kmc" aria-busy="true" style={{ minHeight: 120 }} />;
  if (k.belumMulai) return <BelumMulai level={level} penempatan={fiturLive("penempatan")} />;
  const u = k.unit[Math.min(26, k.cur) - 1];
  const fase = faseMinggu(u.u);
  const polaMulai = u.pola.filter(p => k.statusItem("pola", p) !== "baru").length;
  return (
    <Link className="kmc" href="/kurikulum">
      <span>
        <span className="eyebrow">Kurikulum {level} · {k.cur > 26 ? "masa cadangan" : `Minggu ${k.cur} dari 26`}</span>
        <b>Fase {fase.t} · minggu ini {u.kata.length} kata + {u.pola.length} pola</b>
        <Strip unit={k.unit} />
        <small>{dimulai(u.kataSt)} / {u.kata.length} kata dimulai · {polaMulai} / {u.pola.length} pola{k.sisaMinggu != null ? ` · ${k.sisaMinggu} minggu ke ujian` : ""}</small>
      </span>
      <span className="btn btn-g">Buka peta →</span>
    </Link>
  );
}
