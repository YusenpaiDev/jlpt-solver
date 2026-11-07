import Link from "next/link";

/* Materi cuma tampil di level target. Level lain dibuka dengan ganti target. */
export function GantiTarget() {
  return <Link href="/pengaturan#target" className="ganti-target">Mau level lain? Ganti target →</Link>;
}
