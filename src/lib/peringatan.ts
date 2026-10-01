"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { tanggalLokal, EVENT_AKTIVITAS } from "@/lib/aktivitas";
import type { TargetLevel } from "@/lib/use-user-stats";

/**
 * Peringatan belajar — streak mau putus, ujian makin dekat, latihan mandek,
 * materi yang lemah.
 *
 * Kenapa file sendiri: aturannya dulu nyempil inline di <UserBar>, dan komponen
 * itu query `sessions` sendiri cuma buat satu aturan. Begitu banner Beranda
 * ikut butuh peringatan yang sama, logikanya bakal kesalin dua kali dan lama-
 * lama beda sendiri. Sekarang satu tempat, dua yang makai.
 *
 * Semuanya DITURUNIN dari data yang emang udah ada — gak ada tabel notifikasi
 * yang diisi cron. Konsekuensinya peringatan cuma hidup selama app kebuka, dan
 * itu cukup buat sekarang. Tabel `notifications` di schema sengaja tetap
 * nganggur sampai kita beneran butuh push.
 *
 * Sengaja GAK makai useUserStats meski butuh streak & tanggal ujian. Hook itu
 * nembak profiles + is_pro() + streak_saya() tiap dipakai, dan halaman-halaman
 * ini udah manggil dia sekali buat header — nyantol ke situ bikin tiap halaman
 * jalan dua kali. Streak dihitung ulang di sini dari aktivitas_harian yang toh
 * udah diambil, pakai aturan yang sama persis kayak streak_saya().
 */

export type Tingkat = "genting" | "ingat" | "info";

export interface Peringatan {
  id: string;
  tingkat: Tingkat;
  ikon: string;
  judul: string;
  pesan: string;
  aksi?: { label: string; href: string };
}

/* ── Ambang ──────────────────────────────────────────────────────────────
   Dikumpulin di sini biar gampang disetel, bukan kesebar jadi angka ajaib
   di tengah aturan. */

/** Rata-rata soal/hari yang dianggap "kekejar" kalau ujian tinggal < 2 bulan. */
const PACE_SOAL_PER_HARI = 10;
/** Di atas ini hitung mundur ujian gak masuk lonceng — udah kepajang di header
 *  Beranda, kalau nempel tiap hari malah jadi wallpaper dan gak dibaca. */
const UJIAN_MULAI_INGET = 30;
/** Ujian tinggal segini baru tempo latihan dipermasalahin. */
const UJIAN_CEK_PACE = 60;
/** Berapa hari nganggur sebelum kata/pola yang sering salah ditagih. */
const ULANG_SETELAH_HARI = 7;
/** Akurasi di bawah ini = titik lemah, asal soalnya udah cukup banyak. */
const LEMAH_DI_BAWAH = 65;
const LEMAH_MIN_SOAL = 10;
/** Streak yang pantes dirayain. */
const MILESTONE = [7, 14, 30, 50, 100];
/** Lonceng maksimal segini. Daftar panjang sama aja gak dibaca, dan yang
 *  penting kedorong ke bawah. */
const MAKS_TAMPIL = 4;

const URUTAN: Record<Tingkat, number> = { genting: 0, ingat: 1, info: 2 };

/* 5 kategori JLPT, urutannya samain sama FOCUS_CATS di Beranda. */
const KATEGORI: { jp: string; ro: string; href: string }[] = [
  { jp: "文字", ro: "Moji", href: "/materi" },
  { jp: "語彙", ro: "Goi", href: "/materi/kotoba" },
  { jp: "文法", ro: "Bunpou", href: "/materi/bunpou" },
  { jp: "読解", ro: "Dokkai", href: "/materi" },
  { jp: "聴解", ro: "Choukai", href: "/materi" },
];

interface BarisSesi {
  created_at: string;
  stats?: { answered?: number; perCat?: Record<string, { a: number; c: number }> } | null;
}
interface BarisProgres { benar: number; salah: number }

export interface Bahan {
  /** Tanggal lokal yang ada aktivitas, terbaru di depan. */
  hariAktif: string[];
  sesi: BarisSesi[];
  kotobaNganggur: number;
  bunpouNganggur: number;
  targetLevel: TargetLevel;
  examDate: string | null;
}

