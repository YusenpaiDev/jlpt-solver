"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/rencana-tes.css";
import "@/styles/rencana-strategi.css";
import "@/styles/rencana-misi.css";
import "@/styles/kurikulum.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { honixSrc } from "@/lib/honix-pose";
import { strategiUntuk } from "@/lib/strategi-ujian";
import { perkiraanSkor, jadwalSimulasi, tempo, tambahHari } from "@/lib/kurikulum";
import { susunPerjalanan } from "@/lib/perjalanan-soal";
import { bukaSet, muatBankSoal, urlSet } from "@/lib/bank-soal-muat";
import { simpanSimulasi, type BarisSimulasi } from "@/lib/kurikulum-db";
import { useKurikulum } from "@/lib/use-kurikulum";
import { DEV_BYPASS } from "@/lib/dev-materi";
import type { SetUjian } from "@/lib/bank-soal";
import { tglPendek } from "@/components/kurikulum/Bagian";

const WARNA: Record<string, string> = { "言語知識": "var(--goi)", "言語知識・読解": "var(--goi)", "読解": "var(--dokkai)", "聴解": "var(--choukai)" };
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const hariDari = (t: string) => HARI[new Date(`${t}T12:00:00Z`).getUTCDay()];
/** Pos ke-5 dst: latihan tambahan pakai set di Bank Soal (§12). */
const SARAN_BANK_SOAL = 5;

interface SesiSim { id: string; section: string | null; total: number; score: number | null; stats: { answered?: number; perCat?: Record<string, { a: number; c: number }>; detik?: number } | null }

function devBaris(mode: string | null, hariIni: string): BarisSimulasi[] {
  if (mode === "simulasi-mulai") return [];
  return [
    { n: 1, tanggal: tambahHari(hariIni, -35), sesi: [], skor: [{ k: "言語知識", nilai: 34, max: 60 }, { k: "読解", nilai: 24, max: 60 }, { k: "聴解", nilai: 31, max: 60 }], menit: { "筆記": 104 } },
    { n: 2, tanggal: tambahHari(hariIni, -7), sesi: [], skor: [{ k: "言語知識", nilai: 39, max: 60 }, { k: "読解", nilai: 29, max: 60 }, { k: "聴解", nilai: 34, max: 60 }], menit: { "筆記": 92 } },
  ];
}

