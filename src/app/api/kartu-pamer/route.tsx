import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { susunKartu, type IsiKartu } from "@/lib/kartu-pamer";
import { labelSesi, rapikanTanggalUjian } from "@/lib/sesi-ujian";
import { strategiUntuk } from "@/lib/strategi-ujian";
import { skorTes } from "@/lib/tes-mini";

/* Kartu pamer PNG (handoff Rencana Belajar §11): story 1080×1920 / feed 1080×1080.
   Dirender di server biar hasilnya sama di semua HP. Email gak pernah masuk kartu. */

const DEV_BYPASS = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "1";
const HARI = 86_400_000;
const tglValid = (x: string | null) => (x && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x)) ? x : null);
const wib = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
type PerCat = Record<string, { a?: number; c?: number }>;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const story = url.searchParams.get("format") !== "feed";
  const pakaiNama = url.searchParams.get("nama") !== "0";
  const hariIni = tglValid(url.searchParams.get("tanggal")) ?? wib(new Date());

  let isi: IsiKartu;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    if (!DEV_BYPASS) return new Response("Belum login", { status: 401 });
    isi = contohDev(hariIni, pakaiNama);
  } else {
    const sejak30 = new Date(Date.parse(hariIni) - 30 * HARI).toISOString();
    const [waktu, aktivitas, streak, profil, tes, latihan] = await Promise.all([
      supabase.from("waktu_belajar").select("tanggal, detik").eq("user_id", user.id),
      supabase.from("aktivitas_harian").select("tanggal").eq("user_id", user.id),
      supabase.rpc("streak_saya", { p_hari_ini: hariIni }),
      supabase.from("profiles").select("username").eq("id", user.id).maybeSingle(),
      supabase.from("tes_mini").select("sesi_id").eq("user_id", user.id),
      supabase.from("sessions").select("stats:ai_result->stats").eq("user_id", user.id).gte("created_at", sejak30),
    ]);
    const md = user.user_metadata ?? {};
    const level = typeof md.target_level === "string" && /^N[1-5]$/.test(md.target_level) ? md.target_level : "N3";
    const ujian = rapikanTanggalUjian(md.exam_date);

    /* Tes mini terbaik: perkiraan total, 聴解 dari latihan 30 hari (sama kayak tab Tes mini). */
    let a = 0, c = 0;
    for (const s of (latihan.data ?? []) as { stats: { perCat?: PerCat } | null }[]) {
      const v = s.stats?.perCat?.["聴解"];
      a += Math.max(0, v?.a ?? 0); c += Math.max(0, v?.c ?? 0);
    }
    const ids = (tes.data ?? []).map(t => t.sesi_id as string);
    const sesiTes = ids.length
      ? ((await supabase.from("sessions").select("total, stats:ai_result->stats").in("id", ids)).data ?? []) as { total: number; stats: { answered?: number; perCat?: PerCat } | null }[]
      : [];
    const L = strategiUntuk(level);
    const tesTotal = sesiTes
      .filter(s => s.total > 0 && (s.stats?.answered ?? 0) >= s.total)
      .map(s => skorTes(L, s.stats?.perCat ?? {}, a > 0 ? { a, c } : null).total);

    const baris = Array.isArray(streak.data) ? streak.data[0] : streak.data;
    isi = susunKartu({
      hariIni,
      waktu: (waktu.data ?? []) as { tanggal: string; detik: number }[],
      aktivitas: (aktivitas.data ?? []) as { tanggal: string }[],
      streak: typeof baris?.sekarang === "number" ? baris.sekarang : 0,
      level,
      sesiLabel: ujian ? labelSesi(ujian) : null,
      tesTotal,
      nama: pakaiNama ? (profil.data?.username as string | null) ?? null : null,
    });
  }

  /* Path literal (bukan variabel) biar file-nya kebawa ke fungsi server Vercel. */
  const [medium, semibold, bold, gaku] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Geist-Medium.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Geist-SemiBold.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Geist-Bold.ttf")),
    readFile(join(process.cwd(), "assets/fonts/NotoSerifJP-Bold-gaku.ttf")),
  ]);
  const asal = url.origin;

  return new ImageResponse(story ? <Story isi={isi} asal={asal} /> : <Feed isi={isi} asal={asal} />, {
    width: 1080,
    height: story ? 1920 : 1080,
    fonts: [
      { name: "Geist", data: medium, weight: 500, style: "normal" },
      { name: "Geist", data: semibold, weight: 600, style: "normal" },
      { name: "Geist", data: bold, weight: 700, style: "normal" },
      { name: "Noto Serif JP", data: gaku, weight: 700, style: "normal" },
    ],
    headers: { "Cache-Control": "private, no-store" },
  });
}

