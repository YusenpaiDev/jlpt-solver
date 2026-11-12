import "@/styles/premium-offline.css";
import { Check, X } from "lucide-react";
import { honixSrc } from "@/lib/honix-pose";

/* /premium — "Belajar offline vs pakai Honix". Tiap baris = satu momen pas
   belajar; kolom Honix cuma boleh nyebut fitur yang udah jalan. */
const BARIS = [
  {
    momen: "Ketemu kanji atau kata yang gak tau",
    offline: "Buka kamus atau googling, terus catat artinya manual.",
    honix: "Furigana sekali ketuk. Blok katanya → simpan ke Kamus atau tanya Sensei.",
  },
  {
    momen: "Jawaban salah, gak ngerti kenapa",
    offline: "Nunggu ketemu guru, atau beli buku pembahasan lagi.",
    honix: "Pembahasan di tiap soal, dan Sensei AI jawab kapan aja.",
  },
  {
    momen: "Latihan Choukai",
    offline: "Cari CD atau file audio yang cocok sama bukunya.",
    honix: "Audio nempel di tiap soal, tinggal putar.",
  },
  {
    momen: "Hafalan kosakata",
    offline: "Kartu kertas — gak tau mana yang harus diulang hari ini.",
    honix: "Flashcard + Latihan Kilat. Yang hampir lupa muncul lagi pas waktunya.",
  },
  {
    momen: "Mau mulai dari mana",
    offline: "Beli buku kosakata & pola per level, hafalin semua rata.",
    honix: "8.342 kata & 650 pola per level N5–N1 — yang paling sering keluar ditandain.",
  },
  {
    momen: "Nyatet",
    offline: "Buku tulis kececer, susah dicari pas butuh.",
    honix: "Catatan & Kamus pribadi tersimpan rapi, Kamus bisa dicari, dua-duanya bisa di-export.",
  },
  {
    momen: "Udah siap ujian belum?",
    offline: "Koreksi manual, nebak-nebak sendiri.",
    honix: "Dikoreksi otomatis, akurasi per bagian + perkiraan skor.",
  },
  {
    momen: "Biar konsisten",
    offline: "Gampang bolos, gak ada yang ngingetin.",
    honix: "Misi 20 menit sehari, streak, dan pengingat di kalender HP.",
  },
];

const BAWAAN_OFFLINE = ["Kamus", "Buku kosakata", "Buku pola", "Buku soal", "CD audio", "Guru"];

export function OfflineVsHonix() {
  return (
    <section className="ovh" aria-labelledby="ovh-judul">
      <div className="ovh-head">
        <h2 className="pr-section-title" id="ovh-judul">Belajar offline vs pakai Honix</h2>
        <p className="pr-section-sub">Offline kamu harus bolak-balik nyari. Di sini semuanya udah ada.</p>
      </div>

      <div className="ovh-tabel glass-card">
        <div className="ovh-row ovh-kop" aria-hidden="true">
          <span />
          <span className="ovh-k-off">Belajar offline</span>
          <span className="ovh-k-hx">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={honixSrc("kepala")} alt="" />Pakai Honix
          </span>
        </div>
        {BARIS.map(b => (
          <div className="ovh-row" key={b.momen}>
            <b className="ovh-momen">{b.momen}</b>
            <p className="ovh-off"><span className="ovh-i" aria-label="Offline"><X size={12} strokeWidth={2.6} /></span>{b.offline}</p>
            <p className="ovh-hx"><span className="ovh-i" aria-label="Honix"><Check size={13} strokeWidth={3} /></span>{b.honix}</p>
          </div>
        ))}
      </div>

      <div className="ovh-ringkas">
        <div className="ovh-r-off">
          <small>Offline butuh</small>
          <div>{BAWAAN_OFFLINE.map((x, i) => <span key={x}>{i > 0 && <i>+</i>}<em>{x}</em></span>)}</div>
        </div>
        <div className="ovh-r-hx">
          <small>Pakai Honix</small>
          <div><em>Satu aplikasi</em> di HP & laptop</div>
        </div>
      </div>
    </section>
  );
}