/** Tab Simulasi di Progres (HANDOFF-kurikulum §12): jadwal, mulai, hasil + tempo. */
export function SimulasiTab({ level }: { level: string }) {
  const router = useRouter();
  const k = useKurikulum(level);
  const L = strategiUntuk(level);
  const [baris, setBaris] = useState<BarisSimulasi[] | null>(null);
  const [sesi, setSesi] = useState<Map<string, SesiSim>>(new Map());
  const [set, setSet] = useState<SetUjian[]>([]);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const muat = useCallback(async () => {
    const bs = await muatBankSoal();
    setSet(bs ?? []);
    if (DEV_BYPASS) { setBaris(devBaris(new URLSearchParams(window.location.search).get("dev"), k.hariIni)); return; }
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("simulasi").select("n, tanggal, sesi, skor, menit").eq("user_id", user.id).order("n");
    const rows = (data ?? []) as BarisSimulasi[];
    const ids = rows.flatMap(r => r.sesi);
    if (ids.length) {
      const { data: s } = await supabase.from("sessions").select("id, total, score, ai_result->section, ai_result->stats").in("id", ids);
      setSesi(new Map(((s ?? []) as SesiSim[]).map(x => [x.id, x])));
    }
    setBaris(rows);
  }, [k.hariIni]);
  useEffect(() => { void muat(); }, [muat]);

  const jadwal = useMemo(() => jadwalSimulasi(k.kur?.tanggal_mulai ?? k.hariIni, k.kur?.tanggal_ujian ?? null), [k.kur, k.hariIni]);
  const pos = useMemo(() => susunPerjalanan(set.filter(s => s.level === level)), [set, level]);
  const totalMenit = L.waktu.reduce((n, b) => n + b.m, 0);
  const targetHikki = L.waktu.filter(b => b.c !== "choukai").reduce((n, b) => n + b.m, 0);

  if (!baris || !k.siap) return <div className="rbk"><p className="ku-muat" role="status">Memuat simulasi…</p></div>;

  const aktif = baris.find(b => !b.skor);
  const selesai = baris.filter(b => b.skor);
  const n = aktif?.n ?? baris.length + 1;

  /* Hasil per bagian dari sesi 筆記 + 聴解 simulasi. */
  const nilaiDari = (b: BarisSimulasi) => {
    const perCat: Record<string, { a: number; c: number }> = {};
    for (const id of b.sesi) for (const [c, v] of Object.entries(sesi.get(id)?.stats?.perCat ?? {})) {
      const o = (perCat[c] ??= { a: 0, c: 0 }); o.a += v.a; o.c += v.c;
    }
    return perkiraanSkor(perCat, L.skor, L.lulus, { minTotal: 0, minBagian: 0, akurat: 0, hari: 0 });
  };

  const mulai = async () => {
    const p = pos.find(x => x.status === "belum" && x.hikki?.status === "belum") ?? pos.find(x => x.hikki && x.hikki.status !== "segera");
    if (!p?.hikki) { setGalat(`Belum ada set ${level} yang siap buat simulasi.`); return; }
    setSibuk(true); setGalat(null);
    const r = await bukaSet(p.hikki.set);
    if (!("id" in r)) { setSibuk(false); if (r.galat === "langganan") router.push("/langganan"); else setGalat("Simulasi belum bisa dimulai. Coba lagi sebentar."); return; }
    try {
      if (!DEV_BYPASS) await simpanSimulasi({ n, tanggal: k.hariIni, sesi: [r.id], skor: null, menit: null });
      router.push(urlSet(p.hikki.set, r.id));
    } catch { setSibuk(false); setGalat("Simulasi belum kesimpan. Coba lagi sebentar."); }
  };

  const lanjutChoukai = async (b: BarisSimulasi) => {
    const hikkiId = b.sesi[0];
    const p = pos.find(x => x.hikki?.set.id === hikkiId);
    if (!p?.choukai || p.choukai.status === "segera") { await tutup(b); return; }
    setSibuk(true);
    const r = await bukaSet(p.choukai.set);
    if (!("id" in r)) { setSibuk(false); setGalat("聴解 belum bisa dibuka. Coba lagi sebentar."); return; }
    try {
      await simpanSimulasi({ ...b, sesi: [hikkiId, r.id] });
      router.push(urlSet(p.choukai.set, r.id));
    } catch { setSibuk(false); setGalat("Belum kesimpan. Coba lagi sebentar."); }
  };

  /* Semua bagian kelar → kunci skor & menit ke baris simulasi. */
  async function tutup(b: BarisSimulasi) {
    const p = nilaiDari(b);
    const hikki = sesi.get(b.sesi[0]);
    try {
      await simpanSimulasi({ ...b, skor: p.bagian.map(x => ({ k: x.k, nilai: x.nilai, max: x.max })), menit: hikki?.stats?.detik ? { "筆記": Math.round(hikki.stats.detik / 60) } : null });
      await muat();
    } catch { setGalat("Hasil belum kesimpan. Coba lagi sebentar."); }
  }

  const terakhir = selesai[selesai.length - 1];
  const sebelumnya = selesai[selesai.length - 2];
  return (
    <div className="rbk">
      {terakhir && !aktif && <HasilSimulasi b={terakhir} lalu={sebelumnya} level={level} targetHikki={targetHikki} />}
      <div className="sim-g" style={{ marginTop: terakhir && !aktif ? 16 : 0 }}>
        <section className="card tcard">
          {aktif ? (
            <BerjalanSimulasi b={aktif} sesi={sesi} sibuk={sibuk} onChoukai={() => lanjutChoukai(aktif)} onTutup={() => tutup(aktif)} />
          ) : (
            <>
              <div className="eyebrow">Simulasi {n}{jadwal[n - 1] ? ` · jadwal ${hariDari(jadwal[n - 1])} ${tglPendek(jadwal[n - 1])}` : ""}</div>
              <div className="h2" style={{ marginTop: 6 }}>Total {totalMenit} menit + jeda</div>
              <div className="tl-bar">{L.waktu.map(b => <div key={b.k} style={{ flex: b.m, background: `var(--${b.c})` }} lang="ja">{b.k} · {b.m}</div>)}</div>
              <div className="tl-list">{L.waktu.map(b => <div className="tl-r" key={b.k}><span lang="ja"><i style={{ background: `var(--${b.c})` }} />{b.k}</span><b>target {b.m} menit</b></div>)}</div>
              <ul className="rules">
                <li>Lewat target? Soalnya tetap bisa diselesaikan, cuma dicatat.</li>
                <li><span><span lang="ja">聴解</span> ikut audio, jadi waktunya pasti sama.</span></li>
                <li>Jadwalnya saran. Mau dikerjain hari lain juga boleh.</li>
                <li>Pakai satu set latihan format JLPT yang belum kamu kerjain.</li>
              </ul>
              {galat && <p className="bad-t" role="alert" style={{ fontSize: 13 }}>{galat}</p>}
              <div className="misi-cta">
                <button type="button" className="btn btn-p btn-lg" disabled={sibuk} onClick={mulai}>{sibuk ? "Menyiapkan…" : `Mulai simulasi · ±${(totalMenit / 60).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jam`}</button>
                <Link className="btn btn-q" href="/">Nanti aja</Link>
              </div>
            </>
          )}
        </section>
        <section className="card tcard">
          <div className="h2">Jadwal simulasi</div>
          {jadwal.length ? (
            <ul className="sim-l">
              {jadwal.map((t, i) => {
                const r = baris.find(b => b.n === i + 1);
                const tot = r?.skor?.reduce((s, x) => s + x.nilai, 0);
                const nx = i + 1 === n;
                return (
                  <li key={t} className={r?.skor ? "ok" : nx ? "nx" : ""}>
                    <span className="d">{r?.skor ? "✓" : i + 1}</span>
                    <span>Simulasi {i + 1} · {hariDari(t)} {tglPendek(t)}<small>{i === jadwal.length - 1 ? "2 minggu sebelum ujian" : ""}{nx ? `${i === jadwal.length - 1 ? " · " : ""}berikutnya` : ""}</small></span>
                    {tot != null ? <b>{tot} / {r!.skor!.reduce((s, x) => s + x.max, 0)}</b> : <span />}
                  </li>
                );
              })}
            </ul>
          ) : <p className="note" style={{ marginTop: 10 }}>Pilih tanggal ujian di Pengaturan biar jadwalnya kebentuk.</p>}
          <p className="note" style={{ marginTop: 10 }}>Setelah simulasi {SARAN_BANK_SOAL - 1}, latihan tambahan pakai set di Bank Soal.</p>
        </section>
      </div>
    </div>
  );
}

