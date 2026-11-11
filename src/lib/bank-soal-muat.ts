import { createClient } from "@/lib/supabase/client";
import { gabungBankSoal, type SesiMilik, type SetKatalog, type SetUjian } from "@/lib/bank-soal";
import { DEV_BYPASS, devBankSoal } from "@/lib/dev-materi";

/** Katalog Bank Soal + salinan milik user (semua level). null = gagal dimuat. */
export async function muatBankSoal(): Promise<SetUjian[] | null> {
  if (DEV_BYPASS) {
    const mode = new URLSearchParams(window.location.search).get("dev");
    const d = ["N1", "N2", "N3", "N4", "N5"].map(l => devBankSoal(l, mode));
    return gabungBankSoal(d.flatMap(x => x.milik), d.flatMap(x => x.katalog));
  }
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [milik, katalog] = await Promise.all([
    supabase.from("sessions")
      .select("id, level, title, total, score, created_at, ai_result->section, ai_result->ready, ai_result->stats")
      .eq("user_id", user.id)
      .eq("ai_result->>kind", "materi")
      .order("created_at", { ascending: false }),
    supabase.rpc("daftar_katalog"),
  ]);
  if (milik.error) return null;
  /* Katalog gagal kebaca → tetap tampilin salinan yang udah dimiliki. */
  return gabungBankSoal((milik.data ?? []) as SesiMilik[], katalog.error ? [] : (katalog.data ?? []) as SetKatalog[]);
}

/** Id sesi milik user buat set ini; set dari katalog disalin dulu (ambil_set). */
export async function bukaSet(s: SetUjian): Promise<{ id: string } | { galat: "langganan" | "gagal" }> {
  if (s.id) return { id: s.id };
  if (!s.katalogId) return { galat: "gagal" };
  const { data, error } = await createClient().rpc("ambil_set", { p_katalog: s.katalogId });
  if (error || typeof data !== "string") return { galat: error?.message?.includes("subscription_required") ? "langganan" : "gagal" };
  return { id: data };
}

export const urlSet = (s: SetUjian, id: string) => (s.section === "choukai" ? `/choukai/${id}` : `/latihan/${id}`);
