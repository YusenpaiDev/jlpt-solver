"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { tanggalLokal } from "@/lib/aktivitas";
import { useWaktuBelajar } from "@/lib/use-waktu-belajar";
import { PACE_MISI, rencanaMisi, statusBolong, tingkatPace, type JumlahSalah } from "@/lib/misi-harian";

const DEV_BYPASS = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "1";

export type AlasanBolong = "sibuk" | "capek" | "lupa" | "susah" | "lain";

/** Tulis progres misi hari ini (RPC catat_misi). Gagal = diem, nyusul di misi berikutnya. */
export async function catatMisi(isi: { langkah?: number; penyelamat?: boolean; alasan?: AlasanBolong }) {
  if (DEV_BYPASS) return;
  const { error } = await createClient().rpc("catat_misi", {
    p_tanggal: tanggalLokal(),
    p_langkah: isi.langkah ?? null,
    p_penyelamat: isi.penyelamat ?? null,
    p_alasan: isi.alasan ?? null,
  });
  if (error) console.warn(`[misi] gagal catat: ${error.message}`);
}

interface DataMisi {
  siap: boolean;
  langkah: number;
  penyelamatSelesai: boolean;
  salah: JumlahSalah;
  lebihUlang: boolean;
  /** Tanggal terakhir aktif yang udah ditanyain "Dua hari gak ketemu" (sekali per periode bolong). */
  ditanya: string | null;
  /** Mode contoh buat cek visual lokal (?misi=0|1|2|3|p1|p2). */
  dev: string | null;
}

const KOSONG: DataMisi = { siap: false, langkah: 0, penyelamatSelesai: false, salah: { kata: 0, pola: 0 }, lebihUlang: false, ditanya: null, dev: null };
const seringSalah = (r: { benar: number | null; salah: number | null }) => (r.salah ?? 0) >= 2 && (r.salah ?? 0) > (r.benar ?? 0);

/** Semua yang dibutuhin kartu misi di Beranda & layar pindah langkah di player. */
export function useMisiHarian(level: string) {
  const waktu = useWaktuBelajar();
  const [d, setD] = useState<DataMisi>(KOSONG);
  const [paceLokal, setPaceLokal] = useState<number | null>(null);
  const [sheetTutup, setSheetTutup] = useState(false);

  useEffect(() => {
    let batal = false;
    (async () => {
      if (DEV_BYPASS) {
        const dev = new URLSearchParams(window.location.search).get("misi") ?? "0";
        setD({ ...KOSONG, siap: true, dev, langkah: dev === "1" ? 1 : dev === "2" ? 3 : 0,
          salah: dev === "3" ? { kata: 0, pola: 0 } : { kata: 9, pola: 3 } });
        return;
      }
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!batal) setD({ ...KOSONG, siap: true }); return; }
      const [misi, kata, pola] = await Promise.all([
        supabase.from("misi_harian").select("langkah, penyelamat_selesai").eq("user_id", user.id).eq("tanggal", tanggalLokal()).maybeSingle(),
        supabase.from("kotoba_progress").select("benar, salah").eq("user_id", user.id).eq("level", level).gte("salah", 2),
        supabase.from("bunpou_progress").select("benar, salah").eq("user_id", user.id).gte("salah", 2),
      ]);
      const md = user.user_metadata ?? {};
      const sampai = typeof md.misi_lebih_ulang_sampai === "string" ? md.misi_lebih_ulang_sampai : "";
      if (batal) return;
      setD({
        siap: true,
        langkah: misi.data?.langkah ?? 0,
        penyelamatSelesai: misi.data?.penyelamat_selesai ?? false,
        salah: { kata: (kata.data ?? []).filter(seringSalah).length, pola: (pola.data ?? []).filter(seringSalah).length },
        lebihUlang: sampai >= tanggalLokal(),
        ditanya: typeof md.bolong_ditanya === "string" ? md.bolong_ditanya : null,
        dev: null,
      });
    })().catch(() => { if (!batal) setD({ ...KOSONG, siap: true }); });
    return () => { batal = true; };
  }, [level]);

  const tingkat = tingkatPace(paceLokal ?? waktu.pace);
  const adaSalah = d.salah.kata + d.salah.pola > 0;
  const rencana = useMemo(() => rencanaMisi(tingkat, { adaSalah, lebihUlang: d.lebihUlang }), [tingkat, adaSalah, d.lebihUlang]);
  const bolong = useMemo(() => {
    if (d.dev === "p1") return { jenis: "p1" as const, terakhirAktif: "dev" };
    if (d.dev === "p2") return { jenis: "p2" as const, terakhirAktif: "dev" };
    if (d.dev) return { jenis: null, terakhirAktif: "dev" };
    return statusBolong(waktu.hari, waktu.hariIni);
  }, [d.dev, waktu.hari, waktu.hariIni]);

  /* Penyelamat cuma buat hari ini selama belum dikerjain; setelah itu kartu biasa. */
  const penyelamat = bolong.jenis !== null && !d.penyelamatSelesai && d.langkah === 0;
  const tampilSheet = bolong.jenis === "p2" && !sheetTutup && d.ditanya !== bolong.terakhirAktif && penyelamat;

  const simpanMeta = useCallback(async (data: Record<string, unknown>) => {
    if (DEV_BYPASS) return;
    const { error } = await createClient().auth.updateUser({ data });
    if (error) console.warn(`[misi] gagal simpan: ${error.message}`);
  }, []);

  /** Jawaban sheet "Dua hari gak ketemu". `turun` = pindah ke Santai 10 menit. */
  const jawabBolong = useCallback((alasan: AlasanBolong, turun: boolean) => {
    setSheetTutup(true);
    if (turun) setPaceLokal(PACE_MISI.santai.m);
    if (alasan === "susah") setD(x => ({ ...x, lebihUlang: true }));
    void catatMisi({ alasan });
    const seminggu = new Date(Date.now() + 7 * 86_400_000);
    void simpanMeta({
      bolong_ditanya: bolong.terakhirAktif,
      ...(alasan === "susah" ? { misi_lebih_ulang_sampai: tanggalLokal(seminggu) } : {}),
      ...(turun ? { daily_goal_minutes: PACE_MISI.santai.m } : {}),
    });
  }, [bolong.terakhirAktif, simpanMeta]);

  const tutupSheet = useCallback(() => {
    setSheetTutup(true);
    void simpanMeta({ bolong_ditanya: bolong.terakhirAktif });
  }, [bolong.terakhirAktif, simpanMeta]);

  return {
    siap: d.siap && waktu.siap,
    tingkat,
    rencana,
    langkah: d.langkah,
    salah: d.salah,
    menitHariIni: waktu.hari.get(waktu.hariIni)?.menit ?? 0,
    bolong,
    penyelamat,
    tampilSheet,
    jawabBolong,
    tutupSheet,
  };
}
