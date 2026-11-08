"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { aturDisembunyikan, rapikanDisembunyikan, type JenisSoal } from "@/lib/strategi-ujian";

const DEV_BYPASS = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "1";

/** Kartu teknik yang dicentang "jangan tampilkan lagi" (user_metadata.teknik_disembunyikan). */
export function useTeknikDisembunyikan() {
  const [daftar, setDaftar] = useState<JenisSoal[]>([]);
  const [siap, setSiap] = useState(DEV_BYPASS);

  useEffect(() => {
    if (DEV_BYPASS) return;
    let batal = false;
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (batal) return;
      setDaftar(rapikanDisembunyikan(user?.user_metadata?.teknik_disembunyikan));
      setSiap(true);
    }).catch(() => { if (!batal) setSiap(true); });
    return () => { batal = true; };
  }, []);

  const atur = useCallback((jenis: JenisSoal, sembunyi: boolean) => {
    const baru = aturDisembunyikan(daftar, jenis, sembunyi);
    setDaftar(baru);
    if (DEV_BYPASS) return;
    void createClient().auth.updateUser({ data: { teknik_disembunyikan: baru } }).then(({ error }) => {
      if (error) console.warn(`[teknik] gagal simpan: ${error.message}`);
    });
  }, [daftar]);

  return { siap, daftar, atur };
}
