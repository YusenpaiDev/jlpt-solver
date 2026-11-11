"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/rencana-tes.css";
import "@/styles/rencana-janji.css";
import "@/styles/kurikulum.css";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { honixSrc } from "@/lib/honix-pose";
import { ATURAN } from "@/lib/kurikulum-config";
import { JUMLAH_UNIT, nilaiPenempatan, susunJadwal, susunUnit, type Grup, type ModeWaktu, type PosisiBagian, type Unit } from "@/lib/kurikulum";
import { susunPenempatan, type Soal, type SoalKatalog } from "@/lib/soal-kurikulum";
import { muatBunpou, muatKotoba, muatPrioritas, type DekBunpou, type DekKotoba } from "@/lib/dek-materi";
import { tanggalLokal } from "@/lib/aktivitas";
import { catatItem, catatJenis, mulaiKurikulum, tandaiDikuasai } from "@/lib/kurikulum-db";
import { LABEL, penilaianJanji } from "@/lib/janji-belajar";
import { hariMenuju, labelSesi } from "@/lib/sesi-ujian";
import { DEV_BYPASS } from "@/lib/dev-materi";
import { Kuis, type Jawaban } from "@/components/kurikulum/Kuis";

const WARNA: Record<Grup, string> = { "文字・語彙": "var(--moji)", "文法": "var(--bunpou)", "読解": "var(--dokkai)" };
const KOMPOSISI: { k: Grup; n: number }[] = [{ k: "文字・語彙", n: 16 }, { k: "文法", n: 12 }, { k: "読解", n: 12 }];

interface Hasil { posisi: PosisiBagian[]; unitMulai: number; kata: number; pola: number; sisa: number }

/** Satu kalimat mode sisa waktu di hasil tes (detailnya di kepala /kurikulum). */
const TEKS_MODE: Record<Exclude<ModeWaktu, "normal">, (minggu: number, sampai: number) => string> = {
  padat: m => `Ujian ${m} minggu lagi, jadi unitnya dipadatin: sebagian minggu dapat 2 unit.`,
  kejar: (m, s) => `Ujian ${m} minggu lagi, gak cukup buat semua materi. Unit sampai ${s} dijadwalin, yang lebih penting duluan; sisanya tetap bisa diintip.`,
  akhir: m => `Ujian ${m} minggu lagi, jadi materi baru gak ditambah. Fokusnya ulang yang lemah dan set latihan format JLPT.`,
};

/** Langkah-langkah atas (onboarding): "Langkah 5 dari 6". */
function Atas({ langkah }: { langkah?: [number, number] }) {
  if (!langkah) return null;
  return (
    <div className="ob-top">
      <span className="ob-step">Langkah {langkah[0]} dari {langkah[1]}</span>
      <div className="ob-dots">{Array.from({ length: langkah[1] }, (_, i) => <i key={i} className={i < langkah[0] ? "" : "off"} />)}</div>
    </div>
  );
}

