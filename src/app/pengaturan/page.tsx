"use client";

/* Pengaturan v2 (handoff-pengaturan/Pengaturan v2.html). Tiap kontrol nyambung
   ke data beneran; yang belum ada tampil "Sedang disiapkan" tanpa tombol aktif.
   Dibuang dari versi lama (dulu cuma tampilan): bio, bahasa antarmuka, fokus
   area, saklar leaderboard/teman/data AI, export PDF. */

import "@/styles/rencana-dasar.css";
import "@/styles/rencana-pamer.css";
import "@/styles/rencana-janji.css";
import "@/styles/rencana-misi.css";
import "@/styles/alur.css";
import "@/styles/pengaturan.css";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  User, Zap, Wand2, Flame, GraduationCap, Bell, CreditCard, Shield, Trash2, ChevronRight, Camera,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuroraBackground, NavRail, BottomNav, UserBar, Breadcrumb } from "@/components/v2";
import { TombolKeluar } from "@/components/v2/TombolKeluar";
import { useUserStats } from "@/lib/use-user-stats";
import { useLangganan, tglPanjang, sisaHari as hitungSisa } from "@/lib/langganan";
import { useHonix } from "@/lib/use-honix";
import { tesSuaraHonix } from "@/lib/honix-sfx";
import { honixSrc } from "@/lib/honix-pose";
import { mulaiTur } from "@/lib/honix-tur";
import { bukaCaraBelajar } from "@/components/alur/CaraBelajar";
import { PasangPengingat } from "@/components/alur/PasangPengingat";
import { LabelDisiapkan } from "@/components/rencana/LabelDisiapkan";
import { JanjiBelajar } from "@/components/rencana/JanjiBelajar";
import { fiturLive } from "@/lib/kurikulum-config";
import { daftarSesiUjian, hariMenuju, labelSesi, rapikanTanggalUjian, type SesiUjian } from "@/lib/sesi-ujian";
import { LABEL as LABEL_JANJI, PACE, penilaianJanji } from "@/lib/janji-belajar";
import { tingkatPace } from "@/lib/misi-harian";
import { cekAlasan } from "@/lib/ganti-target";
import { PREF_AWAL, rapikanPref, type PrefAi } from "@/lib/preferensi-ai";
import { csvKamus, mdCatatan } from "@/lib/ekspor-data";
import { KATA_KONFIRMASI } from "@/lib/akun-data";
import { KUNCI_PAKAI } from "@/lib/kenalan";
import { DEV_BYPASS } from "@/lib/dev-materi";

type Level = "N1" | "N2" | "N3" | "N4" | "N5";
const LEVEL: Level[] = ["N5", "N4", "N3", "N2", "N1"];
const LVN: Record<Level, string> = { N5: "Pemula", N4: "Dasar", N3: "Menengah", N2: "Pra-mahir", N1: "Mahir" };

const BAGIAN = [
  { id: "profil", Icon: User, t: "Profil", s: "Info dasar tentang kamu" },
  { id: "target", Icon: Zap, t: "Target Belajar", s: "Level, sesi ujian, pace, dan janji belajar" },
  { id: "ai", Icon: Wand2, t: "Preferensi AI", s: "Cara Sensei AI jawab dan jelasin" },
  { id: "honix", Icon: Flame, t: "Honix", s: "Suara, kapan muncul, dan gerakan" },
  { id: "tutorial", Icon: GraduationCap, t: "Tutorial", s: "Cara belajar di Honix dan tur keliling app" },
  { id: "notif", Icon: Bell, t: "Notifikasi", s: "Pengingat belajar dan kabar langganan" },
  { id: "lang", Icon: CreditCard, t: "Langganan", s: "Paket dan masa aktif" },
  { id: "data", Icon: Shield, t: "Privasi & Data", s: "Export data, dokumen, dan bantuan" },
  { id: "danger", Icon: Trash2, t: "Danger Zone", s: "Reset progres atau hapus akun" },
] as const;
type IdBagian = typeof BAGIAN[number]["id"];

/* Lama → baru, biar link lama (#target, ?bagian=) tetap kebuka di tempat yang bener. */
const ALIAS: Record<string, IdBagian> = { profile: "profil", sub: "lang", privacy: "data", notif: "notif" };
const bagianDari = (x: string | null): IdBagian | null => {
  if (!x) return null;
  const k = ALIAS[x] ?? x;
  return BAGIAN.some(b => b.id === k) ? (k as IdBagian) : null;
};

