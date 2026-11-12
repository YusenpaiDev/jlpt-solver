"use client";

import { createClient } from "@/lib/supabase/client";
import { laporkanXp } from "@/lib/honix-level";

/* Satu pintu buat nambah XP (Lv Honix). Penambahannya di database lewat RPC
   `tambah_xp` (supabase/migrations/20261112-tambah-xp.sql): atomik — dulu tiap
   halaman baca xp → tambah → tulis, jadi dua latihan yang kesimpan barengan
   bisa nimpa satu sama lain, dan kolom xp bisa diubah langsung dari browser.

   Selama migration belum dijalanin (RPC belum ada, PGRST202), jatuh ke cara
   lama biar XP tetap nambah. */

/** Aturan XP per kegiatan — satu tempat biar gampang disetel. */
export const XP = {
  /** Latihan Kotoba / Kilat Bunpou, per jawaban */
  jawabBenar: 8, jawabSalah: 2,
  /** Set Bank Soal / Choukai / Lembar Tugas: per benar + per set */
  setBenar: 10, setSelesai: 5,
  /** Flashcard nilai sendiri, per kartu */
  kartu: 2,
  /** Misi harian 3 langkah beres / misi penyelamat (sekali sehari) */
  misiSelesai: 30, misiPenyelamat: 10,
} as const;

export async function tambahXp(jumlah: number): Promise<number | null> {
  const n = Math.round(jumlah);
  if (!(n > 0)) return null;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc("tambah_xp", { p_jumlah: n });
  let hasil: { sebelum: number; sesudah: number } | null = null;
  if (!error) {
    const r = (Array.isArray(data) ? data[0] : data) as { sebelum?: number; sesudah?: number } | null;
    if (r && typeof r.sesudah === "number") hasil = { sebelum: r.sebelum ?? r.sesudah - n, sesudah: r.sesudah };
  } else if (error.code === "PGRST202") {
    const { data: prof } = await supabase.from("profiles").select("xp").eq("id", user.id).single();
    if (!prof) return null;
    const { data: t } = await supabase.from("profiles").update({ xp: (prof.xp ?? 0) + n }).eq("id", user.id).select("xp").single();
    if (t) hasil = { sebelum: prof.xp ?? 0, sesudah: t.xp };
  }
  if (!hasil) return null;
  laporkanXp({ userId: user.id, ...hasil });
  return hasil.sesudah;
}
