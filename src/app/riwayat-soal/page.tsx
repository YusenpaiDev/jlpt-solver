import { redirect } from "next/navigation";

// Riwayat Soal digabung ke /progres (tab Log). Lihat handoff restrukturisasi §1.
export default function RiwayatRedirect() {
  redirect("/progres?tab=log");
}
