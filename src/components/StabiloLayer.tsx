"use client";

import { useEffect, useRef } from "react";

/* Coretan stabilo freehand. Koordinat dinormalisasi ke lebar canvas
   (x & y dibagi cssWidth) biar skala-nya seragam & ikut responsif. `w`
   juga normalized. `c` = warna rgba. */
export interface HiStroke {
  c: string;
  w: number;
  pts: number[]; // flattened [x0,y0,x1,y1,...]
  t?: number;    // timestamp commit — buat undo global (urutan antar-kartu)
}

/* Palet coret — sengaja tanpa oren (warna brand) biar gak ketuker.
   Gaya pensil: tipis & cukup pekat, jadi enak buat garis-bawah / lingkarin. */
export const STABILO_COLORS = [
  { key: "kuning", rgba: "rgba(253, 224, 71, 0.88)" },
  { key: "hijau",  rgba: "rgba(52, 211, 153, 0.88)" },
  { key: "pink",   rgba: "rgba(244, 114, 182, 0.88)" },
  { key: "biru",   rgba: "rgba(96, 165, 250, 0.88)" },
];
export const STABILO_PX = 4; // tebal coretan (px logical, sebelum dinormalisasi) — tipis kayak pensil

/* Overlay canvas buat coret-coret stabilo freehand di atas teks bacaan.
   Strokes disimpan ternormalisasi (lihat HiStroke) jadi tetap nyangkut
   walau card di-resize / responsive. */
export function StabiloLayer({
  strokes, active, color, onCommit,
}: {
  strokes: HiStroke[];
  active: boolean;
  color: string;
  onCommit: (s: HiStroke) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing   = useRef(false);
  const cur       = useRef<number[]>([]);
  const cssSize   = useRef({ w: 0, h: 0 });
  // Mirror props ke ref biar callback ResizeObserver (yang dibuat sekali pas
  // mount) selalu baca data terbaru, bukan closure stale.
  const strokesRef = useRef(strokes); strokesRef.current = strokes;
  const colorRef   = useRef(color);   colorRef.current   = color;

  const drawOne = (ctx: CanvasRenderingContext2D, s: HiStroke, cssW: number) => {
    const p = s.pts;
    if (p.length < 2) return;
    ctx.strokeStyle = s.c;
    ctx.lineWidth   = Math.max(2, s.w * cssW);
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    if (p.length === 2) {
      // tap tunggal → titik bulat
      ctx.beginPath();
      ctx.arc(p[0] * cssW, p[1] * cssW, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = s.c;
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(p[0] * cssW, p[1] * cssW);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] * cssW, p[i + 1] * cssW);
    ctx.stroke();
  };

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w: cssW } = cssSize.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);
    for (const s of strokesRef.current) drawOne(ctx, s, cssW);
    if (cur.current.length) drawOne(ctx, { c: colorRef.current, w: STABILO_PX / cssW, pts: cur.current }, cssW);
  };

  // Sinkronkan ukuran backing-store canvas ke ukuran tampil + redraw.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const sync = () => {
      const r = parent.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dpr = window.devicePixelRatio || 1;
      cssSize.current = { w: r.width, h: r.height };
      canvas.width  = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      redraw();
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(parent);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw tiap strokes/warna berubah.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { redraw(); }, [strokes, color]);

  const pt = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    const w = r.width || 1;
    return [(e.clientX - r.left) / w, (e.clientY - r.top) / w];
  };

  const onDown = (e: React.PointerEvent) => {
    if (!active) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drawing.current = true;
    cur.current = pt(e);
    redraw();
  };
  const onMove = (e: React.PointerEvent) => {
    if (!active || !drawing.current) return;
    const [x, y] = pt(e);
    cur.current.push(x, y);
    redraw();
  };
  const onUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const pts = cur.current;
    cur.current = [];
    if (pts.length >= 2) onCommit({ c: color, w: STABILO_PX / (cssSize.current.w || 1), pts, t: Date.now() });
    redraw();
  };

  return (
    <canvas
      ref={canvasRef}
      className={`stabilo-canvas${active ? " active" : ""}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
    />
  );
}
