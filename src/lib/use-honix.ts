"use client";

import { useSyncExternalStore } from "react";
import {
  ambilSetelan, ambilSetelanServer, ambilSiap, ambilSiapServer, langganSetelan, ubahSetelan,
  type HonixSetelan,
} from "@/lib/honix-setelan";

const MQ = "(prefers-reduced-motion: reduce)";

function langganMotion(f: () => void) {
  const m = window.matchMedia(MQ);
  m.addEventListener("change", f);
  return () => m.removeEventListener("change", f);
}

/**
 * Pengaturan Honix + status reduced motion (HANDOFF-honix §3, §6).
 * `kurangiGerak` = OS minta reduced motion ATAU user milih "Kurangi" —
 * komponen Honix nempelin kelas `hx-rm` kalau ini true.
 */
export function useHonix(): {
  setelan: HonixSetelan;
  ubah: (patch: Partial<HonixSetelan>) => void;
  kurangiGerak: boolean;
  /** prefers-reduced-motion dari perangkat — buat label default di Pengaturan. */
  motionOS: boolean;
  /** Isi akun udah kebaca (atau pasti gak bisa) — buat keputusan tur. */
  siap: boolean;
} {
  const setelan = useSyncExternalStore(langganSetelan, ambilSetelan, ambilSetelanServer);
  const siap = useSyncExternalStore(langganSetelan, ambilSiap, ambilSiapServer);
  const motionOS = useSyncExternalStore(langganMotion, () => window.matchMedia(MQ).matches, () => false);
  return {
    setelan,
    ubah: ubahSetelan,
    kurangiGerak: motionOS || setelan.gerakan === "kurangi",
    motionOS,
    siap,
  };
}
