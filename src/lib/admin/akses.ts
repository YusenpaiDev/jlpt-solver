import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { apakahAdmin } from "./hitung";

/** Bukan admin (atau ADMIN_EMAILS belum diisi) → 404, biar /admin keliatan gak ada. */
export async function wajibAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !apakahAdmin(user.email, process.env.ADMIN_EMAILS)) notFound();
  return user;
}
