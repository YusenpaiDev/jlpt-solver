import { redirect } from "next/navigation";

// List choukai digabung ke Bank Soal (/materi, filter 聴解). Player tetap di
// /choukai/[id]. Lihat handoff §3.
export default function ChoukaiListRedirect() {
  redirect("/materi#bank-soal");
}
