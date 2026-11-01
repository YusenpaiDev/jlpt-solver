/* Bank Soal di /materi = katalog bersama (daftar_katalog) + salinan milik user.
   Salinan dibikin database pas set pertama dibuka (ambil_set), jadi user baru
   cuma punya katalog, tester lama cuma punya salinan, kebanyakan campuran. */

export interface SetUjian {
  /** id sesi milik user — null kalau set ini belum pernah dibuka */
  id: string | null;
  /** id di katalog — null buat salinan lama yang judulnya gak ada di katalog */
  katalogId: string | null;
  level: string;
  title: string;
  total: number;
  score: number | null;
  section?: string | null;
  created_at: string | null;
  ready?: boolean; // false = konten belum lengkap → lock "SOON"
}

export interface SesiMilik {
  id: string;
  level: string;
  title: string;
  total: number;
  score: number | null;
  section?: string | null;
  created_at: string;
  ready?: boolean | null;
}

export interface SetKatalog {
  id: string;
  level: string;
  title: string;
  section: string | null;
  total: number;
  ready: boolean;
}

/** Dicocokin lewat judul. Salinan milik user menang (bawa skor & progres),
    tapi status siap ikut katalog — katalog yang paling baru disegarkan. */
export function gabungBankSoal(milik: SesiMilik[], katalog: SetKatalog[]): SetUjian[] {
  const perJudul = new Map(katalog.map(k => [k.title, k]));
  const dipakai = new Set<string>();
  const hasil: SetUjian[] = [];
  for (const s of milik) {
    if (dipakai.has(s.title)) continue; // salinan dobel: yang pertama (terbaru) aja
    dipakai.add(s.title);
    const k = perJudul.get(s.title);
    hasil.push({
      id: s.id, katalogId: k?.id ?? null, level: s.level, title: s.title, total: s.total,
      score: s.score, section: s.section ?? k?.section ?? null, created_at: s.created_at,
      ready: k ? k.ready : s.ready !== false,
    });
  }
  for (const k of katalog) {
    if (dipakai.has(k.title)) continue;
    hasil.push({
      id: null, katalogId: k.id, level: k.level, title: k.title, total: k.total,
      score: null, section: k.section, created_at: null, ready: k.ready,
    });
  }
  return hasil;
}
