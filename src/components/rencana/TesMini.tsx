"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/rencana-strategi.css";
import "@/styles/rencana-tes.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { tanggalLokal } from "@/lib/aktivitas";
import { honixSrc } from "@/lib/honix-pose";
import { strategiUntuk } from "@/lib/strategi-ujian";
import { KOMPOSISI, seninDari, skorTes, type HasilTes } from "@/lib/tes-mini";

const DEV_BYPASS = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "1";

type PerCat = Record<string, { a?: number; c?: number }>;
export interface SesiTes { id: string; total: number; stats?: { answered?: number; perCat?: PerCat } | null }
interface BarisTes { minggu: string; sesi_id: string }

const WARNA: Record<string, string> = { "言語知識": "goi", "読解": "dokkai", "聴解": "choukai", "言語知識・読解": "bunpou" };
/* Latihan paling nyambung buat bagian yang paling tipis. */
const LATIHAN: Record<string, string> = { "言語知識": "/latihan/kilat", "言語知識・読解": "/latihan/kilat", "読解": "/latihan/set", "聴解": "/latihan/set" };
const beda = (x: number) => (x > 0 ? `+${x}` : x < 0 ? `${x}` : "±0");

/** Tab Progres → Tes mini (handoff Rencana Belajar §9). */
export function TesMini({ level, sesi, choukai30 }: {
  level: string;
  /** Semua sesi user (dari Progres), dipakai buat skor tes mini. */
  sesi: SesiTes[];
  /** Jawaban latihan 聴解 30 hari terakhir. */
  choukai30: { a: number; c: number } | null;
}) {
  const router = useRouter();
  const [baris, setBaris] = useState<BarisTes[] | null>(null);
  const [dev, setDev] = useState<Map<string, SesiTes> | null>(null);
  const [mulai, setMulai] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const senin = seninDari(tanggalLokal());

  useEffect(() => {
    let batal = false;
    (async () => {
      if (DEV_BYPASS) {
        const mode = new URLSearchParams(window.location.search).get("tes") ?? "intro";
        const lalu = { id: "lalu", total: 15, stats: { answered: 15, perCat: { "文字": { a: 4, c: 3 }, "語彙": { a: 2, c: 1 }, "文法": { a: 5, c: 3 }, "読解": { a: 4, c: 2 } } } };
        const ini: SesiTes = mode === "lulus"
          ? { id: "ini", total: 15, stats: { answered: 15, perCat: { "文字": { a: 4, c: 4 }, "語彙": { a: 2, c: 2 }, "文法": { a: 5, c: 4 }, "読解": { a: 4, c: 3 } } } }
          : mode === "gagal"
            ? { id: "ini", total: 15, stats: { answered: 15, perCat: { "文字": { a: 4, c: 4 }, "語彙": { a: 2, c: 2 }, "文法": { a: 5, c: 5 }, "読解": { a: 4, c: 1 } } } }
            : { id: "ini", total: 15, stats: { answered: 6, perCat: {} } };
        setDev(new Map([["lalu", lalu], ["ini", ini]]));
        const lama = { minggu: "2026-11-02", sesi_id: "lalu" };
        setBaris(mode === "intro" ? [lama] : [{ minggu: senin, sesi_id: "ini" }, lama]);
        return;
      }
      const { data } = await createClient().from("tes_mini").select("minggu, sesi_id").order("minggu", { ascending: false });
      if (!batal) setBaris((data ?? []) as BarisTes[]);
    })().catch(() => { if (!batal) setBaris([]); });
    return () => { batal = true; };
  }, [senin]);

  if (!baris) return null;
  const L = strategiUntuk(level);
  const cari = (id: string) => dev?.get(id) ?? sesi.find(s => s.id === id);
  const selesai = (s?: SesiTes) => Boolean(s && s.total > 0 && (s.stats?.answered ?? 0) >= s.total);
  /* Mode dev gak punya riwayat 聴解 — pakai contoh biar semua state kelihatan. */
  const cho = dev ? { a: 20, c: 14 } : choukai30;
  const hasilDari = (s?: SesiTes) => (s ? skorTes(L, s.stats?.perCat ?? {}, cho) : null);

  const iniBaris = baris.find(b => b.minggu === senin);
  const iniSesi = iniBaris ? cari(iniBaris.sesi_id) : undefined;
  const sebelum = baris.filter(b => b.minggu < senin).map(b => cari(b.sesi_id)).find(selesai);
  const prev = hasilDari(sebelum);
  const ke = baris.filter(b => b.minggu <= senin).length + (iniBaris ? 0 : 1);

  const buka = async () => {
    if (DEV_BYPASS || mulai) return;
    setMulai(true); setPesan(null);
    const { data, error } = await createClient().rpc("buat_tes_mini", { p_minggu: senin, p_level: level });
    if (error) {
      setMulai(false);
      if (error.message.includes("subscription_required")) { router.push("/langganan"); return; }
      /* Alasan asli dari database ikut ditampilin kecil, biar gagalnya gampang dilacak. */
      setPesan(error.message.includes("belum cukup") ? `Soal ${level} di Bank Soal belum cukup buat tes mini.` : `Tes mini belum bisa dibuat. Coba lagi sebentar. (${error.message.slice(0, 140)})`);
      return;
    }
    router.push(`/latihan/${data as string}`);
  };

  /* ── Hasil ── */
  if (iniSesi && selesai(iniSesi)) {
    const r = hasilDari(iniSesi) as HasilTes;
    const gagal = r.lulus === false;
    const kelas = r.lulus === true ? "" : r.lulus === false ? " no" : " none";
    const totalAda = r.total ?? r.bagian.reduce((n, b) => n + (b.skor ?? 0), 0);
    const lemah = r.bawahMinimum >= 0 ? r.bawahMinimum
      : r.bagian.map((b, i) => [b.skor === null ? 2 : b.skor / b.max, i] as const).sort((a, b) => a[0] - b[0])[0][1];
    const bLemah = r.bagian[lemah];
    const bawah = r.bawahMinimum >= 0 ? r.bagian[r.bawahMinimum] : null;
    return (
      <div className="rbk">
        <section className={`card tr-h${kelas}`}>
          <div>
            <div className="eyebrow">Hasil tes mini · minggu ke-{ke}</div>
            <div className="tr-v">Perkiraan: {r.lulus === true ? "lulus" : r.lulus === false ? "belum lulus" : "belum lengkap"}</div>
            <div className="tr-n">{r.total ?? "—"}<span>/ 180</span></div>
            <div className="tr-s">Nilai lulus {L.lulus}{prev?.total != null && r.total != null ? ` · minggu lalu ${prev.total} (${beda(r.total - prev.total)})` : ""}{r.total === null ? ` · ${totalAda} dari bagian yang udah kehitung` : ""}</div>
            {bawah && r.total !== null && r.total >= L.lulus && (
              <div className="why">Total <b>{r.total}</b> udah lewat nilai lulus {L.lulus}, tapi <b lang="ja">{bawah.k}</b> cuma <b>{bawah.skor}</b>. Di bawah minimum {bawah.min} di satu bagian = <b>gak lulus</b>, walau total cukup.</div>
            )}
          </div>
          <div className="tr-hx">
            {/* eslint-disable-next-line @next/next/no-img-element -- PNG transparan Honix, ukuran tetap */}
            <img className="hx" src={honixSrc(r.lulus === true ? "lulus" : "bangkit")} alt={r.lulus === true ? "Honix lulus" : "Honix bangkit"} />
          </div>
        </section>
        <section className="card sr">
          <div className="h2">Per bagian</div>
          {r.bagian.map((b, i) => {
            const low = b.skor !== null && b.skor < b.min;
            const pb = prev?.bagian[i]?.skor;
            return (
              <div key={b.k} className={`srr${low ? " low" : ""}`}>
                <div className="srk" lang="ja">{b.k}<small>{b.s}{b.dariLatihan ? " · dari latihan 30 hari" : ""}</small></div>
                <div className="srb"><i style={{ width: `${((b.skor ?? 0) / b.max) * 100}%`, background: low ? "var(--danger)" : `var(--${WARNA[b.k] ?? "bunpou"})` }} /><em style={{ left: `${(b.min / b.max) * 100}%` }}><span>min {b.min}</span></em></div>
                <div className="srv"><b>{b.skor ?? "—"}</b><span> / {b.max}</span>
                  <small className={low ? "bad-t" : b.skor === null ? "" : "ok-t"}>{low ? "Di bawah minimum" : b.skor === null ? "Belum ada latihan 聴解" : "Aman"}{b.skor !== null && pb != null ? ` · ${beda(b.skor - pb)}` : ""}</small>
                </div>
              </div>
            );
          })}
          <p className="note" style={{ marginTop: 12 }}>Perkiraan dari 15 soal 筆記 + latihan 聴解 30 hari, bukan skor resmi.</p>
          <div className="tr-a">
            <Link className="btn btn-p" href={LATIHAN[bLemah.k] ?? "/latihan/set"}>Latihan <span lang="ja">{bLemah.k}</span>{gagal ? " sekarang" : " (paling tipis)"}</Link>
            <Link className="btn btn-g" href="/strategi">Lihat strategi</Link>
          </div>
        </section>
      </div>
    );
  }

  /* ── Mulai / lanjutin ── */
  const dijawab = iniSesi?.stats?.answered ?? 0;
  return (
    <div className="rbk">
      <div className="head"><div>
        <div className="eyebrow">Minggu ke-{ke} · {iniBaris ? "belum selesai" : "belum dikerjain"}</div>
        <h1 className="h1">Tes mini<span className="jp-g" lang="ja">週テスト</span></h1>
        <p className="sub">Sekali seminggu. Buat lihat perkiraan skormu kalau ujiannya hari ini.</p>
      </div></div>
      <div className="tes-in">
        <section className="card ti">
          <div className="eyebrow">Isi tes · {level}</div>
          <div className="ti-big">±12 menit<span>·</span>15 soal</div>
          <div className="comp" aria-hidden="true">{KOMPOSISI.map(c => <div key={c.k} style={{ flex: c.n, background: `var(--${c.c})` }} />)}</div>
          <div className="comp-l">{KOMPOSISI.map(c => <span key={c.k}><i style={{ background: `var(--${c.c})` }} />{c.k} {c.n}</span>)}</div>
          <ul className="rules">
            <li>Campuran 筆記 level {level}, diambil acak dari Bank Soal.</li>
            <li>聴解 diperkirakan dari latihan 聴解 30 hari terakhir.</li>
            <li>Waktu cuma dicatat. Gak ada yang maksa pindah soal.</li>
            <li>Hasilnya perkiraan skor per bagian, dibanding nilai lulus dan nilai minimum.</li>
          </ul>
          <div className="misi-cta">
            {iniBaris
              ? <Link className="btn btn-p btn-lg" href={`/latihan/${iniBaris.sesi_id}`}>Lanjutin tes mini · {dijawab}/{iniSesi?.total ?? 15}</Link>
              : <button type="button" className="btn btn-p btn-lg" onClick={buka} disabled={mulai}>{mulai ? "Nyiapin soal…" : "Mulai tes mini"}</button>}
          </div>
          {pesan && <p className="note" role="alert" style={{ marginTop: 10, color: "var(--danger)" }}>{pesan}</p>}
        </section>
        <section className="card ti">
          <div className="eyebrow" style={{ color: "var(--dim)" }}>Minggu lalu</div>
          {prev ? (
            <>
              <div className="ti-big">{prev.total ?? "—"}<span>/</span>180</div>
              <p className="tr-s">Perkiraan skor. Nilai lulus {L.lulus}.</p>
              <div className="mins" style={{ marginTop: 18 }}>
                {prev.bagian.map(b => (
                  <div className="mn" key={b.k}>
                    <div className="mn-k" lang="ja">{b.k}</div>
                    <div className="mn-b"><em style={{ width: `${((b.skor ?? 0) / b.max) * 100}%`, background: `var(--${WARNA[b.k] ?? "bunpou"})` }} /><i style={{ left: `${(b.min / b.max) * 100}%` }} /></div>
                    <div className="mn-v">{b.skor ?? "—"} / {b.max}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="tr-s" style={{ marginTop: 10 }}>Belum ada tes sebelumnya. Hasil minggu ini jadi patokan buat minggu depan.</p>
          )}
        </section>
      </div>
    </div>
  );
}