/** Tes penempatan: mulai → 40 soal → titik mulai kurikulum (HANDOFF-kurikulum §5). */
export function Penempatan({ level, ujian, pace, langkah, onSelesai }: {
  level: string;
  /** YYYY-MM-DD atau null */
  ujian: string | null;
  pace: number;
  langkah?: [number, number];
  /** dipanggil setelah kurikulum_user kesimpan; `sisa` = bagian materi yang belum dikuasai */
  onSelesai: (sisa: number) => void;
}) {
  const [fase, setFase] = useState<"mulai" | "soal" | "hasil">("mulai");
  const [dek, setDek] = useState<{ k: DekKotoba; b: DekBunpou; unit: Unit[] } | null>(null);
  const [dokkai, setDokkai] = useState<SoalKatalog[]>([]);
  const [seed, setSeed] = useState(() => Date.now() % 1e9);
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [simpan, setSimpan] = useState<"" | "jalan" | "gagal">("");

  useEffect(() => {
    let batal = false;
    void Promise.all([muatKotoba(level), muatBunpou(level), muatPrioritas(level)]).then(([k, b, p]) => {
      if (!batal) setDek({ k, b, unit: susunUnit(k.vocabulary, b.patterns, p) });
    });
    if (!DEV_BYPASS) {
      void createClient().rpc("soal_katalog", { p_level: level, p_kategori: "読解", p_n: 12 })
        .then(({ data }) => { if (!batal && Array.isArray(data)) setDokkai(data as SoalKatalog[]); });
    }
    return () => { batal = true; };
  }, [level]);

  const soal = useMemo<Soal[]>(() => (dek ? susunPenempatan(dek.unit, dek.k.vocabulary, dek.b.patterns, dokkai, seed) : []), [dek, dokkai, seed]);
  const segmen = KOMPOSISI.map(s => ({ k: s.k, n: soal.filter(x => x.grup === s.k).length })).filter(s => s.n > 0);

  const selesai = (j: Jawaban[]) => {
    const { posisi, unitMulai } = nilaiPenempatan(j.map(x => ({ grup: x.soal.grup, unit: x.soal.unit, benar: x.benar })), ATURAN.penempatan);
    const lewat = dek!.unit.slice(0, unitMulai - 1);
    const kata = lewat.reduce((n, u) => n + u.kata.length, 0);
    const pola = lewat.reduce((n, u) => n + u.pola.length, 0);
    const total = dek!.unit.reduce((n, u) => n + u.kata.length + u.pola.length, 0);
    setHasil({ posisi, unitMulai, kata, pola, sisa: total ? 1 - (kata + pola) / total : 1 });
    setFase("hasil");
    /* Jawaban tes ikut ngisi tingkat jenis soal & jadwal ulang kata/pola. */
    if (!DEV_BYPASS) for (const x of j) {
      if (x.pilih == null) continue;
      if (x.soal.jenis) void catatJenis(x.soal.jenis, x.benar);
      if (x.soal.item) void catatItem(x.soal.item.jenis, x.soal.item.kunci, level, x.benar);
    }
  };

  const mulaiDari = async (unitMulai: number, h: Hasil | null) => {
    setSimpan("jalan");
    try {
      if (!DEV_BYPASS) {
        await mulaiKurikulum(level, unitMulai, ujian, h ? { posisi: h.posisi, kata: h.kata, pola: h.pola } : undefined);
        if (h && dek) await tandaiDikuasai(level, dek.unit.slice(0, unitMulai - 1).flatMap(u => [
          ...u.kata.map(k => ({ jenis: "kata" as const, kunci: k })), ...u.pola.map(p => ({ jenis: "pola" as const, kunci: p })),
        ]));
      }
      onSelesai(h?.sisa ?? 1);
    } catch { setSimpan("gagal"); }
  };

  if (fase === "soal" && soal.length) {
    return <div className="rbk"><Kuis soal={soal} segmen={segmen} label="Gak ada batas waktu" belumTahu detikPerSoal={22} onKeluar={() => setFase("mulai")} onSelesai={selesai} /></div>;
  }

  if (fase === "hasil" && hasil) {
    const hari = ujian ? hariMenuju(ujian, new Date()) : null;
    const v = penilaianJanji(level, hari, pace, hasil.sisa);
    const sisaUnit = JUMLAH_UNIT - hasil.unitMulai + 1;
    const jadwal = susunJadwal({ level, tanggal_mulai: tanggalLokal(), unit_mulai: hasil.unitMulai, tanggal_ujian: ujian }, ATURAN.waktu);
    const awal = hasil.posisi.filter(p => p.k !== "読解").sort((a, b) => a.minggu - b.minggu)[0];
    return (
      <div className="rbk"><div className="ob" style={{ maxWidth: 760 }}>
        <Atas langkah={langkah} />
        <section className="card tr-h">
          <div>
            <div className="eyebrow">Hasil tes penempatan</div>
            <div className="tr-v">Mulai dari minggu {hasil.unitMulai}</div>
            <div className="pen-big">{JUMLAH_UNIT} minggu jadi <b>{sisaUnit}</b></div>
            <div className="tr-s" style={{ marginTop: 6 }}>{hasil.unitMulai > 1
              ? `Materi minggu 1–${hasil.unitMulai - 1} udah kamu kuasai, jadi langsung dilewati.${jadwal.mode === "normal" && ujian ? ` Sisa ${hasil.unitMulai - 1} minggu jadi cadangan sebelum ujian.` : ""}`
              : "Kita mulai dari awal biar fondasinya kuat. Unit yang udah kamu bisa bakal kerasa cepet."}</div>
          </div>
          <div className="tr-hx">{/* eslint-disable-next-line @next/next/no-img-element -- PNG transparan Honix */}<img className="hx" src={honixSrc("lulus")} alt="Honix senang" /></div>
        </section>
        {jadwal.mode !== "normal" && <p className="ku-mode" role="note">{TEKS_MODE[jadwal.mode](jadwal.minggu.length, jadwal.sampai)}</p>}
        <section className="card sr">
          <div className="h2">Posisi per bagian</div>
          {hasil.posisi.filter(p => p.total > 0).map(p => (
            <div className="srr" key={p.k}>
              <div className="srk" lang="ja">{p.k}<small>{p.total ? `${Math.round((p.benar / p.total) * 100)}% benar` : "gak ada soal"}</small></div>
              <div className="srb"><i style={{ width: `${(p.minggu / JUMLAH_UNIT) * 100}%`, background: WARNA[p.k] }} /></div>
              <div className="srv">{p.k === "読解"
                ? <><b>{p.benar}</b><span> / {p.total}</span><small className="note">gak nentuin titik mulai</small></>
                : <><b>Minggu {p.minggu}</b><span> / {JUMLAH_UNIT}</span><small className="note">setara udah selesai</small></>}</div>
            </div>
          ))}
          {awal && <p className="note" style={{ marginTop: 10 }}>Titik mulai ikut bagian yang paling awal (<span lang="ja">{awal.k}</span>), biar gak ada yang bolong. Bacaan gak dibagi per unit, jadi <span lang="ja">読解</span> cuma ngisi tingkat jenis soal.</p>}
        </section>
        <div className="pen-g">
          <div className="card pen-k"><b>{hasil.kata} kata</b><span>langsung ditandai dikuasai</span><small>Tetap muncul sesekali di ulangan, biar gak lupa.</small></div>
          <div className="card pen-k"><b>{hasil.pola} pola</b><span>langsung ditandai dikuasai</span><small>Yang mirip-mirip tetap masuk latihan bandingin pola.</small></div>
        </div>
        {v && (
          <div className={`card jn-v v-${v.v}`} style={{ marginTop: 14 }}>
            <div className="jn-vl"><i />{LABEL[v.v][0]}</div>
            <p>{sisaUnit} unit, <b>{pace} menit/hari</b>{ujian ? <>, ujian <b>{labelSesi(ujian)}</b></> : null}. {langkah ? "Langkah berikutnya: janji di awal." : `Butuh ±${v.butuh} jam, kamu punya ±${v.punya} jam.`}</p>
          </div>
        )}
        {simpan === "gagal" && <p className="bad-t" role="alert" style={{ marginTop: 12, fontSize: 13 }}>Hasilnya belum kesimpan. Coba lagi sebentar.</p>}
        <div className="ob-a">
          <button type="button" className="btn btn-p btn-lg" disabled={simpan === "jalan"} onClick={() => mulaiDari(hasil.unitMulai, hasil)}>{simpan === "jalan" ? "Menyimpan…" : langkah ? "Lanjut ke janji" : "Mulai kurikulum"}</button>
          <button type="button" className="btn btn-q" onClick={() => { setSeed(s => s + 1); setFase("mulai"); }}>Ulangi tes</button>
        </div>
      </div></div>
    );
  }

  return (
    <div className="rbk"><div className="ob">
      <Atas langkah={langkah} />
      <div className="eyebrow">Tes penempatan</div>
      <h1 className="h1">Kamu mulai dari mana?<span className="jp-g" lang="ja">実力</span></h1>
      <p className="sub">Biar gak ngulang yang udah kamu bisa. Hasilnya nentuin titik mulai kurikulum {level}-mu.</p>
      <div className="card pen-c">
        <div className="pen-st">
          <div><b>±15 mnt</b><span>perkiraan</span></div>
          <div><b>{soal.length || 40} soal</b><span>campuran</span></div>
          <div><b>{segmen.length || 3} bagian</b><span>tanpa <span lang="ja">聴解</span></span></div>
        </div>
        <div className="comp">{(segmen.length ? segmen : KOMPOSISI).map(s => <div key={s.k} style={{ flex: s.n, background: WARNA[s.k as Grup] }} />)}</div>
        <div className="comp-l">{(segmen.length ? segmen : KOMPOSISI).map(s => <span key={s.k}><i style={{ background: WARNA[s.k as Grup] }} /><span lang="ja">{s.k}</span> {s.n}</span>)}</div>
        <ul className="rules">
          <li>Gak ada batas waktu. Waktunya cuma dicatat.</li>
          <li>Gak tahu jawabannya? Pilih &quot;Belum tahu&quot;. Itu juga bantu Honix nentuin posisimu.</li>
          <li>Bisa diulang kapan aja dari Pengaturan.</li>
        </ul>
      </div>
      {simpan === "gagal" && <p className="bad-t" role="alert" style={{ marginTop: 12, fontSize: 13 }}>Belum kesimpan. Coba lagi sebentar.</p>}
      <div className="ob-a">
        <button type="button" className="btn btn-p btn-lg" disabled={!soal.length} onClick={() => setFase("soal")}>{soal.length ? "Mulai tes · ±15 menit" : "Menyiapkan soal…"}</button>
        <button type="button" className="btn btn-q" disabled={simpan === "jalan"} onClick={() => mulaiDari(1, null)}>Lewati, mulai dari minggu 1</button>
      </div>
    </div></div>
  );
}
