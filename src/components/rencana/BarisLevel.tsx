import Link from "next/link";
import { labelSesi } from "@/lib/sesi-ujian";

/** "N3 · target · Ujian Juli 2027 · Mau level lain? Ganti target →" — level
    dikunci ke target, gak ada pemilih level (HANDOFF-materi-bank-soal §2.1). */
export function BarisLevel({ level, examDate }: { level: string; examDate: string | null }) {
  return (
    <div className="lvrow">
      <span className="chip">{level} · target</span>
      <span>{examDate ? `Ujian ${labelSesi(examDate)}` : "Sesi ujian belum dipilih"}</span>
      <Link href="/pengaturan#target">Mau level lain? Ganti target →</Link>
    </div>
  );
}
