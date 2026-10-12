/** Supabase can return zero updated rows without throwing (for example RLS). */
export function assertProgressSaved(
  sessionId: string,
  response: { data: { id: string } | null; error: unknown },
) {
  if (response.error || response.data?.id !== sessionId) {
    throw new Error("Progres belum tersimpan. Periksa koneksi lalu coba simpan lagi.");
  }
}

/** All writes for one open session finish in the order they were requested. */
export function createSaveQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(write: () => Promise<T>): Promise<T> {
    const next = tail.then(write, write);
    tail = next.catch(() => undefined);
    return next;
  };
}
