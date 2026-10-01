"use client";

import { useId, useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { usePeringatan } from "@/lib/peringatan";
import { useTandaHarian } from "@/lib/tanda-harian";

interface UserBarProps {
  streakDays: number;
  xp: number;
  xpTarget: number;
  avatarLetter: string;
  isPro?: boolean;
  onAvatarClick?: () => void;
}

/**
 * Top user bar — streak + XP + (tablet+) PRO chip + bell + avatar.
 * PRO chip and bell auto-hide on mobile (<768px) via globals.css.
 *
 * Angka streak/XP dateng lewat props — komponen ini sengaja stateless biar tiap
 * halaman nyambungin ke sumber yang udah dia punya. Isi loncengnya lain cerita:
 * itu dari usePeringatan(), satu-satunya tempat aturan peringatan ditulis, biar
 * lonceng dan banner Beranda gak beda isi.
 */

/* Titik merah ilang begitu dibuka, dan balik lagi kalau ada peringatan BARU —
   bukan sekadar "hari ini udah pernah buka". Versi sebelumnya nyimpen satu
   penanda per hari, jadi streak yang mau putus jam 9 malam gak ngasih sinyal
   apa-apa cuma gara-gara loncengnya sempat kebuka pagi-pagi. */
const KUNCI_DIBACA = "sensei-notif-dibaca";

export function UserBar({
  streakDays,
  xp,
  xpTarget,
  avatarLetter,
  isPro = false,
  onAvatarClick,
}: UserBarProps) {
  const flameGradientId = useId();
  const { semua, loaded } = usePeringatan();

  const { ids: dilihat, tandai } = useTandaHarian(KUNCI_DIBACA);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !alive) return;
      const { data: prof } = await supabase
        .from("profiles").select("avatar_url").eq("id", user.id).single();
      if (alive && prof?.avatar_url) setAvatarUrl(prof.avatar_url);
    })();
    return () => { alive = false; };
  }, []);

  /* Yang bikin titik nyala cuma yang perlu ditindaklanjuti. Perayaan streak
     (tingkat "info") tetap masuk daftar, tapi gak narik perhatian. */
  const perluDilihat = semua.filter(
    p => p.tingkat !== "info" && !dilihat.includes(p.id)
  );
  const showDot = loaded && perluDilihat.length > 0;

  const openNotif = () => {
    setNotifOpen(o => !o);
    if (perluDilihat.length > 0) tandai(semua.map(p => p.id));
  };

  return (
    <div className="af-userbar">
      <div className="af-userbar-left">
        <div className="streak-pill">
          <div className="streak-flame">
            <svg width="14" height="14" viewBox="0 0 24 24" fill={`url(#${flameGradientId})`} aria-hidden>
              <defs>
                <linearGradient id={flameGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#E8C57E" />
                  <stop offset="0.6" stopColor="#D4A04A" />
                  <stop offset="1" stopColor="#A4243B" />
                </linearGradient>
              </defs>
              <path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4-1 4 3 4 3 1 0-3-2-4 0-7z" />
            </svg>
          </div>
          <span className="streak-text">
            <span className="num">{streakDays}</span> hari streak
          </span>
        </div>
        <span className="xp-pill">
          <span className="xp-num">{xp}</span> / {xpTarget} XP
        </span>
      </div>

      <div className="af-userbar-right">
        {isPro && (
          <span className="pro-chip">
            <Sparkles size={11} strokeWidth={1.4} fill="currentColor" /> PRO
          </span>
        )}
        <div className="notif-wrap">
          <button
            type="button"
            className="icon-btn"
            aria-label={showDot ? `Notifikasi, ${perluDilihat.length} baru` : "Notifikasi"}
            onClick={openNotif}
          >
            <Bell size={16} />
            {showDot && <span className="dot" />}
          </button>
          {notifOpen && (
            <>
              <div className="notif-backdrop" onClick={() => setNotifOpen(false)} />
              <div className="notif-pop" role="dialog" aria-label="Notifikasi">
                <div className="notif-pop-head">Notifikasi</div>
                {semua.length === 0 ? (
                  <div className="notif-empty">
                    {loaded ? "Semua aman — gak ada yang perlu dikejar 🎉" : "Sebentar…"}
                  </div>
                ) : (
                  semua.map(n => (
                    <div key={n.id} className={`notif-item ${n.tingkat}`}>
                      <span className="notif-ic" aria-hidden>{n.ikon}</span>
                      <div className="notif-body">
                        <div className="notif-t">{n.judul}</div>
                        <div className="notif-d">{n.pesan}</div>
                        {n.aksi && (
                          <Link
                            href={n.aksi.href}
                            className="notif-aksi"
                            onClick={() => setNotifOpen(false)}
                          >
                            {n.aksi.label} →
                          </Link>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          className="avatar"
          aria-label="Akun"
          onClick={onAvatarClick}
        >
          {avatarUrl
            ? <img src={avatarUrl} alt="Foto profil" className="avatar-img" />
            : avatarLetter}
        </button>
      </div>
    </div>
  );
}
