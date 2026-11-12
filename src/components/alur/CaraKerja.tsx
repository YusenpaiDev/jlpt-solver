"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/rencana-janji.css";
import "@/styles/kurikulum.css";
import "@/styles/alur.css";
import { LabelDisiapkan } from "@/components/rencana/LabelDisiapkan";
import { fiturLive, JUMLAH_UNIT, type FiturBaru } from "@/lib/kurikulum-config";
import { PACE_MISI, tingkatPace } from "@/lib/misi-harian";
import { honixSrc } from "@/lib/honix-pose";
import { PasangPengingat } from "@/components/alur/PasangPengingat";

const tanggalPanjang = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

/** Penutup onboarding (HANDOFF-alur-belajar §2). Gak nyebut Lembar Tugas, Bank Soal, Kamus, Catatan. */
export function CaraKerja({ level, ujian, pace, unitMulai, langkah, onMulai }: {
  level: string;
  /** YYYY-MM-DD, atau null kalau belum milih tanggal */
  ujian: string | null;
  pace: number;
  /** titik mulai kurikulum; null = tes penempatan dilewati; undefined = gak ada tes */
  unitMulai: number | null | undefined;
  langkah: [number, number];
  onMulai: () => void;
}) {
  const P = PACE_MISI[tingkatPace(pace)];
  const baris: { w: string; t: string; p: string; f?: FiturBaru; main?: true }[] = [
    { w: "Tiap hari", t: `Misi ${P.m} menit`, p: "Ulang yang mulai lupa, materi baru, lalu latihan soal. Honix yang milih isinya, kamu tinggal mulai.", main: true },
    { w: "Tiap Senin", t: "Ulangan ±10 menit", p: "Cek yang nempel dari minggu lalu. Yang lupa masuk misi lagi.", f: "ulangan" },
    { w: "Tiap bulan", t: "Simulasi format JLPT", p: "Ujian penuh, waktunya cuma dicatat. Biar hari H gak kaget.", f: "simulasi" },
    { w: "Terus jalan", t: "Perkiraan skor", p: "Muncul sendiri setelah ±150 jawaban. Perkiraan, bukan skor resmi.", f: "perkiraan" },
  ];
  return (
    <div className="rbk">
      <div className="ob" style={{ maxWidth: 780 }}>
        <div className="ob-top">
          <span className="ob-step">Langkah {langkah[0]} dari {langkah[1]}</span>
          <div className="ob-dots">{Array.from({ length: langkah[1] }, (_, i) => <i key={i} className={i < langkah[0] ? "" : "off"} />)}</div>
        </div>
        <div className="eyebrow">Terakhir</div>
        <h1 className="h1">Cara kerja Honix<span className="jp-g" lang="ja">使い方</span></h1>
        <div className="cwk-sum">
          <span className="chip sel">{level} · {ujian ? `ujian ${tanggalPanjang(ujian)}` : "tanggal ujian belum dipilih"}</span>
          <span className="chip">{P.e} {P.t} · {P.m} menit/hari</span>
          {fiturLive("kurikulum") && unitMulai !== undefined && (
            <span className="chip">{unitMulai ? `Mulai minggu ${unitMulai} dari ${JUMLAH_UNIT}` : "Mulai dari minggu 1"}</span>
          )}
        </div>
        <div className="cwk">
          <div>
            <ul className="card cwk-l">
              {baris.map(r => (
                <li key={r.w} className={`cwk-r${r.main ? " main" : ""}`}>
                  <span className="cwk-w">{r.w}</span>
                  <div><b>{r.t}{r.f && !fiturLive(r.f) && <LabelDisiapkan />}</b><p>{r.p}</p></div>
                </li>
              ))}
            </ul>
            <p className="cwk-n">Cukup ingat satu: <b style={{ color: "var(--text)" }}>tiap hari buka Honix, kerjain misi.</b> Sisanya Honix yang atur.</p>
            {/* Biar yang lupa buka app tetap diingetin — lewat kalender HP sendiri. */}
            <PasangPengingat menit={P.m} />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- PNG transparan Honix */}
          <div className="cwk-hx"><img className="hx" src={honixSrc("senang")} alt="Honix" /></div>
        </div>
        <div className="ob-a">
          <button type="button" className="btn btn-p btn-lg" onClick={onMulai}>Mulai misi pertama</button>
          <span className="note">Penjelasan ini bisa dibuka lagi lewat tombol <b>?</b> di atas.</span>
        </div>
      </div>
    </div>
  );
}
