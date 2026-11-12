import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Klien service role (lewatin RLS). Cuma dipakai di route server, selalu
    dibatasi ke user yang lagi login (user_id = dia). */
export function klienAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.SUPABASE_SECRET_KEY!.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
