import type { MouseEvent } from "react";

/**
 * Link nav ke "#bagian" di halaman yang lagi dibuka: geser sendiri ke sana.
 * Next 16 nambahin hash dobel (/materi#bank-soal#bank-soal) dan gak geser
 * kalau alamatnya udah sama persis. Halaman lain → biarin Link jalan biasa.
 */
export function lompatDiHalamanSama(e: MouseEvent, href: string) {
  const [path, id] = href.split("#");
  if (!id || window.location.pathname !== path) return;
  const el = document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  window.history.replaceState(window.history.state, "", href);
  const pelan = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Tunggu menu HP ketutup dulu: penutupnya balikin posisi scroll lama.
  setTimeout(() => el.scrollIntoView({ block: "start", behavior: pelan ? "smooth" : "auto" }), 50);
}
