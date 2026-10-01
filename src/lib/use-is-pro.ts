"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

let cachedPromise: Promise<boolean | null> | null = null;
let isPro: boolean | null = null;
let listeningToAuth = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function load() {
  if (cachedPromise) return;

  const request = Promise.resolve()
    .then(async () => {
      const { data, error } = await createClient().rpc("is_pro");
      return !error && typeof data === "boolean" ? data : null;
    })
    .catch(() => null);

  cachedPromise = request;
  void request.then((result) => {
    // Abaikan hasil milik sesi lama kalau auth berubah saat RPC berjalan.
    if (cachedPromise !== request) return;
    isPro = result;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (!listeningToAuth) {
    listeningToAuth = true;
    // Satu listener sepanjang umur modul, termasuk saat nav tidak terpasang.
    createClient().auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;
      cachedPromise = null;
      isPro = null;
      notify();
      // Jalankan RPC di luar callback auth agar tidak menunggu lock Supabase.
      setTimeout(() => {
        if (listeners.size > 0) load();
      }, 0);
    });
  }

  load();
  return () => { listeners.delete(listener); };
}

const getSnapshot = () => isPro;
const getServerSnapshot = () => null;

/** Satu RPC bersama per muat halaman; null berarti status belum diketahui. */
export function useIsPro(): boolean | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
