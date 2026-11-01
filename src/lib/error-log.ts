/**
 * Aturan pencatat error — fungsi murni (dites di tests/error-log.test.mjs).
 * Yang nulis ke DB: catat-error.ts (server). Yang nangkep di browser:
 * components/PencatatError.tsx.
 */

export type ErrorMasuk = {
  sumber: "server" | "browser";
  pesan: string;
  stack?: string | null;
  path?: string | null;
  digest?: string | null;
  rute?: string | null;
  user_id?: string | null;
};

const MAKS_PESAN = 500;
const MAKS_STACK = 4000;

/** Potong panjang + buang query string (bisa berisi order_id/token). */
export function rapikanError(e: ErrorMasuk): ErrorMasuk {
  const potong = (s: string | null | undefined, n: number) => (s ? String(s).slice(0, n) : null);
  const path = e.path ? String(e.path).split(/[?#]/)[0].slice(0, 300) : null;
  return {
    sumber: e.sumber === "server" ? "server" : "browser",
    pesan: (String(e.pesan || "").trim() || "(tanpa pesan)").slice(0, MAKS_PESAN),
    stack: potong(e.stack, MAKS_STACK),
    path,
    digest: potong(e.digest, 100),
    rute: potong(e.rute, 200),
    user_id: e.user_id ?? null,
  };
}

/** Error browser yang bukan salah app kita — gak usah dicatat. */
export function abaikanErrorBrowser(pesan: string, file?: string | null): boolean {
  if (file && /^(chrome|moz|safari(-web)?)-extension:/.test(file)) return true;
  return /^Script error\.?$/i.test(pesan.trim())       // error lintas-origin tanpa detail
    || /ResizeObserver loop/i.test(pesan)               // peringatan browser, bukan bug
    || /^(AbortError|The operation was aborted)/i.test(pesan); // user pindah halaman pas fetch
}