/** Selisih hari kalender antara dua tanggal YYYY-MM-DD.
 *
 *  Sengaja dipatok tengah hari sebelum dikurangin: `new Date("2026-03-29")` itu
 *  tengah malam UTC, dan di zona yang kena DST selisih dua tengah malam bisa 23
 *  atau 25 jam — dibagi 86.400.000 hasilnya meleset sehari. Dari tengah hari,
 *  geseran sejam-dua jam gak sampai nyebrang. */
function selisihHari(dari: string, ke: string): number {
  return Math.round(
    (new Date(`${ke}T12:00:00`).getTime() - new Date(`${dari}T12:00:00`).getTime()) / 86_400_000
  );
}

/** Mundur n hari dari `dari`, tetap dalam tanggal LOKAL YYYY-MM-DD. */
function mundur(hari: number, dari = new Date()): string {
  const d = new Date(dari);
  d.setDate(d.getDate() - hari);
  return tanggalLokal(d);
}

/* ── Cache satu tab ──────────────────────────────────────────────────────
   Beranda punya dua yang manggil hook ini sekaligus (banner + <UserBar>), dan
   tiap pindah halaman <UserBar> ke-mount lagi. Tanpa ini, satu batch query
   jalan tiap kali — 4 tabel, cuma buat nampilin kalimat yang sama.

   TTL-nya pendek dan bisa dibatalin: begitu user beneran ngerjain sesuatu,
   catatAktivitas() manggil segarkanPeringatan(). Kalau enggak, dia bakal lihat
   "streak bakal putus 🔥" padahal barusan selesai latihan — persis jenis angka
   fosil yang bikin repot di versi sebelumnya. */
const TTL_MS = 60_000;
let cache: { saat: number; data: Bahan } | null = null;
let jalan: Promise<Bahan | null> | null = null;

/** Buang cache — dipanggil dari catatAktivitas() tiap ada aktivitas baru. */
export function segarkanPeringatan(): void {
  cache = null;
  jalan = null;
}

async function ambilBahan(): Promise<Bahan | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const batasUlang = new Date(Date.now() - ULANG_SETELAH_HARI * 86_400_000).toISOString();

  const [akt, ses, kot, bun, prof] = await Promise.all([
    // Tanpa batas tanggal: satu baris per hari, jadi setahun pun cuma ~365
    // baris — dan streak 40 hari harus kebaca 40, bukan kepotong jendela.
    supabase.from("aktivitas_harian").select("tanggal")
      .eq("user_id", user.id).order("tanggal", { ascending: false }),
    supabase.from("sessions").select("created_at,ai_result->stats")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(300),
    supabase.from("kotoba_progress").select("benar,salah")
      .eq("user_id", user.id).lt("updated_at", batasUlang),
    supabase.from("bunpou_progress").select("benar,salah")
      .eq("user_id", user.id).lt("updated_at", batasUlang),
    supabase.from("profiles").select("target_level").eq("id", user.id).single(),
  ]);

  /* Yang ditagih cuma yang salahnya lebih banyak dari benarnya. Bandingan
     antar-kolom gak bisa ditulis di PostgREST (.gt("salah","benar") nganggep
     "benar" itu nilai, bukan kolom), jadi tanggalnya disaring di server,
     sisanya di sini. */
  const seringSalah = (r: BarisProgres[] | null) =>
    (r ?? []).filter(x => x.salah > x.benar).length;

  /* Tanggal ujian & level target: user_metadata DULUAN, persis alasan yang
     ditulis panjang di use-user-stats.ts — trigger handle_new_user() gak
     nyalin pilihan onboarding, jadi profiles.target_level sering ketinggalan
     di default 'N3'. Onboarding nyimpen "none" kalau user nolak nentuin. */
  const mdExam = user.user_metadata?.exam_date;
  const mdLevel = user.user_metadata?.target_level as TargetLevel | undefined;

  return {
    hariAktif: ((akt.data ?? []) as { tanggal: string }[]).map(r => r.tanggal),
    sesi: (ses.data ?? []) as unknown as BarisSesi[],
    kotobaNganggur: seringSalah(kot.data as BarisProgres[] | null),
    bunpouNganggur: seringSalah(bun.data as BarisProgres[] | null),
    targetLevel: mdLevel ?? (prof.data?.target_level as TargetLevel) ?? "N3",
    examDate: typeof mdExam === "string" && mdExam && mdExam !== "none" ? mdExam : null,
  };
}

