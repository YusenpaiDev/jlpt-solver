import type { ReactNode } from "react";

/**
 * Satu meter Free vs Pro / pemakaian harian.
 * `isi` = kelas gradien (py-f-ok / py-f-warn / py-f-full / py-f-acc).
 */
export function Meter({
  label, nilai, persen, isi, legend, warnaNilai, penuh,
}: {
  label: string;
  nilai: ReactNode;
  persen: number;
  isi: string;
  /** [kiri, kanan] — mis. [{warna, teks:"Free 5"}, {warna, teks:"Pro 50"}] */
  legend?: { warna: string; teks: string }[];
  warnaNilai?: string;
  /** Menuhin dua lajur di grid pemakaian desktop. */
  penuh?: boolean;
}) {
  const w = Math.max(0, Math.min(100, persen));
  return (
    <div className={`py-m${penuh ? " full" : ""}`}>
      <div className="py-m-top">
        <span className="py-m-l">{label}</span>
        <span className="py-m-v" style={warnaNilai ? { color: warnaNilai } : undefined}>{nilai}</span>
      </div>
      <div className="py-m-t" role="meter" aria-label={label} aria-valuenow={Math.round(w)} aria-valuemin={0} aria-valuemax={100}>
        <i className={isi} style={{ width: `${w}%` }} />
      </div>
      {legend && (
        <div className="py-m-legend">
          {legend.map((l, i) => (
            <span key={l.teks} style={{ display: "contents" }}>
              <span className={`sw${i > 0 ? " second" : ""}`} style={{ background: l.warna }} />
              <span>{l.teks}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