function BerjalanSimulasi({ b, sesi, sibuk, onChoukai, onTutup }: { b: BarisSimulasi; sesi: Map<string, SesiSim>; sibuk: boolean; onChoukai: () => void; onTutup: () => void }) {
  const hikki = sesi.get(b.sesi[0]);
  const choukai = b.sesi[1] ? sesi.get(b.sesi[1]) : undefined;
  const hikkiKelar = hikki?.score != null;
  const choukaiKelar = choukai?.score != null;
  return (
    <>
      <div className="eyebrow">Simulasi {b.n} · lagi jalan</div>
      <div className="h2" style={{ marginTop: 6 }}>Mulai {tglPendek(b.tanggal)}</div>
      <ul className="sim-l">
        <li className={hikkiKelar ? "ok" : "nx"}><span className="d">{hikkiKelar ? "✓" : 1}</span><span lang="ja">筆記<small>{hikkiKelar ? "Selesai" : `${hikki?.stats?.answered ?? 0} dari ${hikki?.total ?? "–"} soal`}</small></span><span /></li>
        <li className={choukaiKelar ? "ok" : hikkiKelar ? "nx" : ""}><span className="d">{choukaiKelar ? "✓" : 2}</span><span lang="ja">聴解<small>{choukaiKelar ? "Selesai" : choukai ? `${choukai.stats?.answered ?? 0} dari ${choukai.total} soal` : "Setelah 筆記"}</small></span><span /></li>
      </ul>
      <div className="misi-cta">
        {!hikkiKelar ? <Link className="btn btn-p btn-lg" href={`/latihan/${b.sesi[0]}`}>Lanjut 筆記</Link>
          : !choukai ? <button type="button" className="btn btn-p btn-lg" disabled={sibuk} onClick={onChoukai}>Lanjut 聴解</button>
          : !choukaiKelar ? <Link className="btn btn-p btn-lg" href={`/choukai/${b.sesi[1]}`}>Lanjut 聴解</Link>
          : <button type="button" className="btn btn-p btn-lg" onClick={onTutup}>Lihat hasil</button>}
      </div>
    </>
  );
}

