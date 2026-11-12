/* Gembok setelah masa percobaan 7 hari habis (belum Premium): semua isi tetap
   kelihatan, yang dikunci cuma "ngerjain" — halaman latihan & tombol aksi.
   Pencet gembok → pop-up yang ngantar ke /premium. Murni + pemicu pop-up;
   dites di tests/akses-premium.test.mjs. Server tetap jaga sendiri
   (has_learning_access di RPC & RLS), ini cuma biar user tahu kenapa. */

/** Halaman "ngerjain" (player). Daftar set / Lembar Tugas / Kamus tetap kebuka, tombolnya yang dikunci. */
const HALAMAN = ["/latihan/kotoba", "/latihan/kilat", "/analisis-foto", "/progres/ulangan", "/penempatan"];
/** /choukai/<id> (player; /choukai sendiri cuma redirect) & /latihan/<uuid sesi>. */
const DENGAN_ID = /^\/(choukai\/[^/]+|latihan\/[0-9a-f]{8}-[0-9a-f-]{27,})$/i;

export function ruteTerkunci(href: string): boolean {
  const path = href.replace(/^https?:\/\/[^/]+/, "").split(/[?#]/)[0].replace(/\/$/, "") || "/";
  return HALAMAN.some(h => path === h || path.startsWith(`${h}/`)) || DENGAN_ID.test(path);
}

/** Kenapa pop-up dibuka — buat judul yang nyambung. */
export type AlasanKunci = "habis" | "latihan" | "simpan" | "sensei";

export const JUDUL_KUNCI: Record<AlasanKunci, string> = {
  habis: "Masa percobaan 7 hari udah habis",
  latihan: "Latihan ini buat Premium",
  simpan: "Nyimpen & nambah buat Premium",
  sensei: "Sensei AI buat Premium",
};

/* Pemicu dari mana aja (tombol yang dikunci, link yang dicegat). */
const pendengar = new Set<(a: AlasanKunci) => void>();
export function dengarKunci(f: (a: AlasanKunci) => void) { pendengar.add(f); return () => { pendengar.delete(f); }; }
export const bukaPremium = (a: AlasanKunci = "latihan") => pendengar.forEach(f => f(a));

/* Status kunci bersama (diisi host di nav / penjaga halaman, dibaca tombol mana aja). */
let terkunci = false;
const ganti = new Set<() => void>();
export function setTerkunci(v: boolean) { if (v === terkunci) return; terkunci = v; ganti.forEach(f => f()); }
export const ambilTerkunci = () => terkunci;
export function langgananTerkunci(f: () => void) { ganti.add(f); return () => { ganti.delete(f); }; }
