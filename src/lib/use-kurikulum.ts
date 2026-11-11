"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { tanggalLokal } from "@/lib/aktivitas";
import { ATURAN, fiturLive } from "@/lib/kurikulum-config";
import { muatBunpou, muatKotoba, muatPrioritas, type DekBunpou, type DekKotoba } from "@/lib/dek-materi";
import { DEV_BYPASS } from "@/lib/dev-materi";
import { rapikanTanggalUjian } from "@/lib/sesi-ujian";
import {
  evaluasiTingkat, hitungStatus, jadwalSimulasi, letakUnit, mingguKe, mingguKeUjian, seninDari, statusDariProgres, statusUnit,
  susunJadwal, susunUnit, tambahHari, tanggalMinggu,
  type Empat, type EvalTingkat, type Jadwal, type KurikulumUser, type ModeWaktu, type Prioritas, type StatusItem, type StatusUnit, type Unit,
} from "@/lib/kurikulum";

export interface UnitTampil extends Unit { st: StatusUnit; kataSt: Empat; polaSt: Empat; tanggal: [string, string] | null }
export interface Ulangan { minggu: string; unit: number; benar: number; total: number; per_bagian: Record<string, { benar: number; total: number }>; item_lupa: { jenis: string; kunci: string; arti: string; baca?: string }[] }
export interface Tingkat { jenis: string; tingkat: number; e: EvalTingkat }

export interface Kurikulum {
  siap: boolean;
  /** user belum mulai kurikulum (belum tes penempatan / lewati) */
  belumMulai: boolean;
  kur: KurikulumUser | null;
  unit: UnitTampil[];
  /** jadwal per minggu sampai ujian + mode sisa waktu (normal/padat/kejar/akhir) */
  jadwal: Jadwal | null;
  mode: ModeWaktu;
  /** minggu ke-i sejak mulai (0 = minggu pertama) */
  minggu: number;
  /** unit minggu ini & minggu lalu ([] = masa cadangan / mode akhir) */
  ini: number[];
  lalu: number[];
  /** unit yang minggunya ada simulasi (penanda 模 di peta) */
  simUnit: Set<number>;
  /** minggu tanpa unit di ujung jadwal (ulang & simulasi) */
  cadangan: { n: number; dari: string; sampai: string } | null;
  hariIni: string;
  sisaMinggu: number | null;
  statusItem: (jenis: "kata" | "pola", kunci: string) => StatusItem;
  jatuhTempo: { kata: string[]; pola: string[] };
  tingkat: Map<string, Tingkat>;
  ulangan: Ulangan[];
  dekK: DekKotoba | null;
  dekB: DekBunpou | null;
}

interface Mentah {
  kur: KurikulumUser | null;
  item: Map<string, { status: StatusItem; jatuh_tempo: string | null }>;
  progK: Map<string, { benar: number; salah: number }>;
  progB: Map<string, { benar: number; salah: number }>;
  tingkat: { jenis: string; tingkat: number; riwayat: boolean[] }[];
  ulangan: Ulangan[];
}

/** Data contoh dev (cek visual tanpa login): N3, mulai dari minggu 4, sekarang minggu 12.
    ?dev=padat / kejar / akhir = ujian makin mepet, buat cek mode sisa waktu. */
