/* Item nav mana yang nyala (HANDOFF-materi-bank-soal §1). Materi juga nyala di
   halaman kurikulum; Bank Soal juga nyala di Strategi ujian. */
const IKUT: Record<string, string[]> = {
  "/materi": ["/materi", "/kurikulum", "/bandingin"],
  "/bank-soal": ["/bank-soal", "/strategi"],
};

export function navAktif(href: string, path: string): boolean {
  if (href === "/") return path === "/";
  return (IKUT[href] ?? [href]).some(b => path === b || path.startsWith(`${b}/`));
}
