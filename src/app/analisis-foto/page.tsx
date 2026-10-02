import { redirect } from "next/navigation";

// Pertahankan bookmark player lama; fitur Analisis Foto sudah dihentikan.
export default async function AnalisisFoto({
  searchParams,
}: {
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  const { session } = await searchParams;
  const sessionId = Array.isArray(session) ? session[0] : session;
  redirect(sessionId ? `/latihan/${encodeURIComponent(sessionId)}` : "/materi");
}