function devMentah(level: string, dekK: DekKotoba, dekB: DekBunpou, prio: Prioritas, mode: string | null): Mentah {
  const hariIni = tanggalLokal();
  const senin = seninDari(hariIni);
  const [lalu, mulai, ujian] = mode === "padat" ? [4, 1, 14] : mode === "kejar" ? [2, 1, 7] : mode === "akhir" ? [0, 1, 3] : [8, 4, 18];
  const kur: KurikulumUser = { level, tanggal_mulai: tambahHari(senin, -lalu * 7), unit_mulai: mulai, tanggal_ujian: tambahHari(senin, ujian * 7 + 6) };
  if (mode === "baru") return { kur: null, item: new Map(), progK: new Map(), progB: new Map(), tingkat: [], ulangan: [] };
  const unit = susunUnit(dekK.vocabulary, dekB.patterns, prio);
  const item = new Map<string, { status: StatusItem; jatuh_tempo: string | null }>();
  unit.forEach(u => {
    const isi: [string, string][] = [...u.kata.map(k => ["kata", k] as [string, string]), ...u.pola.map(p => ["pola", p] as [string, string])];
    isi.forEach(([j, k], i) => {
      const st: StatusItem | null = u.u < 4 ? "dikuasai" : u.u < 11 ? (["dikuasai", "hafal", "hafal", "belajar"] as const)[i % 4]
        : u.u === 11 ? (i % 6 === 0 ? null : (["hafal", "belajar"] as const)[i % 2]) : u.u === 12 ? (i % 3 === 0 ? "belajar" : null) : null;
      if (st) item.set(`${j}:${k}`, { status: st, jatuh_tempo: i % 9 === 0 ? hariIni : tambahHari(hariIni, 3) });
    });
  });
  const r = (n: number, of = 20) => Array.from({ length: of }, (_, i) => i < n);
  return {
    kur, item, progK: new Map(), progB: new Map(),
    tingkat: [
      { jenis: "漢字読み", tingkat: 2, riwayat: r(15) }, { jenis: "表記", tingkat: 2, riwayat: r(14) },
      { jenis: "文脈規定", tingkat: 1, riwayat: r(17) }, { jenis: "文法形式の判断", tingkat: 2, riwayat: r(16) },
      { jenis: "文の組み立て", tingkat: 2, riwayat: r(11) }, { jenis: "用法", tingkat: 1, riwayat: r(11) },
    ],
    ulangan: [8, 9, 10, 11].map((u, i) => ({
      minggu: tambahHari(seninDari(hariIni), -7 * (4 - i)), unit: u, benar: [12, 13, 16, 18][i], total: 24,
      per_bagian: { Kata: { benar: [6, 7, 8, 9][i], total: 12 }, Pola: { benar: [3, 3, 4, 4][i], total: 6 }, "Jenis soal": { benar: [3, 3, 4, 5][i], total: 6 } },
      item_lupa: [],
    })),
  };
}

