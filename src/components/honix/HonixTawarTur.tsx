"use client";

import { useId } from "react";
import { createPortal } from "react-dom";
import { Honix } from "./Honix";
import { useHonix } from "@/lib/use-honix";

/** Tawaran bulanan di pojok — gak modal, gak nutup konten. */
export function HonixTawarTur({ onLihat, onNanti }: { onLihat: () => void; onNanti: () => void }) {
  const { kurangiGerak } = useHonix();
  const idJudul = useId();
  return createPortal(
    <div className={`hx hx-tawar${kurangiGerak ? " hx-rm" : ""}`} role="dialog" aria-labelledby={idJudul}>
      <Honix pose="tunjuk" size={64} sizeHp={52} entry="in-calm" idle="idle" alt="" />
      <div>
        <p id={idJudul} className="hx-tawar-t">Udah sebulan!</p>
        <p className="hx-tawar-s">Mau lihat lagi cara pakainya?</p>
        <div className="hx-tawar-aksi">
          <button type="button" className="hx-btn hx-btn-g" onClick={onNanti}>Nanti aja</button>
          <button type="button" className="hx-btn hx-btn-p" onClick={onLihat}>Lihat tur</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