function unduh(nama: string, isi: string, tipe: string) {
  const url = URL.createObjectURL(new Blob([isi], { type: tipe }));
  const a = document.createElement("a");
  a.href = url; a.download = nama;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export default function Pengaturan() {
  const stats = useUserStats();
  const [bagian, setBagian] = useState<IdBagian>("profil");
  const [toast, setToast] = useState<string | null>(null);
  const kabari = (t: string) => { setToast(t); setTimeout(() => setToast(null), 2200); };

  /* Data akun */
  const [email, setEmail] = useState("");
  const [nama, setNama] = useState(""), [namaAwal, setNamaAwal] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [ujian, setUjian] = useState(""); // YYYY-MM-DD, "none", atau ""
  const [pace, setPace] = useState(20);
  const [pref, setPref] = useState<PrefAi>(PREF_AWAL), [prefAwal, setPrefAwal] = useState<PrefAi>(PREF_AWAL);
  const [sesi, setSesi] = useState<SesiUjian[]>([]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const awal = bagianDari(q.get("bagian")) ?? bagianDari(window.location.hash.slice(1));
    async function muat() {
      if (awal) setBagian(awal);
      setSesi(daftarSesiUjian(new Date()));
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        /* Dev tanpa login: data contoh biar semua bagian bisa dicek. */
        if (DEV_BYPASS) { setEmail("yusuf@contoh.id"); setNama("Yusuf"); setNamaAwal("Yusuf"); setLevel("N2"); setUjian("2026-12-06"); }
        return;
      }
      setEmail(user.email ?? "");
      const md = user.user_metadata ?? {};
      const { data: p } = await supabase.from("profiles").select("username, target_level, avatar_url").eq("id", user.id).single();
      setNama(p?.username ?? ""); setNamaAwal(p?.username ?? "");
      setAvatarUrl(p?.avatar_url ?? null);
      setLevel(((md.target_level ?? p?.target_level) as Level) ?? "N3");
      setUjian(md.exam_date === "none" ? "none" : rapikanTanggalUjian(md.exam_date) ?? "");
      if (typeof md.daily_goal_minutes === "number") setPace(md.daily_goal_minutes);
      const pr = rapikanPref(md.ai_pref); setPref(pr); setPrefAwal(pr);
    }
    void muat();
  }, []);

  const simpanMeta = async (data: Record<string, unknown>) => {
    const { error } = await createClient().auth.updateUser({ data });
    if (error) { kabari("Gagal nyimpen. Coba lagi."); return false; }
    kabari("Tersimpan"); return true;
  };

  const B = BAGIAN.find(b => b.id === bagian)!;
  const isi: Record<IdBagian, React.ReactNode> = {
    profil: <Profil nama={nama} setNama={setNama} namaAwal={namaAwal} setNamaAwal={setNamaAwal} email={email} avatarUrl={avatarUrl} setAvatarUrl={setAvatarUrl} kabari={kabari} />,
    target: <Target level={level} setLevel={setLevel} ujian={ujian} setUjian={setUjian} pace={pace} setPace={setPace} sesi={sesi} simpanMeta={simpanMeta} kabari={kabari} />,
    ai: <PrefSensei pref={pref} setPref={setPref} prefAwal={prefAwal} level={level}
      onSimpan={async () => { if (await simpanMeta({ ai_pref: pref })) setPrefAwal(pref); }} />,
    honix: <HonixSetelan />,
    tutorial: <Tutorial kabari={kabari} />,
    notif: <Notif pace={pace} kabari={kabari} />,
    lang: <Langganan />,
    data: <Data kabari={kabari} />,
    danger: <Bahaya kabari={kabari} />,
  };

  return (
    <>
      <AuroraBackground />
      <NavRail />
      <BottomNav />
      <main className="app-shell">
        <UserBar streakDays={stats.streak} xp={stats.xp} xpTarget={stats.xpTarget} avatarLetter={stats.initial} isPro={stats.isPro} />
        <Breadcrumb items={[{ label: "Beranda", href: "/" }, { label: "Pengaturan" }]} />
        <div className="rbk">
          <div className="head"><div>
            <h1 className="h1">Pengaturan<span className="jp-g" lang="ja">設定</span></h1>
            <p className="sub">Atur profil, target belajar, Honix, dan langganan kamu.</p>
          </div></div>
          <div className="pg">
            <nav className="pgm card" aria-label="Bagian pengaturan">
              {BAGIAN.map(b => (
                <button key={b.id} type="button" className={`${b.id === bagian ? "on" : ""}${b.id === "danger" ? " dz" : ""}`}
                  aria-current={b.id === bagian} onClick={() => { setBagian(b.id); history.replaceState(null, "", `/pengaturan?bagian=${b.id}`); }}>
                  <b.Icon size={18} strokeWidth={1.7} aria-hidden="true" /><span>{b.t}</span>
                  {b.id === bagian && <i className="ch"><ChevronRight size={16} aria-hidden="true" /></i>}
                </button>
              ))}
            </nav>
            <section className={`card pgp${bagian === "danger" ? " dzp" : ""}`} aria-labelledby="pgp-t">
              <h2 id="pgp-t">{B.t}</h2>
              <p className="pgp-s">{B.s}</p>
              {isi[bagian]}
            </section>
          </div>
          {/* HP gak punya menu "Lainnya" lagi — Keluar di sini. */}
          <TombolKeluar className="btn btn-g m-out" />
          {toast && <div className="al-toast" role="status">{toast}</div>}
        </div>
      </main>
    </>
  );
}

