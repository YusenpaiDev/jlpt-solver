"use client";

import { useState } from "react";
import Link from "next/link";
import { useUserStats } from "@/lib/use-user-stats";
import { useKurikulum, type Kurikulum, type UnitTampil } from "@/lib/use-kurikulum";
import { FASE, faseMinggu, fiturLive } from "@/lib/kurikulum-config";
import { dimulai, type StatusItem } from "@/lib/kurikulum";
import { BelumMulai, Disiapkan, Kerangka, KepalaKurikulum, tglPanjang, tglPendek } from "@/components/kurikulum/Bagian";

const LABEL: Record<UnitTampil["st"], string> = { skip: "Dilewati", done: "Selesai", part: "Sebagian", cur: "Minggu ini", next: "Belum mulai", luar: "Di luar jadwal" };
const STATUS_POLA: Record<StatusItem, [string, string]> = { dikuasai: ["Dikuasai", "dk"], hafal: ["Hafal", "hf"], belajar: ["Belajar", "bl"], baru: ["Baru", ""] };

/** Peta 26 minggu (HANDOFF-kurikulum §6). */
export default function PetaKurikulum() {
  const stats = useUserStats();
  const k = useKurikulum(stats.targetLevel, stats.loaded);
  const crumb = [{ label: "Materi", href: "/materi" }, { label: `Kurikulum ${stats.targetLevel}` }];
  if (!fiturLive("kurikulum")) {
    return <Kerangka stats={stats} crumb={crumb}><Disiapkan judul={`Kurikulum ${stats.targetLevel}`} isi="26 minggu terarah sampai hari ujian: tiap minggu satu unit kata, pola, dan jenis soal, ditutup simulasi penuh." /></Kerangka>;
  }
  return (
    <Kerangka stats={stats} crumb={crumb}>
      {!k.siap ? <p className="ku-muat" role="status">Memuat kurikulum…</p>
        : k.belumMulai ? <BelumMulai level={stats.targetLevel} penempatan={fiturLive("penempatan")} />
        : <><KepalaKurikulum k={k} tab="peta" /><Peta k={k} /></>}
    </Kerangka>
  );
}

function Peta({ k }: { k: Kurikulum }) {
  const [pilih, setPilih] = useState(Math.min(26, Math.max(1, k.ini[0] ?? k.kur?.unit_mulai ?? 1)));
  const cad = k.cadangan;
  const adaLuar = k.unit.some(u => u.st === "luar");
  /* Di mode selain normal, satu fase = rentang unit, bukan minggu kalender. */
  const satuan = k.mode === "normal" ? "Minggu" : "Unit";
  const namaCad = k.mode === "akhir" ? "Mode akhir" : "Cadangan";
  return (
    <div className="pt-g">
      <section className="card pt-c">
        <div className="pt-ph">
          {FASE.map(f => (
            <div key={f.id} style={{ flex: f.minggu[1] - f.minggu[0] + 1 }}>
              <i style={{ background: f.warna }} /><b>{f.t}</b><small>{satuan} {f.minggu[0]}–{f.minggu[1]}{f.tingkat ? ` · ${f.tingkat}` : ""}</small>
            </div>
          ))}
          {cad && <div style={{ flex: 1.6 }}><i style={{ background: "rgba(212,160,74,.35)" }} /><b>{namaCad}</b><small>{cad.n} minggu</small></div>}
        </div>
        <div className="wg">
          {k.unit.map(u => {
            const total = u.kata.length || 1;
            const pct = u.st === "next" ? 0 : Math.round((dimulai(u.kataSt) / total) * 100);
            return (
              <button key={u.u} type="button" className={`wt s-${u.st}${u.u === pilih ? " sel" : ""}`} aria-label={`Minggu ${u.u}, ${LABEL[u.st]}`} aria-pressed={u.u === pilih} onClick={() => setPilih(u.u)}>
                <span className="wt-n">{u.u}</span>
                {u.st === "done" && <span className="wt-i ok">✓</span>}
                {u.st === "part" && <span className="wt-i">◐</span>}
                {u.st === "skip" && <span className="wt-i">—</span>}
                {k.simUnit.has(u.u) && <span className="wt-sim" title="Simulasi" lang="ja">模</span>}
                {u.st === "cur" && <span className="wt-now">Minggu ini</span>}
                <i className="wt-b" style={{ "--p": `${pct}%`, "--c": faseMinggu(u.u).warna } as React.CSSProperties} />
              </button>
            );
          })}
          {cad && (
            <div className="wt wt-x" title="Ulang yang lemah & simulasi, ditutup ujian"><span className="wt-n">{namaCad}<br />{cad.n} minggu</span><small>{tglPendek(cad.dari)} – {tglPendek(cad.sampai)}</small></div>
          )}
        </div>
        <div className="pt-leg">
          <span><i className="c" />Minggu ini</span><span><b className="ok-t">✓</b>Selesai</span><span>◐ Sebagian</span>
          <span><i className="s" />Dilewati (tes penempatan)</span>{adaLuar && <span><i className="l" />Di luar jadwal (boleh diintip)</span>}<span><b style={{ fontFamily: "var(--jps)", color: "var(--warning)" }} lang="ja">模</b>Simulasi bulanan</span>
        </div>
      </section>
      <DetailMinggu k={k} u={k.unit[pilih - 1]} />
    </div>
  );
}

