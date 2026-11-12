"use client";

import "@/styles/rencana-dasar.css";
import "@/styles/alur.css";
import { useEffect, useState } from "react";
import { buatIcs } from "@/lib/pengingat-ics";
import { tanggalLokal } from "@/lib/aktivitas";
import { fiturLive } from "@/lib/kurikulum-config";
import { PACE_MISI, tingkatPace } from "@/lib/misi-harian";

const KUNCI = "honix:jam-pengingat";
const bacaJam = () => { try { return localStorage.getItem(KUNCI) || "19:00"; } catch { return "19:00"; } };

/** "Pasang pengingat di kalender HP": unduh .ics berulang (harian + mingguan).
    Yang ngingetin kalender & alarm HP sendiri — tanpa server, tanpa izin push. */
export function PasangPengingat({ menit: pace }: { menit: number }) {
  /* Pace tersimpan (5–120) → menit misi yang beneran dipakai kartu misi (10/20/40). */
  const menit = PACE_MISI[tingkatPace(pace)].m;
  /* Jam tersimpan dibaca setelah mount (server gak punya localStorage → gak mismatch). */
  const [jam, setJam] = useState("19:00");
  useEffect(() => { const t = setTimeout(() => setJam(bacaJam()), 0); return () => clearTimeout(t); }, []);
  const [sudah, setSudah] = useState(false);
  const ulangan = fiturLive("ulangan");

  const unduh = () => {
    try { localStorage.setItem(KUNCI, jam); } catch { /* mode privat */ }
    const ics = buatIcs({ jam, menit, mulai: tanggalLokal(), ulangan, url: window.location.origin });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "honix-pengingat.ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setSudah(true);
  };

  return (
    <div className="rbk">
      <div className="pgi">
        <div className="pgi-t">📅 Pasang pengingat di kalender HP</div>
        <p className="pgi-p">
          HP-mu yang ngingetin tiap hari di jam pilihanmu (misi {menit} menit), plus {ulangan ? "ulangan tiap Senin" : "tes mini tiap Sabtu"}.
          Gak butuh izin notifikasi, dan bisa dihapus kapan aja dari aplikasi kalender.
        </p>
        <div className="pgi-a">
          <label className="pgi-j">Jam belajar<input type="time" value={jam} onChange={e => { setJam(e.target.value || "19:00"); setSudah(false); }} /></label>
          <button type="button" className="btn btn-p" onClick={unduh}>{sudah ? "Unduh lagi" : "Pasang pengingat"}</button>
        </div>
        {sudah && <p className="pgi-ok" role="status">Udah keunduh. Buka file <b>honix-pengingat.ics</b>, terus pilih <b>Tambah ke kalender</b>. Di iPhone tombolnya langsung muncul.</p>}
      </div>
    </div>
  );
}
