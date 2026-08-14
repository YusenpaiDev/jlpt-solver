"use client";

import { useId, useEffect, useState } from "react";
import { Sparkles, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface UserBarProps {
  streakDays: number;
  xp: number;
  xpTarget: number;
  avatarLetter: string;
  isPro?: boolean;
  onBellClick?: () => void;
  onAvatarClick?: () => void;
}

/**
 * Top user bar — streak + XP + (tablet+) PRO chip + bell + avatar.
 * PRO chip and bell auto-hide on mobile (<768px) via globals.css.
 *
 * Pass user data via props — this component is intentionally stateless so each
 * page can wire it to whatever data source it already uses.
 */
export function UserBar({
  streakDays,
  xp,
  xpTarget,
  avatarLetter,
  isPro = false,
  onAvatarClick,
}: UserBarProps) {
  const flameGradientId = useId();

  // Ambil foto profil + tanggal sesi terakhir (buat notif "streak hampir putus").
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [lastSessionDate, setLastSessionDate] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [readToday, setReadToday] = useState(true);

  const today = new Date().toISOString().slice(0, 10);
  const readKey = `sensei-notif-read-${today}`;

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: prof }, { data: sess }] = await Promise.all([
        supabase.from("profiles").select("avatar_url").eq("id", user.id).single(),
        supabase.from("sessions").select("created_at").eq("user_id", user.id)
          .order("created_at", { ascending: false }).limit(1),
      ]);
      if (!alive) return;
      if (prof?.avatar_url) setAvatarUrl(prof.avatar_url);
      if (sess?.[0]) setLastSessionDate(sess[0].created_at.slice(0, 10));
      setReadToday(typeof window !== "undefined" && !!localStorage.getItem(readKey));
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notifikasi dari data NYATA — saat ini: streak hampir putus.
  const studiedToday = lastSessionDate === today;
  const notifs: { id: string; icon: string; title: string; desc: string }[] = [];
  if (streakDays > 0 && !studiedToday) {
    notifs.push({
      id: "streak-danger",
      icon: "🔥",
      title: "Streak hampir putus!",
      desc: `Kamu belum latihan hari ini. Streak ${streakDays} hari bakal putus tengah malam.`,
    });
  }
  const showDot = notifs.length > 0 && !readToday;

  const openNotif = () => {
    setNotifOpen(o => !o);
    if (!readToday) {
      try { localStorage.setItem(readKey, "1"); } catch { /* ignore */ }
      setReadToday(true);
    }
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
            aria-label="Notifikasi"
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
                {notifs.length === 0 ? (
                  <div className="notif-empty">Belum ada notifikasi baru 🎉</div>
                ) : (
                  notifs.map(n => (
                    <div key={n.id} className="notif-item">
                      <span className="notif-ic">{n.icon}</span>
                      <div className="notif-body">
                        <div className="notif-t">{n.title}</div>
                        <div className="notif-d">{n.desc}</div>
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