/** Semua yang dibutuhin layar kurikulum. `level` = level target. */
export function useKurikulum(level: string, aktif = true): Kurikulum {
  const live = fiturLive("kurikulum") && aktif;
  const [dekK, setDekK] = useState<DekKotoba | null>(null);
  const [dekB, setDekB] = useState<DekBunpou | null>(null);
  const [prio, setPrio] = useState<Prioritas>({});
  const [m, setM] = useState<Mentah | null>(null);
  const [hariIni] = useState(() => tanggalLokal());

  useEffect(() => {
    if (!live) return;
    let batal = false;
    async function load() {
      const [k, b, p] = await Promise.all([muatKotoba(level), muatBunpou(level), muatPrioritas(level)]);
      if (batal) return;
      setDekK(k); setDekB(b); setPrio(p);
      if (DEV_BYPASS) { setM(devMentah(level, k, b, p, new URLSearchParams(window.location.search).get("dev"))); return; }
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || batal) return;
      const [kur, it, kp, bp, tg, ul] = await Promise.all([
        supabase.from("kurikulum_user").select("level, tanggal_mulai, unit_mulai, tanggal_ujian").eq("user_id", user.id).maybeSingle(),
        supabase.from("item_status").select("jenis, kunci, status, jatuh_tempo").eq("user_id", user.id).eq("level", level),
        supabase.from("kotoba_progress").select("word, benar, salah").eq("user_id", user.id),
        supabase.from("bunpou_progress").select("pattern, benar, salah").eq("user_id", user.id),
        supabase.from("tingkat_jenis_soal").select("jenis, tingkat, riwayat").eq("user_id", user.id),
        supabase.from("ulangan").select("minggu, unit, benar, total, per_bagian, item_lupa").eq("user_id", user.id).order("minggu", { ascending: true }),
      ]);
      if (batal) return;
      /* Tanggal ujian ikut Pengaturan (metadata user), bukan salinan waktu mulai kurikulum,
         biar mode sisa waktu ikut berubah kalau user ganti tanggal. "none" = belum nentuin. */
      const md = user.user_metadata?.exam_date;
      const k0 = (kur.data as KurikulumUser | null)?.level === level ? kur.data as KurikulumUser : null;
      setM({
        kur: k0 && md !== undefined ? { ...k0, tanggal_ujian: rapikanTanggalUjian(md) } : k0,
        item: new Map((it.data ?? []).map(r => [`${r.jenis}:${r.kunci}`, { status: r.status as StatusItem, jatuh_tempo: r.jatuh_tempo }])),
        progK: new Map((kp.data ?? []).map(r => [r.word, { benar: r.benar ?? 0, salah: r.salah ?? 0 }])),
        progB: new Map((bp.data ?? []).map(r => [r.pattern, { benar: r.benar ?? 0, salah: r.salah ?? 0 }])),
        tingkat: (tg.data ?? []) as Mentah["tingkat"],
        ulangan: (ul.data ?? []) as Ulangan[],
      });
    }
    void load();
    return () => { batal = true; };
  }, [live, level]);

  return useMemo<Kurikulum>(() => {
    const kosong: Kurikulum = {
      siap: false, belumMulai: false, kur: null, unit: [], jadwal: null, mode: "normal", minggu: 0, ini: [], lalu: [],
      simUnit: new Set(), cadangan: null, hariIni, sisaMinggu: null,
      statusItem: () => "baru", jatuhTempo: { kata: [], pola: [] }, tingkat: new Map(), ulangan: [], dekK, dekB,
    };
    if (!live || !m || !dekK || !dekB) return kosong;
    const statusItem = (jenis: "kata" | "pola", kunci: string): StatusItem =>
      m.item.get(`${jenis}:${kunci}`)?.status ?? statusDariProgres((jenis === "kata" ? m.progK : m.progB).get(kunci));
    const tingkat = new Map(m.tingkat.map(t => [t.jenis, { jenis: t.jenis, tingkat: t.tingkat, e: evaluasiTingkat(t.riwayat, t.tingkat, ATURAN.tingkat) }]));
    if (!m.kur) return { ...kosong, siap: true, belumMulai: true, statusItem, tingkat, ulangan: m.ulangan };
    const kur = m.kur;
    const jadwal = susunJadwal(kur, ATURAN.waktu);
    const letak = letakUnit(jadwal);
    const minggu = mingguKe(kur, hariIni);
    const unit = susunUnit(dekK.vocabulary, dekB.patterns, prio).map(u => {
      const kataSt = hitungStatus(u.kata, k => statusItem("kata", k));
      const polaSt = hitungStatus(u.pola, p => statusItem("pola", p));
      const i = letak.get(u.u);
      return { ...u, kataSt, polaSt, tanggal: i == null ? null : tanggalMinggu(kur, i), st: statusUnit(u.u, kur.unit_mulai, letak, minggu, kataSt, polaSt) };
    });
    const simUnit = new Set<number>();
    for (const t of jadwalSimulasi(kur.tanggal_mulai, kur.tanggal_ujian, jadwal.mode, ATURAN.waktu.simulasiKejar)) {
      const us = jadwal.minggu[mingguKe(kur, t)];
      if (us?.length) simUnit.add(us[us.length - 1]);
    }
    const terakhir = jadwal.minggu.findLastIndex(us => us.length > 0);
    const nCad = jadwal.minggu.length - terakhir - 1;
    const cadangan = nCad > 0 && kur.tanggal_ujian ? { n: nCad, dari: tanggalMinggu(kur, terakhir + 1)[0], sampai: kur.tanggal_ujian } : null;
    const tempo = (jenis: "kata" | "pola") => [...m.item.entries()]
      .filter(([k, v]) => k.startsWith(`${jenis}:`) && v.jatuh_tempo != null && v.jatuh_tempo <= hariIni).map(([k]) => k.slice(5));
    return {
      siap: true, belumMulai: false, kur, unit, jadwal, mode: jadwal.mode, minggu,
      ini: jadwal.minggu[minggu] ?? [], lalu: minggu > 0 ? jadwal.minggu[minggu - 1] ?? [] : [], simUnit, cadangan,
      hariIni, sisaMinggu: mingguKeUjian(hariIni, kur.tanggal_ujian),
      statusItem, jatuhTempo: { kata: tempo("kata"), pola: tempo("pola") }, tingkat, ulangan: m.ulangan, dekK, dekB,
    };
  }, [live, m, dekK, dekB, prio, hariIni]);
}
