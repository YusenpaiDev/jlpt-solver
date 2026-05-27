"use client";

import { useId } from "react";
import { Sparkles, Bell } from "lucide-react";

interface UserBarProps {
  streakDays: number;
  xp: number;
  xpTarget: number;
  avatarLetter: string;
  isPro?: boolean;
  hasUnread?: boolean;
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
  hasUnread = false,
  onBellClick,
  onAvatarClick,
}: UserBarProps) {
  const flameGradientId = useId();

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
        <button
          type="button"
          className="icon-btn"
          aria-label="Notifikasi"
          onClick={onBellClick}
        >
          <Bell size={16} />
          {hasUnread && <span className="dot" />}
        </button>
        <button
          type="button"
          className="avatar"
          aria-label="Akun"
          onClick={onAvatarClick}
        >
          {avatarLetter}
        </button>
      </div>
    </div>
  );
}
