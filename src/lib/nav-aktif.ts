/* Item nav mana yang nyala (HANDOFF-alur-belajar §6, nav 5 menu).
   Materi juga nyala di kurikulum; Latihan di semua /latihan/*, Strategi ujian,
   dan simulasi; Kamus di /kamus/* (termasuk Catatan). */
const IKUT: Record<string, string[]> = {
  "/materi": ["/materi", "/kurikulum", "/bandingin"],
  "/latihan/set": ["/latihan", "/strategi", "/simulasi"],
  "/kamus": ["/kamus"],
  "/progres": ["/progres"],
};

export function navAktif(href: string, path: string): boolean {
  if (href === "/") return path === "/";
  return (IKUT[href] ?? [href]).some(b => path === b || path.startsWith(`${b}/`));
}