/** Sekali jalan walau dipanggil beberapa komponen barengan. */
function bahanTerbagi(): Promise<Bahan | null> {
  if (cache && Date.now() - cache.saat < TTL_MS) return Promise.resolve(cache.data);
  if (jalan) return jalan;
  jalan = ambilBahan()
    .then(d => { if (d) cache = { saat: Date.now(), data: d }; return d; })
    .catch(e => { console.warn("[peringatan] gagal ambil data:", e?.message ?? e); return null; })
    .finally(() => { jalan = null; });
  return jalan;
}

export interface HasilPeringatan {
  /** Semua yang aktif, udah diurutin & dipotong. Buat lonceng. */
  semua: Peringatan[];
  /** Yang paling perlu dilihat. Buat banner Beranda. */
  utama: Peringatan | null;
  /** Jangan render apa pun selama masih false — angka nol sekejap bikin
   *  peringatan palsu ("3 hari gak latihan" padahal datanya belum kebaca). */
  loaded: boolean;
}

export function usePeringatan(): HasilPeringatan {
  const [bahan, setBahan] = useState<Bahan | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let batal = false;
    const muat = () => bahanTerbagi().then(d => {
      if (batal) return;
      setBahan(d);
      setLoaded(true);
    });
    muat();

    /* Begitu user beneran ngerjain sesuatu, semua yang dihitung di sini basi.
       Paling kerasa di "streak bakal putus": tanpa ini dia masih nempel sampai
       halaman di-reload, ngomelin orang yang barusan selesai latihan. */
    const onAktivitas = () => { segarkanPeringatan(); muat(); };
    window.addEventListener(EVENT_AKTIVITAS, onAktivitas);
    return () => {
      batal = true;
      window.removeEventListener(EVENT_AKTIVITAS, onAktivitas);
    };
  }, []);

  const semua = useMemo<Peringatan[]>(
    () => (bahan ? susunPeringatan(bahan) : []), [bahan]);

  return { semua, utama: semua[0] ?? null, loaded };
}

/**
 * Mesin aturannya — murni, biar bisa diuji tanpa React & tanpa Supabase.
 *
 * `sekarang` sengaja bisa diisi: jam dipakai buat mutusin kalimat "putus X jam
 * lagi", dan tanggal dipakai buat semua hitungan hari. Tanpa lubang ini, satu-
 * satunya cara nyoba kasus "jam 9 malam, streak 12 hari" itu nungguin jam 9
 * malam.
 */