const Baris = ({ t, d, kanan, cls = "" }: { t: React.ReactNode; d?: React.ReactNode; kanan?: React.ReactNode; cls?: string }) => (
  <div className={`row ${cls}`}><span><b>{t}</b>{d && <small>{d}</small>}</span>{kanan}</div>
);
const Saklar = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button type="button" className={`sw${on ? " on" : ""}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />
);
function Seg<T extends string>({ opsi, nilai, onChange, label }: { opsi: [T, string][]; nilai: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {opsi.map(([v, t]) => <button key={v} type="button" className={v === nilai ? "on" : ""} aria-pressed={v === nilai} onClick={() => onChange(v)}>{t}</button>)}
    </div>
  );
}
const SimpanBar = ({ ubah, onBatal, onSimpan, sibuk }: { ubah: boolean; onBatal: () => void; onSimpan: () => void; sibuk?: boolean }) => (
  <div className="pg-save">
    <button type="button" className="btn btn-q" onClick={onBatal} disabled={!ubah || sibuk}>Batal</button>
    <button type="button" className="btn btn-p" onClick={onSimpan} disabled={!ubah || sibuk}>{sibuk ? "Nyimpen…" : "Simpan perubahan"}</button>
  </div>
);

/* ── Profil ── */
function Profil({ nama, setNama, namaAwal, setNamaAwal, email, avatarUrl, setAvatarUrl, kabari }: {
  nama: string; setNama: (s: string) => void; namaAwal: string; setNamaAwal: (s: string) => void;
  email: string; avatarUrl: string | null; setAvatarUrl: (s: string) => void; kabari: (t: string) => void;
}) {
  const berkas = useRef<HTMLInputElement>(null);
  const [sibuk, setSibuk] = useState(false);

  const gantiFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\/(jpeg|png)$/.test(f.type)) { kabari("Fotonya harus JPG atau PNG."); return; }
    if (f.size > 2 * 1024 * 1024) { kabari("Fotonya kegedean, maks 2 MB."); return; }
    setSibuk(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const path = `${user.id}/avatar.${f.type === "image/png" ? "png" : "jpg"}`;
      const { error } = await supabase.storage.from("avatars").upload(path, f, { upsert: true });
      if (error) kabari("Gagal upload foto.");
      else {
        const url = `${supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl}?t=${Date.now()}`;
        const { error: e2 } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
        if (e2) kabari("Foto ke-upload tapi gagal disimpan."); else { setAvatarUrl(url); kabari("Foto diganti"); }
      }
    }
    setSibuk(false);
  };

  const simpan = async () => {
    setSibuk(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = user ? await supabase.from("profiles").update({ username: nama.trim() }).eq("id", user.id) : { error: true };
    setSibuk(false);
    if (error) kabari("Gagal nyimpen. Coba lagi."); else { setNamaAwal(nama.trim()); kabari("Tersimpan"); }
  };

  return (
    <>
      <div className="pf-ph">
        <span className={`ava${avatarUrl ? "" : " hxa"}`} style={{ width: 76, height: 76 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- foto user / PNG Honix */}
          <img src={avatarUrl ?? honixSrc("kepala")} alt="Foto profil" />
        </span>
        <div>
          <button type="button" className="btn btn-g sm" onClick={() => berkas.current?.click()} disabled={sibuk}><Camera size={15} aria-hidden="true" /> Ganti foto</button>
          <small>JPG / PNG · maks 2 MB</small>
          <input ref={berkas} type="file" accept="image/jpeg,image/png" onChange={gantiFoto} />
        </div>
      </div>
      <label className="fld"><span>Nama tampilan</span><input value={nama} maxLength={40} onChange={e => setNama(e.target.value)} /></label>
      <label className="fld"><span>Email <em>· buat login, gak bisa diubah di sini</em></span><input value={email} readOnly /></label>
      <SimpanBar ubah={nama.trim() !== namaAwal && nama.trim().length > 0} sibuk={sibuk} onBatal={() => setNama(namaAwal)} onSimpan={simpan} />
    </>
  );
}

/* ── Target belajar ── */
function Target({ level, setLevel, ujian, setUjian, pace, setPace, sesi, simpanMeta, kabari }: {
  level: Level | null; setLevel: (l: Level) => void; ujian: string; setUjian: (s: string) => void;
  pace: number; setPace: (n: number) => void; sesi: SesiUjian[];
  simpanMeta: (d: Record<string, unknown>) => Promise<boolean>; kabari: (t: string) => void;
}) {
  const [ganti, setGanti] = useState(false);
  const [janji, setJanji] = useState(false);
  const [kini] = useState(() => new Date());
  const lv = level ?? "N3";
  const P = PACE.find(p => tingkatPace(p.m) === tingkatPace(pace)) ?? PACE[1];
  const hari = ujian && ujian !== "none" ? hariMenuju(ujian, kini) : null;
  const v = penilaianJanji(lv, hari, pace);

  return (
    <>
      <div className="tg3 card2">
        <div className="tgt">
          <span>Level target <span className="lock">Dikunci</span></span>
          <b>{level ?? "…"}</b>
          <small>Biar fokus, level lain gak ditampilin.</small>
          <button type="button" className="btn btn-g" onClick={() => setGanti(true)} disabled={!level}>Ganti target</button>
        </div>
        <div className="tgt">
          <span>Sesi ujian</span>
          <b>{ujian && ujian !== "none" ? labelSesi(ujian) : "Belum nentuin"}</b>
          <small>{hari != null ? `${new Date(`${ujian}T00:00:00`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${Math.ceil(hari / 7)} minggu lagi` : "Pilih biar Honix bisa ngitung jadwal"}</small>
          <select className="sel-s" aria-label="Ubah sesi ujian" value={ujian || ""}
            onChange={async e => { const u = e.target.value; setUjian(u); await simpanMeta({ exam_date: u === "none" ? "none" : u }); }}>
            <option value="" disabled>Ubah sesi…</option>
            {sesi.map(s => <option key={s.iso} value={s.iso}>{s.label} · {s.hari} hari lagi</option>)}
            {ujian && ujian !== "none" && !sesi.some(s => s.iso === ujian) && <option value={ujian}>{labelSesi(ujian)} (pilihan lama)</option>}
            <option value="none">Belum tau / cuma belajar dulu</option>
          </select>
        </div>
        <div className="tgt">
          <span>Pace harian</span>
          <b>{P.t} · {P.m} menit</b>
          <div className="pace3" role="group" aria-label="Pace harian">
            {PACE.map(p => (
              <button key={p.m} type="button" className={p.m === P.m ? "on" : ""} aria-pressed={p.m === P.m}
                onClick={async () => { setPace(p.m); if (await simpanMeta({ daily_goal_minutes: p.m })) kabari(`Pace diganti ke ${p.t} · ${p.m} menit`); }}>{p.m} mnt</button>
            ))}
          </div>
        </div>
      </div>
      <div className="rows">
        <Baris cls="wrap" t="Janji belajar"
          d={v ? <>Hitungan terakhir: <span className={`vt v-${v.v}`} style={{ padding: "1px 8px" }}>{LABEL_JANJI[v.v][0]}</span> · ikut berubah kalau sesi atau pace diganti</> : "Pilih sesi ujian dulu biar bisa dihitung"}
          kanan={<button type="button" className="btn btn-g" onClick={() => setJanji(j => !j)}>{janji ? "Tutup" : "Lihat janji"}</button>} />
        {janji && (
          <div style={{ paddingBottom: 16 }}>
            <JanjiBelajar level={lv} ujian={ujian} pace={pace} sesi={sesi}
              onUbah={async (u, m) => { setUjian(u); setPace(m); await simpanMeta({ exam_date: u, daily_goal_minutes: m }); }} />
          </div>
        )}
        <Baris cls="wrap" t={<>Tes penempatan{!fiturLive("penempatan") && <LabelDisiapkan />}</>} d="Titik mulai kurikulum, biar gak ngulang yang udah kamu bisa"
          kanan={fiturLive("penempatan") ? <Link className="btn btn-g" href="/penempatan">Ulangi tes</Link> : undefined} />
      </div>
      {ganti && level && <GantiTarget level={level} onTutup={() => setGanti(false)}
        onBerhasil={async ke => {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) await supabase.from("profiles").update({ target_level: ke }).eq("id", user.id);
          await createClient().auth.updateUser({ data: { target_level: ke } });
          setLevel(ke); setGanti(false); kabari(`Target diganti ke ${ke}`);
        }} />}
    </>
  );
}

const ALASAN = ["Udah lulus level ini", "Kesusahan, mau turun dulu", "Kegampangan", "Ganti rencana ujian", "Lainnya"];

function GantiTarget({ level, onTutup, onBerhasil }: { level: Level; onTutup: () => void; onBerhasil: (ke: Level) => Promise<void> }) {
  const [ke, setKe] = useState<Level | null>(null);
  const [kenapa, setKenapa] = useState<string | null>(null);
  const [lain, setLain] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const alasan = kenapa === "Lainnya" ? `Lainnya: ${lain.trim()}` : kenapa ?? "";
  const ok = ke && ke !== level && kenapa && (kenapa !== "Lainnya" || lain.trim().length >= 3);

  const kirim = async () => {
    const cek = cekAlasan(alasan);
    if (!ke || !cek.ok) { setGalat(cek.ok ? null : cek.pesan); return; }
    setSibuk(true); setGalat(null);
    const res = await fetch("/api/target/ganti", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ke, alasan: cek.alasan }) }).catch(() => null);
    if (!res?.ok) {
      const j = await res?.json().catch(() => null) as { pesan?: string } | null;
      setGalat(j?.pesan ?? "Belum bisa diganti. Coba lagi sebentar."); setSibuk(false); return;
    }
    await onBerhasil(ke);
  };

  return (
    <Lembar label="Ganti level target" onTutup={onTutup}>
      <h2>Ganti level target</h2>
      <p>Level dikunci biar kamu fokus. Ganti kalau memang perlu.</p>
      <div className="lvp5">
        {LEVEL.map(l => (
          <button key={l} type="button" className={`${l === level ? "cur" : ""}${l === ke ? " sel" : ""}`} disabled={l === level} aria-pressed={l === ke} onClick={() => setKe(l)}>
            {l}<small>{l === level ? "sekarang" : LVN[l]}</small>
          </button>
        ))}
      </div>
      <div className="gt-l">Kenapa ganti? (wajib)</div>
      <div className="opts">
        {ALASAN.map(a => <button key={a} type="button" className={`chip${kenapa === a ? " sel" : ""}`} aria-pressed={kenapa === a} onClick={() => setKenapa(a)}>{a}</button>)}
      </div>
      {kenapa === "Lainnya" && <input className="cfm" style={{ letterSpacing: 0 }} maxLength={200} placeholder="Ceritain singkat…" value={lain} onChange={e => setLain(e.target.value)} />}
      {ke && ke !== level && (
        <div className="gt-info">
          {fiturLive("kurikulum") ? <>Kurikulum {ke} mulai dari minggu 1 (atau ikut tes penempatan {ke}). </> : <>Materi, misi, dan soal ikut ganti ke {ke}. </>}
          <b>Progres {level}-mu tetap tersimpan</b> dan kebuka lagi kalau balik ke {level}.
        </div>
      )}
      {galat && <p className="err" role="alert">{galat}</p>}
      <div className="sh-a">
        <button type="button" className="btn btn-p" onClick={kirim} disabled={!ok || sibuk}>{sibuk ? "Nyimpen…" : `Ganti ke ${ke && ke !== level ? ke : "…"}`}</button>
        <button type="button" className="btn btn-q" onClick={onTutup}>Batal</button>
      </div>
    </Lembar>
  );
}

/* ── Preferensi AI ── */
function PrefSensei({ pref, setPref, prefAwal, level, onSimpan }: { pref: PrefAi; setPref: (p: PrefAi) => void; prefAwal: PrefAi; level: Level | null; onSimpan: () => void }) {
  const ubah = JSON.stringify(pref) !== JSON.stringify(prefAwal);
  return (
    <>
      <div className="rows">
        <Baris cls="wrap" t="Gaya jawaban Sensei" d="Singkat buat cepat, lengkap kalau mau penjelasan tata bahasa"
          kanan={<Seg label="Gaya jawaban" nilai={pref.gaya} onChange={g => setPref({ ...pref, gaya: g })} opsi={[["singkat", "Singkat"], ["lengkap", "Lengkap"]]} />} />
        <Baris t="Contoh kalimat" d="Tambahin contoh kalimat di tiap penjelasan"
          kanan={<Saklar label="Contoh kalimat" on={pref.contoh} onChange={c => setPref({ ...pref, contoh: c })} />} />
        <Baris cls="wrap" t="Furigana di jawaban" d="Kanji di atas level targetmu dikasih cara baca"
          kanan={<Seg label="Furigana di jawaban" nilai={pref.furigana} onChange={f => setPref({ ...pref, furigana: f })} opsi={[["atas", `Di atas ${level ?? "level"}`], ["semua", "Semua"], ["mati", "Mati"]]} />} />
      </div>
      <SimpanBar ubah={ubah} onBatal={() => setPref(prefAwal)} onSimpan={onSimpan} />
    </>
  );
}

/* ── Honix ── (simpan langsung, sama kayak dulu) */
function HonixSetelan() {
  const { setelan, ubah } = useHonix();
  return (
    <div className="rows">
      <Baris t="Suara Honix" d="“Ting” saat benar, chime saat naik tingkat"
        kanan={<span className="aksi"><button type="button" className="btn btn-q" onClick={tesSuaraHonix}>▶ Tes</button><Saklar label="Suara Honix" on={setelan.suara} onChange={s => ubah({ suara: s })} /></span>} />
      <Baris cls="wrap" t="Honix muncul" d="Di momen penting: misi selesai, hasil tes, naik tingkat"
        kanan={<Seg label="Honix muncul" nilai={setelan.reaksi} onChange={r => ubah({ reaksi: r })} opsi={[["normal", "Muncul"], ["jarang", "Jarang"], ["mati", "Mati"]]} />} />
      <Baris cls="wrap" t="Gerakan & animasi" d="Ikut pengaturan HP/laptop kalau gak dipilih"
        kanan={<Seg label="Gerakan & animasi" nilai={setelan.gerakan === "kurangi" ? "kurangi" : "sistem"} onChange={g => ubah({ gerakan: g === "kurangi" ? "kurangi" : null })} opsi={[["sistem", "Ikut sistem"], ["kurangi", "Kurangi"]]} />} />
    </div>
  );
}

/* ── Tutorial ── */
function Tutorial({ kabari }: { kabari: (t: string) => void }) {
  const { setelan, ubah } = useHonix();
  const dilihat = Object.keys(setelan.tur.halaman).filter(k => k.startsWith("kenalan:")).length;
  const tampilLagi = () => {
    const halaman = Object.fromEntries(Object.entries(setelan.tur.halaman).filter(([k]) => !k.startsWith("kenalan:")));
    ubah({ tur: { ...setelan.tur, halaman } });
    try { localStorage.removeItem(KUNCI_PAKAI); } catch { /* mode privat */ }
    kabari("Penjelasan pertama kali bakal muncul lagi");
  };
  return (
    <div className="rows">
      <Baris t="Cara belajar di Honix" d="5 tahap dari belajar sampai ujian, versi singkat" kanan={<button type="button" className="btn btn-g" onClick={bukaCaraBelajar}>Buka</button>} />
      <Baris t="Tur Honix" d="7 langkah keliling app, ±1 menit" kanan={<button type="button" className="btn btn-g" onClick={mulaiTur}>Mulai tur</button>} />
      <Baris cls="wrap" t="Penjelasan pertama kali" d={`${dilihat} dari 5 udah kamu lihat · muncul sekali per fitur`}
        kanan={<button type="button" className="btn btn-g" onClick={tampilLagi} disabled={!dilihat}>Tampilkan lagi</button>} />
    </div>
  );
}

/* ── Notifikasi ── (yang beneran jalan + "Sedang disiapkan") */
function Notif({ pace, kabari }: { pace: number; kabari: (t: string) => void }) {
  const l = useLangganan();
  return (
    <div className="rows">
      <PasangPengingat menit={pace} />
      <Baris t="Email langganan" d="Kabar sebelum masa aktif Premium habis"
        kanan={<Saklar label="Email langganan" on={l.pengingat} onChange={async v => { if (await l.setPengingat(v)) kabari("Tersimpan"); else kabari("Gagal nyimpen. Coba lagi."); }} />} />
      <Baris t="Di dalam app · selalu nyala" d="Lonceng & banner Beranda: streak mau putus, tes mini mingguan, ujian makin dekat, latihan mandek" />
      <Baris t={<>Pengingat misi harian via email<LabelDisiapkan /></>} d="Cuma kalau misi hari itu belum dimulai, maks sekali sehari" />
      <Baris t={<>Ulangan Senin & simulasi bulanan<LabelDisiapkan /></>} d="Kabar pas ulangan siap & H-1 jadwal simulasi" />
      <Baris t={<>Push notification HP<LabelDisiapkan /></>} d="Sementara pakai pengingat kalender di atas" />
    </div>
  );
}

/* ── Langganan ── */
function Langganan() {
  const l = useLangganan();
  const [kini] = useState(() => Date.now());
  if (!l.loaded) return <p className="note">Memuat…</p>;
  const trial = l.akses.status === "trial";
  const habis = l.akses.status === "expired";
  const sisa = l.isPro && !l.isLifetime ? hitungSisa(l.premiumUntil, kini) : trial ? hitungSisa(l.akses.trialUntil, kini) : null;
  const nama = l.isLifetime ? "Lifetime" : l.isPro ? "Premium" : trial ? "Percobaan 7 hari" : "Masa percobaan habis";
  const chip: [string, string] = l.isPro || l.isLifetime ? ["Aktif", "var(--success)"] : trial ? ["Percobaan", "var(--warning)"] : ["Habis", "var(--danger)"];
  const isiBar = trial && sisa != null ? Math.max(4, (sisa / 7) * 100) : l.isPro && sisa != null ? Math.min(100, Math.max(4, (sisa / 365) * 100)) : 0;
  return (
    <>
      <div className="sub-c card2">
        <div>
          <b className="sub-pl">{nama}<span className="chip" style={{ color: chip[1], borderColor: "currentColor" }}>{chip[0]}</span></b>
          {!l.isLifetime && !habis && <div className="mbar"><i style={{ width: `${isiBar}%`, background: "linear-gradient(90deg,#6B8E3F,var(--success))", boxShadow: "none" }} /></div>}
          <small>
            {l.isLifetime ? "Akses penuh selamanya, gak ada perpanjangan."
              : l.isPro && l.premiumUntil ? <>Aktif sampai <b style={{ color: "var(--text)" }}>{tglPanjang(l.premiumUntil)}</b>{sisa != null ? ` · sisa ${sisa} hari` : ""} · <b style={{ color: "var(--text)" }}>gak menagih otomatis</b></>
              : trial && l.akses.trialUntil ? <>Semua fitur kebuka sampai <b style={{ color: "var(--text)" }}>{tglPanjang(l.akses.trialUntil)}</b>{sisa != null ? ` · sisa ${sisa} hari` : ""}</>
              : "Semua isi tetap kelihatan, tapi latihan digembok. Lanjut dengan Premium."}
          </small>
        </div>
        <div className="sub-a">
          {!l.isLifetime && <Link className="btn btn-p" href="/premium">{l.isPro ? "Perpanjang" : "Lihat Premium"}</Link>}
          <Link className="btn btn-q" href="/langganan">Riwayat pembayaran</Link>
        </div>
      </div>
      <p className="note">
        {l.isPro && !l.isLifetime ? "Perpanjang sebelum habis, sisa masa aktifmu ikut ditambahkan. " : ""}
        Selama paket aktif, Sensei AI & furigana tanpa batas harian.
      </p>
    </>
  );
}

/* ── Privasi & Data ── */
function Data({ kabari }: { kabari: (t: string) => void }) {
  const [sibuk, setSibuk] = useState<string | null>(null);
  const ekspor = async (jenis: "kamus" | "catatan") => {
    setSibuk(jenis);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSibuk(null); return; }
    if (jenis === "kamus") {
      const { data, error } = await supabase.from("saved_words").select("kanji, reading, meaning, level, favorite, created_at").eq("user_id", user.id).order("created_at");
      if (error) kabari("Gagal ngambil data Kamus.");
      else if (!data?.length) kabari("Kamus-mu masih kosong.");
      else { unduh("honix-kamus.csv", csvKamus(data), "text/csv;charset=utf-8"); kabari(`${data.length} kata diunduh`); }
    } else {
      const { data, error } = await supabase.from("catatan").select("judul, isi, source, created_at").eq("user_id", user.id).order("created_at");
      if (error) kabari("Gagal ngambil catatan.");
      else if (!data?.length) kabari("Belum ada catatan.");
      else { unduh("honix-catatan.md", mdCatatan(data), "text/markdown;charset=utf-8"); kabari(`${data.length} catatan diunduh`); }
    }
    setSibuk(null);
  };
  return (
    <div className="rows">
      <Baris t="Export kotoba" d="Semua kata di Kamus · CSV (kebuka di Excel/Sheets)"
        kanan={<button type="button" className="btn btn-g" onClick={() => ekspor("kamus")} disabled={sibuk !== null}>{sibuk === "kamus" ? "Nyiapin…" : "Unduh"}</button>} />
      <Baris t="Export catatan" d="Semua catatan · satu file Markdown"
        kanan={<button type="button" className="btn btn-g" onClick={() => ekspor("catatan")} disabled={sibuk !== null}>{sibuk === "catatan" ? "Nyiapin…" : "Unduh"}</button>} />
      <Baris cls="wrap" t="Dokumen" d="Cara kami nyimpen & makai datamu"
        kanan={<span className="aksi"><Link className="btn btn-q" href="/privasi">Kebijakan Privasi</Link><Link className="btn btn-q" href="/syarat">Syarat & Ketentuan</Link></span>} />
      <Baris cls="wrap" t={<>Bantuan<LabelDisiapkan /></>} d="Kontak resmi (email / komunitas) lagi disiapin" />
    </div>
  );
}

/* ── Danger Zone ── */
function Bahaya({ kabari }: { kabari: (t: string) => void }) {
  const [buka, setBuka] = useState<"reset" | "hapus" | null>(null);
  return (
    <>
      <div className="rows">
        <Baris cls="dz wrap" t="Reset progres" d="Hapus riwayat soal (termasuk set yang udah kamu buka dari Bank Soal), streak, kalender cap, dan status kata & pola. Kamus, catatan, XP, & langganan tetap aman."
          kanan={<button type="button" className="btn btn-d" onClick={() => setBuka("reset")}>Reset progres</button>} />
        <Baris cls="dz wrap" t="Hapus akun" d="Semua data hilang permanen. Langganan yang masih aktif ikut hangus."
          kanan={<button type="button" className="btn btn-d" onClick={() => setBuka("hapus")}>Hapus akun</button>} />
      </div>
      {buka && <Konfirmasi aksi={buka} onTutup={() => setBuka(null)}
        onBerhasil={() => {
          if (buka === "hapus") { window.location.href = "/login?pesan=akun-dihapus"; return; }
          setBuka(null); kabari("Progres direset"); setTimeout(() => window.location.reload(), 900);
        }} />}
    </>
  );
}

function Konfirmasi({ aksi, onTutup, onBerhasil }: { aksi: "reset" | "hapus"; onTutup: () => void; onBerhasil: () => void }) {
  const kata = KATA_KONFIRMASI[aksi];
  const [ketik, setKetik] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const hapus = aksi === "hapus";
  const jalan = async () => {
    setSibuk(true); setGalat(null);
    const res = await fetch(`/api/akun/${aksi}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ konfirmasi: ketik }) }).catch(() => null);
    if (res?.ok) { onBerhasil(); return; }
    const j = await res?.json().catch(() => null) as { pesan?: string } | null;
    setGalat(j?.pesan ?? "Belum berhasil. Coba lagi sebentar."); setSibuk(false);
  };
  return (
    <Lembar label={hapus ? "Hapus akun" : "Reset progres"} onTutup={onTutup}>
      <h2>{hapus ? "Hapus akun permanen?" : "Reset semua progres?"}</h2>
      <p>{hapus
        ? "Semua data, termasuk Kamus, catatan, riwayat, dan langganan aktif, hilang dan gak bisa dikembalikan."
        : "Riwayat soal, set yang udah kamu buka dari Bank Soal (bisa dibuka lagi dari awal), streak, kalender cap, dan status kata & pola dihapus. Kamus, catatan, XP, & langganan tetap aman. Gak bisa dibatalkan."}</p>
      <div className="gt-l">Ketik <b style={{ color: "var(--text)" }}>{kata}</b> buat lanjut</div>
      <input className="cfm" value={ketik} onChange={e => setKetik(e.target.value)} aria-label={`Ketik ${kata}`} autoComplete="off" />
      {galat && <p className="err" role="alert">{galat}</p>}
      <div className="sh-a">
        <button type="button" className="btn btn-d" onClick={jalan} disabled={ketik.trim().toUpperCase() !== kata || sibuk}>{sibuk ? "Memproses…" : hapus ? "Hapus akun" : "Reset progres"}</button>
        <button type="button" className="btn btn-q" onClick={onTutup} disabled={sibuk}>Batal</button>
      </div>
    </Lembar>
  );
}

/** Sheet (bottom sheet di HP) dengan Esc & klik luar buat tutup. */
function Lembar({ label, onTutup, children }: { label: string; onTutup: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onTutup(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onTutup]);
  return (
    <div className="ov" onClick={e => { if (e.target === e.currentTarget) onTutup(); }}>
      <div className="card sheet gt" role="dialog" aria-modal="true" aria-label={label}>{children}</div>
    </div>
  );
}
