/** Read every page so older banks resumed recently cannot disappear behind imports. */
export async function loadSessionPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{data: T[] | null; error: unknown}>,
): Promise<{data: T[] | null; error: unknown}> {
  const rows: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const result = await fetchPage(from, from + size - 1);
    if (result.error || !result.data) return {data:null,error:result.error || new Error("Riwayat belum bisa dimuat.")};
    rows.push(...result.data);
    if (result.data.length < size) return {data:rows,error:null};
  }
}