function DetailMinggu({ k, u }: { k: Kurikulum; u: UnitTampil }) {
  const f = faseMinggu(u.u);
  const s = u.kataSt;
  const seg: [string, number, string][] = [["var(--success)", s[0], "Dikuasai"], ["rgba(255,255,255,.55)", s[1], "Hafal"], ["var(--warning)", s[2], "Belajar"], ["var(--surface-3)", s[3], "Baru"]];
  const ul = k.ulangan.find(x => x.unit === u.u);
  const cta: Record<UnitTampil["st"], [string, string, string]> = {
    cur: ["Lanjut misi hari ini", "btn-p", "/"],
    part: [`Lengkapi ${s[3]} kata yang belum`, "btn-g", `/latihan/kotoba?unit=${u.u}&mode=baru&count=20`],
    done: ["Ulang materi ini", "btn-g", `/latihan/kotoba?unit=${u.u}&count=20`],
    skip: ["Ulang materi ini", "btn-g", `/latihan/kotoba?unit=${u.u}&count=20`],
    next: ["Intip materinya", "btn-g", `/latihan/kotoba?unit=${u.u}&count=10`],
    luar: ["Intip materinya", "btn-g", `/latihan/kotoba?unit=${u.u}&count=10`],
  };
  const [teks, kelas, href] = cta[u.st];
  return (
    <aside className="card wd" aria-live="polite" key={u.u}>
      <div className="eyebrow">Fase {f.t}{f.tingkat ? ` · ${f.tingkat}` : ""}</div>
      <div className="wd-t">{k.mode === "normal" ? "Minggu" : "Unit"} {u.u} · {LABEL[u.st]}</div>
      <div className="wd-d">{u.tanggal ? `${tglPendek(u.tanggal[0])} – ${tglPanjang(u.tanggal[1])}` : u.st === "skip" ? "Dikuasai dari tes penempatan" : "Gak kebagian jadwal sebelum ujian · boleh diintip"}</div>
      <div className="wd-s">
        <b>Kata<span>{dimulai(s)} / {u.kata.length} dimulai</span></b>
        <div className="stk">{seg.map(([c, v], i) => v > 0 && <i key={i} style={{ flex: v, background: i === 3 ? "transparent" : c }} />)}</div>
        <div className="stk-l">{seg.map(([c, v, t]) => <span key={t}><i style={{ background: c }} />{t} {v}</span>)}</div>
        <div className="wd-k">
          {u.kata.slice(0, 6).map(w => <span key={w} lang="ja">{w}</span>)}
          {u.kata.length > 6 && <small>+{u.kata.length - 6} lagi</small>}
        </div>
      </div>
      <div className="wd-s">
        <b>Pola Bunpou<span>{u.pola.length} pola</span></b>
        <ul className="wd-p">
          {u.pola.map(p => { const [t, c] = STATUS_POLA[k.statusItem("pola", p)]; return <li key={p}><b lang="ja">{p}</b><span className={`st-chip ${c}`}>{t}</span></li>; })}
        </ul>
      </div>
      <div className="wd-s">
        <b>Jenis soal fokus</b>
        <ul className="wd-p">
          {u.jenis.map(j => {
            const t = k.tingkat.get(j);
            return <li key={j}><span lang="ja">{j}</span><span><span className="tier">T{t?.tingkat ?? 1}</span>{t?.e.akurasi != null ? `${Math.round(t.e.akurasi * 100)}%` : "–"}</span></li>;
          })}
        </ul>
      </div>
      {ul && <div className="wd-s"><b>Ulangan mingguan<span>Nempel {ul.benar} / {ul.total}</span></b></div>}
      {k.simUnit.has(u.u) && <div className="wd-s"><b>Simulasi bulanan<span>{fiturLive("simulasi") ? "dijadwalkan" : "sedang disiapkan"}</span></b></div>}
      <Link className={`btn ${kelas}`} href={href}>{teks}</Link>
    </aside>
  );
}
