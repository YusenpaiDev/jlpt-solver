import { LABEL_DISIAPKAN } from "@/lib/kurikulum-config";

/** Pill "Sedang disiapkan" (HANDOFF-kurikulum §4). Teksnya dari config. */
export function LabelDisiapkan({ kecil = false }: { kecil?: boolean }) {
  return <span className={`prep${kecil ? " sm" : ""}`}>{LABEL_DISIAPKAN}</span>;
}