function HasilSimulasi({ b, lalu, level, targetHikki }: { b: BarisSimulasi; lalu?: BarisSimulasi; level: string; targetHikki: number }) {
  const L = strategiUntuk(level);
  const skor = b.skor!;
  const total = skor.reduce((s, x) => s + x.nilai, 0);
  const maks = skor.reduce((s, x) => s + x.max, 0);
  const min = (k: string) => L.skor.find(s => s.k === k)?.min ?? 0;
  const lulus = total >= L.lulus && skor.every(x => x.nilai >= min(x.k));
  const beda = (x: number) => (x > 0 ? `+${x}` : `${x}`);
  const lemah = [...skor].sort((p, q) => p.nilai / p.max - q.nilai / q.max)[0];
  const latihan = lemah.k === "聴解" || lemah.k === "読解" ? "/bank-soal" : "/latihan/kilat";
  const menit = b.menit?.["筆記"] ?? null;
  const tp = [{ k: "筆記", m: menit, t: targetHikki, audio: false }, { k: "聴解", m: null, t: L.waktu.find(w => w.c === "choukai")?.m ?? 0, audio: true }];
  return (
    <>
      <section className="card tr-h">
        <div>
          <div className="eyebrow">Hasil simulasi {b.n} · {hariDari(b.tanggal)} {tglPendek(b.tanggal)}</div>
          <div className="tr-v">{lulus ? "Perkiraan: lulus" : "Perkiraan: belum lulus"}</div>
          <div className="tr-n">{total}<span>/ {maks}</span></div>
          <div className="tr-s">Nilai lulus {L.lulus}{lalu?.skor ? ` · simulasi ${lalu.n}: ${lalu.skor.reduce((s, x) => s + x.nilai, 0)} (${beda(total - lalu.skor.reduce((s, x) => s + x.nilai, 0))})` : ""}</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- PNG transparan Honix */}
        <div className="tr-hx"><img className="hx" src={honixSrc(lulus ? "lulus" : "bangkit")} alt="Honix" /></div>
      </section>
      <div className="sim-g" style={{ marginTop: 16 }}>
        <section className="card sr" style={{ marginTop: 0 }}>
          <div className="h2">Per bagian</div>
          {skor.map(x => {
            const aman = x.nilai >= min(x.k);
            const y = lalu?.skor?.find(s => s.k === x.k);
            return (
              <div className={`srr${aman ? "" : " low"}`} key={x.k}>
                <div className="srk" lang="ja">{x.k}<small>{L.skor.find(s => s.k === x.k)?.s}</small></div>
                <div className="srb"><i style={{ width: `${(x.nilai / x.max) * 100}%`, background: aman ? WARNA[x.k] : "var(--danger)" }} /><em style={{ left: `${(min(x.k) / x.max) * 100}%` }}><span>min {min(x.k)}</span></em></div>
                <div className="srv"><b>{x.nilai}</b><span> / {x.max}</span><small className={aman ? "ok-t" : "bad-t"}>{aman ? "Aman" : "Di bawah minimum"}{y ? ` · ${beda(x.nilai - y.nilai)}` : ""}</small></div>
              </div>
            );
          })}
          <p className="note" style={{ marginTop: 10 }}>Terlemah: <b lang="ja">{lemah.k}</b> {lemah.nilai} / {lemah.max}.</p>
        </section>
        <section className="card tcard">
          <div className="h2">Tempo per bagian</div>
          <div className="tmp">
            {tp.map(x => {
              const t = tempo(x.m, x.t, x.audio);
              const mx = Math.max(x.m ?? 0, x.t) * 1.1 || 1;
              return (
                <div className="tp-r" key={x.k}>
                  <span lang="ja">{x.k}</span>
                  <div className="tp-b">{x.m != null && <i style={{ width: `${(x.m / mx) * 100}%`, background: t.cls === "warn" ? "var(--warning)" : "var(--success)" }} />}{x.audio ? <i style={{ width: `${(x.t / mx) * 100}%`, background: "var(--success)" }} /> : null}<em style={{ left: `${(x.t / mx) * 100}%` }} /></div>
                  <div className="tp-v">{x.m != null ? <><b>{x.m}</b> / </> : x.audio ? <><b>{x.t}</b> / </> : null}{x.t} menit<small className={t.cls === "warn" ? "warn-t" : t.cls === "ok" ? "ok-t" : "note"}>{t.teks}</small></div>
                </div>
              );
            })}
          </div>
          <p className="note" style={{ marginTop: 14 }}>Waktu cuma dicatat, dan baru kecatat kalau timer di player nyala. <span lang="ja">筆記</span> satu set isinya semua bagian tulis, jadi temponya dihitung bareng.</p>
        </section>
      </div>
      <div className="tr-a">
        <Link className="btn btn-p" href={latihan}>Latihan <span lang="ja">{lemah.k}</span></Link>
        <Link className="btn btn-g" href="/strategi">Lihat strategi</Link>
      </div>
    </>
  );
}
