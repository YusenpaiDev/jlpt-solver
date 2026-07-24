import { redirect } from "next/navigation";

// URL bersih buat player latihan. Player-nya masih di /analisis-foto (via
// ?session=), jadi route ini nge-forward ke situ. Lihat handoff §5.
export default async function Latihan({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  redirect(`/analisis-foto?session=${sessionId}`);
}