export function susunPeringatan(bahan: Bahan, sekarang = new Date()): Peringatan[] {
  const hariIni = tanggalLokal(sekarang);
  const P: Peringatan[] = [];

  /* ── Bahan turunan ─────────────────────────────────────────────────── */

  const aktifHariIni = bahan.hariAktif[0] === hariIni;
  const hariTerakhir = bahan.hariAktif[0] ?? null;
  const jedaHari = hariTerakhir ? selisihHari(hariTerakhir, hariIni) : null;

  /* Panjang deretan hari berturut yang berakhir di hari aktif terakhir.
     Sengaja BUKAN "terpanjang sepanjang masa": yang mau disebut di kalimat
     "streak kamu putus" itu streak yang barusan putus, bukan rekor lama. */
  let streakTerakhir = 0;
  if (hariTerakhir) {
    streakTerakhir = 1;
    for (let i = 1; i < bahan.hariAktif.length; i++) {
      if (selisihHari(bahan.hariAktif[i], bahan.hariAktif[i - 1]) !== 1) break;
      streakTerakhir++;
    }
  }
  /* Aturan sama kayak streak_saya(): deretannya masih dianggap hidup selama
     nyambung ke hari ini ATAU kemarin. Kemarin = belum putus, tapi malam ini
     batasnya — itu yang bikin peringatan gentingnya ada gunanya. */
  const streakSekarang = jedaHari === 0 || jedaHari === 1 ? streakTerakhir : 0;

  const aktifMingguIni = bahan.hariAktif
    .filter(t => selisihHari(t, hariIni) <= 6).length;

  /* Soal/hari 7 hari terakhir — dari stats.answered, sumber yang sama kayak
     grafik mingguan di Beranda. `jumlah` di aktivitas_harian gak kepakai di
     sini: isinya hitungan panggilan catat_aktivitas (di-dedup per tab), bukan
     jumlah soal. */
  const batasPekan = mundur(6, sekarang);
  let soalPekan = 0;
  for (const s of bahan.sesi) {
    if (tanggalLokal(new Date(s.created_at)) < batasPekan) continue;
    soalPekan += s.stats?.answered ?? 0;
  }
  const soalPerHari = Math.round(soalPekan / 7);

  const sisaHari = bahan.examDate ? selisihHari(hariIni, bahan.examDate) : null;

  /* ── A. Streak ─────────────────────────────────────────────────────── */

  if (streakSekarang > 0 && !aktifHariIni) {
    const jam = sekarang.getHours();
    const malam = jam >= 20;
    P.push({
      id: "streak-putus-malam-ini",
      tingkat: "genting",
      ikon: "🔥",
      judul: malam
        ? `Streak ${streakSekarang} hari putus ${24 - jam} jam lagi`
        : `Streak ${streakSekarang} hari bakal putus malam ini`,
      pesan: malam
        ? "Sekarang atau hilang. Lima soal aja udah nyelametin."
        : "Kamu belum latihan hari ini. Lima menit cukup buat nyambungin.",
      aksi: { label: "Latihan kilat", href: "/latihan/kilat" },
    });
  }

  if (streakSekarang === 0 && streakTerakhir >= 3 && jedaHari === 2) {
    P.push({
      id: "streak-baru-putus",
      tingkat: "ingat",
      ikon: "💔",
      judul: `Streak ${streakTerakhir} hari kamu putus`,
      pesan: "Terakhir latihan dua hari lalu. Mulai lagi hari ini — hitungannya balik dari satu, tapi kebiasaannya belum ilang.",
      aksi: { label: "Mulai lagi", href: "/latihan/kilat" },
    });
  }

  if (aktifHariIni && MILESTONE.includes(streakSekarang)) {
    P.push({
      id: `streak-milestone-${streakSekarang}`,
      tingkat: "info",
      ikon: "🎉",
      judul: `${streakSekarang} hari berturut-turut!`,
      pesan: "Yang ngangkat nilai itu konsistensi kayak gini, bukan belajar semalaman. すごい!",
    });
  }

  /* ── B. Ujian dekat ────────────────────────────────────────────────── */

  if (sisaHari != null && sisaHari >= 0 && sisaHari <= UJIAN_MULAI_INGET) {
    P.push({
      id: "ujian-hitung-mundur",
      tingkat: sisaHari <= 3 ? "genting" : sisaHari <= 14 ? "ingat" : "info",
      ikon: "📅",
      judul:
        sisaHari === 0 ? `Ujian JLPT ${bahan.targetLevel} hari ini`
        : sisaHari === 1 ? `Ujian JLPT ${bahan.targetLevel} besok`
        : `Ujian JLPT ${bahan.targetLevel} ${sisaHari} hari lagi`,
      pesan:
        sisaHari === 0 ? "落ち着いて — kamu udah nyiapin ini. Semangat!"
        : sisaHari <= 3 ? "Sisa waktunya buat ngulang yang udah dipelajari, bukan nambah materi baru."
        : sisaHari <= 14 ? "Dua minggu terakhir. Fokusin ke bagian yang paling sering salah."
        : "Sebulan lagi — ini waktu paling enak buat nutup lubang selagi masih sempat.",
      aksi: { label: "Buka materi", href: "/materi" },
    });
  }

  /* Tempo cuma dipermasalahin kalau dia emang lagi jalan. Kalau minggu ini
     kosong melompong, yang bener disebut "mandek" di bawah — bukan diomelin
     soal rata-rata.

     `soalPekan > 0` itu syarat yang gak kelihatan perlu sampai dicoba: drill
     kotoba & bunpou nyatet aktivitas_harian TAPI gak bikin baris sessions.
     Tanpa ini, orang yang seminggu penuh ngapalin flashcard dikasih kalimat
     "rata-rata baru 0 soal/hari" — angka yang bukan cuma nyakitin, tapi salah.

     Lewat H-3 tempo gak disinggung lagi: di titik itu peringatan ujiannya
     bilang "ngulang, jangan nambah materi", dan nyuruh naikin tempo barengan
     cuma bikin dia bingung harus nurut yang mana. */
  if (
    sisaHari != null && sisaHari > 3 && sisaHari <= UJIAN_CEK_PACE &&
    soalPekan > 0 && soalPerHari < PACE_SOAL_PER_HARI
  ) {
    P.push({
      id: "ujian-pace",
      tingkat: "ingat",
      ikon: "📉",
      judul: "Tempo latihan kamu ketinggalan",
      pesan: `${sisaHari} hari menuju ujian, tapi minggu ini rata-rata baru ${soalPerHari} soal/hari. Naikin ke ${PACE_SOAL_PER_HARI} biar kekejar.`,
      aksi: { label: "Latihan kilat", href: "/latihan/kilat" },
    });
  }

  /* ── C. Belajar mandek ─────────────────────────────────────────────── */

  /* User yang belum pernah latihan sama sekali gak diomelin "gak latihan
     sekian hari" — dia bukan mandek, dia baru dateng. */
  if (jedaHari != null && jedaHari >= 3) {
    P.push({
      id: "mandek",
      tingkat: jedaHari >= 5 ? "genting" : "ingat",
      ikon: "🌙",
      judul: `${jedaHari} hari gak latihan`,
      pesan: jedaHari >= 5
        ? "Hafalan kotoba paling cepat luntur di minggu pertama. Balik sekarang mumpung belum jauh."
        : "Belum telat. Satu sesi pendek hari ini cukup buat nyalain lagi.",
      aksi: { label: "Latihan kilat", href: "/latihan/kilat" },
    });
  } else if (jedaHari != null && aktifMingguIni <= 2 && bahan.hariAktif.length >= 3) {
    /* `hariAktif.length >= 3`: buat orang yang baru dua hari pakai app, "baru 1
       dari 7 hari aktif" itu bukan kemunduran — emang baru segitu umurnya di
       sini. Minggu sepi baru berarti kalau ada kebiasaan yang lagi kendor. */
    P.push({
      id: "minggu-sepi",
      tingkat: "ingat",
      ikon: "📆",
      judul: `Minggu ini baru ${aktifMingguIni} dari 7 hari aktif`,
      pesan: "Sebentar tiap hari lebih nempel daripada sekali lama di akhir pekan.",
      aksi: { label: "Latihan kilat", href: "/latihan/kilat" },
    });
  }

  /* ── D. Titik lemah materi ─────────────────────────────────────────── */

  const perKat: Record<string, { a: number; c: number }> = {};
  for (const s of bahan.sesi) {
    for (const [k, v] of Object.entries(s.stats?.perCat ?? {})) {
      const b = (perKat[k] ??= { a: 0, c: 0 });
      b.a += v.a ?? 0; b.c += v.c ?? 0;
    }
  }
  const terlemah = KATEGORI
    .map(k => ({ ...k, ...(perKat[k.jp] ?? { a: 0, c: 0 }) }))
    .filter(k => k.a >= LEMAH_MIN_SOAL)
    .map(k => ({ ...k, pct: Math.round((k.c / k.a) * 100) }))
    .sort((x, y) => x.pct - y.pct)[0];

  if (terlemah && terlemah.pct < LEMAH_DI_BAWAH) {
    P.push({
      id: "kategori-lemah",
      tingkat: "ingat",
      ikon: "🎯",
      judul: `${terlemah.ro} kamu masih ${terlemah.pct}%`,
      pesan: `Dari ${terlemah.a} soal ${terlemah.jp} yang udah kamu kerjain, ini bagian paling lemah. Naikin di sini dulu — kenaikannya paling kerasa.`,
      aksi: { label: `Latihan ${terlemah.ro}`, href: terlemah.href },
    });
  }

  if (bahan.kotobaNganggur + bahan.bunpouNganggur > 0) {
    const bagian = [
      bahan.kotobaNganggur ? `${bahan.kotobaNganggur} kata` : null,
      bahan.bunpouNganggur ? `${bahan.bunpouNganggur} pola bunpou` : null,
    ].filter(Boolean).join(" & ");
    P.push({
      id: "sering-salah-nganggur",
      tingkat: "ingat",
      ikon: "🔁",
      judul: `${bagian} sering salah, belum diulang`,
      pesan: "Udah lewat seminggu sejak terakhir kamu nyentuh. Ini yang paling gampang jadi salah lagi pas ujian.",
      aksi: {
        label: "Ulang sekarang",
        href: bahan.kotobaNganggur >= bahan.bunpouNganggur ? "/materi/kotoba" : "/materi/bunpou",
      },
    });
  }

  /* .sort() di JS stabil (ES2019+), jadi dalam satu tingkat urutannya tetap
     urutan aturan di atas — yang emang udah disusun dari paling mendesak. */
  return P
    .sort((a, b) => URUTAN[a.tingkat] - URUTAN[b.tingkat])
    .slice(0, MAKS_TAMPIL);
}
