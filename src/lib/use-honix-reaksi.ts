"use client";

import { useCallback, useRef, useState } from "react";
import { useHonix } from "@/lib/use-honix";

/**
 * Aturan reaksi cepat (HANDOFF-honix §4) — biar gak ganggu:
 *   · Normal: 5 benar / 3 salah beruntun. Jarang: 8 / 4. Mati: gak pernah.
 *   · maks 1 per 8 detik, maks 3 per sesi
 *   · gak muncul di 2 soal pertama
 *   · gak muncul kalau popup selesai tinggal ≤1 soal lagi
 *   · hitungan beruntun direset setelah reaksi muncul
 *
 * Cuma buat Latihan Kilat & Drill. Bank Soal 過去問 gak pakai ini.
 */
export function useHonixReaksi(totalSoal: number) {
  const { setelan } = useHonix();
  const [reaksi, setReaksi] = useState<{ id: number; kind: "ok" | "no"; beruntun: number } | null>(null);
  const r = useRef({ ok: 0, no: 0, terakhir: 0, jumlah: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Panggil tiap soal dijawab. `idx` = indeks soal (0-based). */
  const catat = useCallback((benar: boolean, idx: number) => {
    const s = r.current;
    if (benar) { s.ok++; s.no = 0; } else { s.no++; s.ok = 0; }
    if (setelan.reaksi === "mati") return;

    const butuh = setelan.reaksi === "jarang" ? { ok: 8, no: 4 } : { ok: 5, no: 3 };
    const kind = s.ok >= butuh.ok ? "ok" : s.no >= butuh.no ? "no" : null;
    if (!kind) return;
    if (idx < 2 || idx >= totalSoal - 2) return;
    const kini = Date.now();
    if (kini - s.terakhir < 8000 || s.jumlah >= 3) return;

    const beruntun = kind === "ok" ? s.ok : s.no;
    s.ok = 0; s.no = 0; s.terakhir = kini; s.jumlah++;
    /* Jeda dikit biar gak motong bunyi ting/salah jawaban (honix-sfx motong
       bunyi yang < 400ms). */
    timer.current = setTimeout(() => setReaksi({ id: kini, kind, beruntun }), 450);
  }, [setelan.reaksi, totalSoal]);

  /** Panggil juga tiap pindah soal — reaksi gak boleh kebawa ke soal berikutnya. */
  const tutup = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setReaksi(null);
  }, []);

  return { reaksi, catat, tutup };
}
