/* "Pasang pengingat di kalender HP": file .ics berulang, jadi yang ngingetin
   kalender & alarm HP user sendiri — jalan di iPhone/Android, tanpa server,
   tanpa push. Waktu "floating" (tanpa zona) = jam lokal HP. Murni — dites di
   tests/pengingat-ics.test.mjs. */

export interface IsiPengingat {
  /** "19:00" */
  jam: string;
  /** menit misi harian */
  menit: number;
  /** tanggal mulai YYYY-MM-DD (hari ini) */
  mulai: string;
  /** Ulangan Senin udah live → acara mingguan Senin; belum → tes mini Sabtu */
  ulangan: boolean;
  url: string;
  /** buat DTSTAMP; default sekarang */
  kini?: Date;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
const tgl = (t: string) => t.replaceAll("-", "");

/** Hari pertama dari `mulai` yang jatuh di hari `dow` (0 = Minggu). */
export function hariBerikut(mulai: string, dow: number): string {
  const [y, m, d] = mulai.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + ((dow - t.getUTCDay() + 7) % 7));
  return t.toISOString().slice(0, 10);
}

function acara(k: { uid: string; mulai: string; jam: string; durasi: number; aturan: string; judul: string; isi: string; url: string; stamp: string }): string[] {
  const [h, mi] = k.jam.split(":");
  return [
    "BEGIN:VEVENT",
    `UID:${k.uid}@honixjlpt.com`,
    `DTSTAMP:${k.stamp}`,
    `DTSTART:${tgl(k.mulai)}T${h.padStart(2, "0")}${mi.padStart(2, "0")}00`,
    `DURATION:PT${k.durasi}M`,
    `RRULE:${k.aturan}`,
    `SUMMARY:${esc(k.judul)}`,
    `DESCRIPTION:${esc(`${k.isi}\n${k.url}`)}`,
    `URL:${k.url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(k.judul)}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
  ];
}

export function buatIcs(p: IsiPengingat): string {
  const stamp = (p.kini ?? new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const baris = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Honix JLPT//Pengingat belajar//ID",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Honix JLPT",
    ...acara({
      uid: "honix-harian", mulai: p.mulai, jam: p.jam, durasi: p.menit, aturan: "FREQ=DAILY", stamp, url: p.url,
      judul: `Belajar Honix · misi ${p.menit} menit`,
      isi: "Buka Honix, kerjain misi hari ini. Itu aja.",
    }),
    ...(p.ulangan
      ? acara({
        uid: "honix-ulangan", mulai: hariBerikut(p.mulai, 1), jam: p.jam, durasi: 10, aturan: "FREQ=WEEKLY;BYDAY=MO", stamp, url: p.url,
        judul: "Ulangan mingguan Honix · ±10 menit",
        isi: "Cek yang nempel dari minggu lalu. Kartunya ada di misi hari Senin.",
      })
      : acara({
        uid: "honix-tes-mini", mulai: hariBerikut(p.mulai, 6), jam: p.jam, durasi: 15, aturan: "FREQ=WEEKLY;BYDAY=SA", stamp, url: p.url,
        judul: "Tes mini Honix · 15 soal ±15 menit",
        isi: "Cek seminggu ini nempel atau nggak. Ada di Progres → Tes mini.",
      })),
    "END:VCALENDAR",
  ];
  return baris.join("\r\n") + "\r\n";
}
