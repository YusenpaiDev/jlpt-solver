import type { Instrumentation } from "next";
import { catatError } from "@/lib/catat-error";

/* Error server (render, route handler, server action, proxy) → error_log.
   Header & query string sengaja gak disimpan. Lihat /admin. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const e = err as Error & { digest?: string };
  await catatError({
    sumber: "server",
    pesan: e.message,
    stack: e.stack,
    path: request.path,
    digest: e.digest,
    rute: `${context.routeType} ${context.routePath}`,
  });
};