/* ── Gaya kartu (port .pk dari prototype; grid → flex, Satori cuma ngerti flex) ── */
const LATAR = {
  backgroundColor: "#100C12",
  backgroundImage: "radial-gradient(ellipse 80% 50% at 70% 30%, rgba(221,65,36,.45), transparent 60%), radial-gradient(ellipse 70% 50% at 10% 100%, rgba(139,90,140,.35), transparent 60%)",
};

function Atas({ isi, asal, feed }: { isi: IsiKartu; asal: string; feed?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 40, fontWeight: 700 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og cuma ngerti <img> */}
        <img src={`${asal}/honix/09-kepala.png`} width={84} height={84} alt="" />
        Honix JLPT
      </div>
      {isi.nama && <div style={{ display: "flex", fontSize: 38, color: "rgba(255,255,255,.75)", marginTop: feed ? 36 : 64, fontWeight: 500 }}>{`@${isi.nama}`}</div>}
      <div style={{ display: "flex", fontSize: 46, color: "rgba(255,255,255,.8)", fontWeight: 500, marginTop: 24 }}>Udah belajar</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 18, lineHeight: 0.85, marginTop: 10 }}>
        <div style={{
          display: "flex", fontSize: feed ? 230 : 300, fontWeight: 700, letterSpacing: feed ? -13.8 : -18,
          backgroundImage: "linear-gradient(160deg, #FFE9DC, #EC7A5C 55%, #DD4124)", backgroundClip: "text", color: "transparent",
        }}>{isi.jam}</div>
        <div style={{ display: "flex", fontSize: feed ? 64 : 80, fontWeight: 600 }}>jam</div>
      </div>
    </div>
  );
}

function Stat({ label, nilai, feed }: { label: string; nilai: string; feed?: boolean }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", ...(feed ? {} : { flex: 1 }),
      padding: feed ? "20px 26px" : "28px 34px", borderRadius: 32,
      backgroundColor: "rgba(255,255,255,.07)", border: "2px solid rgba(255,255,255,.1)",
    }}>
      <span style={{ fontSize: feed ? 24 : 28, color: "rgba(255,255,255,.65)", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontSize: feed ? 42 : 40, fontWeight: 700, marginTop: 6, letterSpacing: -0.8 }}>{nilai}</span>
    </div>
  );
}

function Statistik({ isi, feed }: { isi: IsiKartu; feed?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: feed ? "column" : "row", gap: feed ? 16 : 18, marginTop: feed ? 44 : 64 }}>
      <Stat label="Streak" nilai={`🔥 ${isi.streak} hari`} feed={feed} />
      <Stat label="Target" nilai={isi.target} feed={feed} />
      {isi.tesTerbaik !== null
        ? <Stat label="Tes mini terbaik" nilai={`${isi.tesTerbaik} / 180`} feed={feed} />
        : <Stat label="Bulan ini" nilai={`${isi.hariBulan} hari belajar`} feed={feed} />}
    </div>
  );
}

