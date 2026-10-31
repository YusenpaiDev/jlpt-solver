"use client";

import { useEffect } from "react";
import { abaikanErrorBrowser } from "@/lib/error-log";

const MAKS_PER_HALAMAN = 5;

/** Nangkep error JS yang gak ketangkep di browser → /api/log-error. Gak render apa-apa. */
export function PencatatError() {
  useEffect(() => {
    const terkirim = new Set<string>();
    const kirim = (pesan: string, stack?: string, file?: string) => {
      if (!pesan || terkirim.size >= MAKS_PER_HALAMAN || terkirim.has(pesan) || abaikanErrorBrowser(pesan, file)) return;
      terkirim.add(pesan);
      fetch("/api/log-error", {
        method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
        body: JSON.stringify({ pesan, stack, path: location.pathname, file }),
      }).catch(() => { /* pencatatan gak boleh bikin error baru */ });
    };
    const onError = (e: ErrorEvent) => kirim(e.message, e.error instanceof Error ? e.error.stack : undefined, e.filename);
    const onReject = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      kirim(r instanceof Error ? `${r.name}: ${r.message}` : String(r), r instanceof Error ? r.stack : undefined);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onReject); };
  }, []);
  return null;
}
