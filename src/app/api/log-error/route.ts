import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { catatError } from "@/lib/catat-error";
import { abaikanErrorBrowser } from "@/lib/error-log";

/* Error dari browser (components/PencatatError.tsx). Cuma dari user yang
   login — biar tabelnya gak bisa dibanjiri orang luar. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const b = await req.json().catch(() => null) as { pesan?: unknown; stack?: unknown; path?: unknown; file?: unknown } | null;
  if (!b || typeof b.pesan !== "string") return new NextResponse(null, { status: 400 });
  if (abaikanErrorBrowser(b.pesan, typeof b.file === "string" ? b.file : null)) return new NextResponse(null, { status: 204 });
  await catatError({
    sumber: "browser",
    pesan: b.pesan,
    stack: typeof b.stack === "string" ? b.stack : null,
    path: typeof b.path === "string" ? b.path : null,
    user_id: user.id,
  });
  return new NextResponse(null, { status: 204 });
}