function Kalender({ isi, feed }: { isi: IsiKartu; feed?: boolean }) {
  /* Lebar dalam kalender story 804px (border-box) → 7 × 104 + 6 × 12. */
  const lebar = feed ? 46 : 104, tinggi = feed ? 50 : 84, gap = feed ? 9 : 12;
  const sel = [
    ...Array.from({ length: isi.kosongDepan }, () => null),
    ...isi.aktif,
  ];
  return (
    <div style={{
      display: "flex", flexDirection: "column", marginTop: feed ? 0 : 44, padding: feed ? 28 : 40, borderRadius: 40,
      backgroundColor: "rgba(0,0,0,.35)", border: "2px solid rgba(255,255,255,.08)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: feed ? 26 : 34, fontWeight: 600, marginBottom: feed ? 16 : 26 }}>
        <span>{isi.bulanLabel}</span>
        <span style={{ color: "rgba(255,255,255,.6)", fontWeight: 500 }}>{isi.hariBulan} hari</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap }}>
        {sel.map((a, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", justifyContent: "center", width: lebar, height: tinggi,
            borderRadius: feed ? 12 : 18,
            backgroundColor: a === null ? "transparent" : a ? "rgba(233,87,58,.12)" : "rgba(255,255,255,.06)",
            border: a ? "3px solid rgba(233,87,58,.75)" : "3px solid transparent",
            color: "#E9573A", fontFamily: "Noto Serif JP", fontWeight: 700, fontSize: feed ? 24 : 34,
          }}>{a ? "学" : ""}</div>
        ))}
      </div>
    </div>
  );
}

function Story({ isi, asal }: { isi: IsiKartu; asal: string }) {
  return (
    <div style={{ ...LATAR, display: "flex", flexDirection: "column", position: "relative", width: 1080, height: 1920, padding: "110px 96px", color: "#fff", fontFamily: "Geist" }}>
      <Atas isi={isi} asal={asal} />
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og cuma ngerti <img> */}
      <img src={`${asal}/honix/01-senang.png`} width={520} height={520} alt="" style={{ position: "absolute", right: -10, top: 250 }} />
      <Statistik isi={isi} />
      <Kalender isi={isi} />
      <div style={{ position: "absolute", left: 96, right: 96, bottom: 90, display: "flex", justifyContent: "space-between", fontSize: 30, color: "rgba(255,255,255,.55)" }}>
        <span>Belajar JLPT bareng Honix</span><span>{isi.tanggalLabel}</span>
      </div>
    </div>
  );
}

function Feed({ isi, asal }: { isi: IsiKartu; asal: string }) {
  return (
    <div style={{ ...LATAR, display: "flex", gap: 40, width: 1080, height: 1080, padding: 84, color: "#fff", fontFamily: "Geist" }}>
      <div style={{ display: "flex", flexDirection: "column", width: 436 }}>
        <Atas isi={isi} asal={asal} feed />
        <Statistik isi={isi} feed />
      </div>
      <div style={{ display: "flex", flexDirection: "column", width: 436 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og cuma ngerti <img> */}
        <img src={`${asal}/honix/01-senang.png`} width={400} height={400} alt="" style={{ marginTop: -30, marginBottom: -40, alignSelf: "center" }} />
        <Kalender isi={isi} feed />
      </div>
    </div>
  );
}

/* Contoh buat cek visual lokal (mode dev tanpa login). */
function contohDev(hariIni: string, pakaiNama: boolean): IsiKartu {
  const waktu = Array.from({ length: 60 }, (_, i) => ({
    tanggal: new Date(Date.parse(hariIni) - i * HARI).toISOString().slice(0, 10),
    detik: [24, 18, 0, 31, 22, 9, 45][i % 7] * 60 + 3 * 3600 * (i === 59 ? 1 : 0),
  }));
  return susunKartu({ hariIni, waktu, aktivitas: [], streak: 13, level: "N2", sesiLabel: "Desember 2026", tesTotal: [104, 115], nama: pakaiNama ? "yusuf" : null });
}
