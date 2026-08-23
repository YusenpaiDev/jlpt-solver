"use client";

import { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import bunpouN1 from "@/data/bunpou/N1.json";
import bunpouN2 from "@/data/bunpou/N2.json";
import bunpouN3 from "@/data/bunpou/N3.json";
import bunpouN4 from "@/data/bunpou/N4.json";
import bunpouN5 from "@/data/bunpou/N5.json";

interface Ex { jp: string; highlight: string; id: string; }
interface Pattern {
  id: string; pattern: string; meaning: string; level: string;
  functionGroup: string; setsuzoku: string[]; nuance: string;
  examples: Ex[]; confusableWith: string[]; discriminator: string; quickTip: string;
}
interface Grp { key: string; name: string; jp: string; }
interface Deck { level: string; count: number; groups: Grp[]; patterns: Pattern[]; }
const DECKS: Record<string, Deck> = {
  N5: bunpouN5 as Deck, N4: bunpouN4 as Deck, N3: bunpouN3 as Deck, N2: bunpouN2 as Deck, N1: bunpouN1 as Deck,
};

type Prog = { benar: number; salah: number };
type State = "known" | "seen" | "wrong" | "new";
function statOf(pattern: string, progres: Map<string, Prog>): State {
  const p = progres.get(pattern);
  if (!p || p.benar + p.salah === 0) return "new";
  if (p.salah >= 2 && p.salah > p.benar) return "wrong";
  if (p.benar >= 3 && p.benar > p.salah) return "known";
  return "seen";
}

function shuffle<T>(a: T[]): T[] { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

interface Opt { gm: string; st: string[]; d: string; }
interface KilatQ {
  patternStr: string; groupName: string; groupJp: string; status: State;
  why: string; ask: string; pre: string; post: string; tr: string;
  opts: Opt[]; ans: number;
  correctDisc: string; tip: string;
  mini: { gm: string; d: string; self: boolean }[] | null;
}

function buildQuestions(pats: Pattern[], all: Pattern[], byId: Map<string, Pattern>, groups: Grp[], progres: Map<string, Prog>, count: number): KilatQ[] {
  const gmap = new Map(groups.map(g => [g.key, g]));
  const drillable = pats.filter(p => p.examples[0]?.jp && p.examples[0]?.highlight && p.examples[0].jp.includes(p.examples[0].highlight));
  // prioritas: wrong > seen > new (Latihan Kilat = remedial dulu)
  const rank = (p: Pattern) => { const s = statOf(p.pattern, progres); return s === "wrong" ? 0 : s === "seen" ? 1 : s === "new" ? 2 : 3; };
  const ordered = shuffle(drillable).sort((a, b) => rank(a) - rank(b));
  const out: KilatQ[] = [];
  for (const p of ordered) {
    if (out.length >= count) break;
    const ex = p.examples[0];
    const idx = ex.jp.indexOf(ex.highlight);
    const pre = ex.jp.slice(0, idx), post = ex.jp.slice(idx + ex.highlight.length);
    // distraktor: confusableWith → grup sama → acak
    const distractPats: Pattern[] = [];
    for (const cid of p.confusableWith) { const o = byId.get(cid); if (o) distractPats.push(o); }
    if (distractPats.length < 3) for (const o of all) { if (o.functionGroup === p.functionGroup && o.pattern !== p.pattern && !distractPats.some(x => x.pattern === o.pattern)) distractPats.push(o); if (distractPats.length >= 6) break; }
    if (distractPats.length < 3) for (const o of all) { if (o.pattern !== p.pattern && !distractPats.some(x => x.pattern === o.pattern)) distractPats.push(o); if (distractPats.length >= 6) break; }
    const distract = shuffle(distractPats).slice(0, 3);
    if (distract.length < 3) continue;
    const optPats = shuffle([p, ...distract]);
    const opts: Opt[] = optPats.map(o => ({ gm: o.pattern, st: o.setsuzoku.slice(0, 2), d: o.discriminator }));
    const ans = optPats.findIndex(o => o.pattern === p.pattern);
    const g = gmap.get(p.functionGroup);
    const status = statOf(p.pattern, progres);
    const pg = progres.get(p.pattern);
    const why = status === "wrong" ? `Muncul karena kamu <b>salah ${pg?.salah ?? 0}×</b> di pola ini`
      : status === "seen" ? `Pernah muncul — ayo mantapin`
      : status === "known" ? `Udah dikuasai — jaga biar nggak lupa`
      : `Pola baru buat kamu`;
    const mini = p.confusableWith.length
      ? [{ gm: p.pattern, d: p.discriminator, self: true }, ...distract.filter(d => p.confusableWith.some(c => byId.get(c)?.pattern === d.pattern)).slice(0, 2).map(d => ({ gm: d.pattern, d: d.discriminator, self: false }))]
      : null;
    out.push({
      patternStr: p.pattern, groupName: g?.name ?? "", groupJp: g?.jp ?? "", status,
      why, ask: "Pilih pola yang tepat untuk mengisi bagian kosong.", pre, post, tr: ex.id,
      opts, ans, correctDisc: p.discriminator, tip: p.quickTip,
      mini,
    });
  }
  return out;
}

function KilatPlayer() {
  const params = useSearchParams();
  const router = useRouter();
  const level = (params.get("level") || "N2").toUpperCase();
  const group = params.get("group");
  const item = params.get("item");
  const count = Math.min(20, Math.max(1, Number(params.get("count")) || (item ? 5 : 10)));
  const deck = DECKS[level] ?? DECKS.N2;

  const [qs, setQs] = useState<KilatQ[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [streak, setStreak] = useState(0);
  const [ok, setOk] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [xp, setXp] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [log, setLog] = useState<{ gm: string; correct: boolean; note: string; streak: number }[]>([]);
  const [starred, setStarred] = useState(false);
  const [done, setDone] = useState(false);
  const [saved, setSaved] = useState(false);

  // Bangun soal di effect (Math.random aman di luar render)
  useEffect(() => {
    const byId = new Map(deck.patterns.map(p => [p.id, p]));
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      let progres = new Map<string, Prog>();
      if (user) {
        const { data } = await supabase.from("bunpou_progress").select("pattern, benar, salah").eq("user_id", user.id);
        if (data) progres = new Map(data.map(r => [r.pattern, { benar: r.benar ?? 0, salah: r.salah ?? 0 }]));
      }
      let pats = deck.patterns;
      if (group) pats = pats.filter(p => p.functionGroup === group);
      else if (item) { const it = byId.get(item); pats = it ? [it, ...it.confusableWith.map(c => byId.get(c)).filter(Boolean) as Pattern[]] : deck.patterns; }
      setQs(buildQuestions(pats, deck.patterns, byId, deck.groups, progres, count));
    }
    init();
  }, [level, group, item, count, deck]);

  const q = qs && !done ? qs[idx] : null;

  const pick = useCallback((n: number) => { if (locked || !q || n >= q.opts.length) return; setSel(n); }, [locked, q]);

  const submit = useCallback(() => {
    if (locked || sel === null || !q) return;
    setLocked(true);
    const correct = sel === q.ans;
    setResults(r => [...r, correct]);
    if (correct) { setOk(o => o + 1); setStreak(s => s + 1); setXp(x => x + 8); }
    else { setWrong(w => w + 1); setStreak(0); setXp(x => x + 2); }
    setLog(l => {
      const prevStreak = l.filter(e => e.gm === q.opts[q.ans].gm && e.correct).length;
      const s = correct ? prevStreak + 1 : 0;
      const note = correct
        ? (s >= 3 ? `Benar — streak ${s}×, naik jadi dikuasai` : s === 1 ? "Benar — pertama kali di sesi ini" : `Benar — ${s}× berturut`)
        : `Kamu pilih ${q.opts[sel].gm} — ${q.opts[sel].d.toLowerCase()}`;
      return [...l, { gm: q.opts[q.ans].gm, correct, note, streak: s }];
    });
  }, [locked, sel, q]);

  const next = useCallback(() => {
    if (!qs) return;
    if (idx + 1 >= qs.length) { setDone(true); return; }
    setIdx(i => i + 1); setSel(null); setLocked(false); setStarred(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [qs, idx]);

  // Simpan hasil pas selesai
  useEffect(() => {
    if (!done || saved || !qs) return;
    setSaved(true);
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        // akumulasi benar/salah per pola
        const acc = new Map<string, { b: number; s: number }>();
        log.forEach(r => { const c = acc.get(r.gm) ?? { b: 0, s: 0 }; if (r.correct) c.b++; else c.s++; acc.set(r.gm, c); });
        for (const [pattern, c] of acc) {
          const { data } = await supabase.from("bunpou_progress").select("benar, salah").eq("user_id", user.id).eq("pattern", pattern).maybeSingle();
          await supabase.from("bunpou_progress").upsert({ user_id: user.id, pattern, benar: (data?.benar ?? 0) + c.b, salah: (data?.salah ?? 0) + c.s }, { onConflict: "user_id,pattern" });
        }
        // XP
        const { data: prof } = await supabase.from("profiles").select("xp").eq("id", user.id).single();
        await supabase.from("profiles").update({ xp: (prof?.xp ?? 0) + xp }).eq("id", user.id);
        // Entry Riwayat
        await supabase.from("sessions").insert({ user_id: user.id, level, category: "Drill 文法", title: `Drill Bunpou ${level} — ${qs.length} soal`, total: qs.length, score: ok });
      } catch { /* biarin */ }
    })();
  }, [done, saved, qs, log, xp, ok, level]);

  // keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (done) return;
      if (["1", "2", "3", "4"].includes(e.key)) pick(+e.key - 1);
      if (e.key === "Enter") { locked ? next() : submit(); }
      if (e.key === "Escape") router.push("/materi/bunpou");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [done, locked, pick, next, submit, router]);

  const KEYS = ["A", "B", "C", "D"];
  const pct = qs && qs.length ? Math.round((ok / qs.length) * 100) : 0;

  if (!qs) return <div className="lk-load">Menyiapkan soal…</div>;
  if (!qs.length) return (
    <div className="lk-load">
      <p>Belum cukup contoh kalimat buat bikin soal di sini.</p>
      <button className="btn btn-g" onClick={() => router.push("/materi/bunpou")}>← Kembali ke Bunpou</button>
    </div>
  );

  if (done) {
    const wrongPats = [...new Set(log.filter(r => !r.correct).map(r => r.gm))];
    const lastByGm = new Map<string, { gm: string; correct: boolean; streak: number }>();
    log.forEach(r => lastByGm.set(r.gm, r));
    const mastered = [...lastByGm.values()].filter(r => r.correct && r.streak >= 3);
    return (
      <div className="latihan-kilat">
        <div className="sum on">
          <div className="sum-hero">
            <div className="sum-jp">お疲れ様</div>
            <h1 className="sum-h">{wrongPats.length ? "Latihan kilat selesai" : "Semua benar 🎉"}</h1>
            <p className="sum-p">{qs.length} soal · Bunpou {level}</p>
          </div>
          <div className="sum-stats">
            <div className="sst"><div className="sst-n" style={{ color: "var(--success2)" }}>{ok}</div><div className="sst-l">Benar</div></div>
            <div className="sst"><div className="sst-n" style={{ color: "var(--danger2)" }}>{wrong}</div><div className="sst-l">Salah</div></div>
            <div className="sst"><div className="sst-n" style={{ color: "var(--warning)" }}>+{xp}</div><div className="sst-l">XP</div></div>
            <div className="sst"><div className="sst-n">{pct}%</div><div className="sst-l">Akurasi</div></div>
          </div>
          <div className="sum-grid">
            <div className="scard">
              <div className="scard-h">Rekap jawaban <span className="r" style={{ color: wrongPats.length ? "var(--danger2)" : "var(--success2)" }}>{wrongPats.length ? `${wrongPats.length} pola perlu diulang` : "Semua benar 🎉"}</span></div>
              {log.map((r, n) => (
                <div className="rrow" key={n}>
                  <span className={`rmark ${r.correct ? "rm-ok" : "rm-no"}`}>{r.correct ? "✓" : "✕"}</span>
                  <span className="rgm">{r.gm}</span>
                  <span className="rnote">{r.note}</span>
                </div>
              ))}
            </div>
            <div>
              {mastered.length > 0 && (
                <div className="scard mast" style={{ marginBottom: 16 }}>
                  <div className="scard-h" style={{ color: "var(--success2)" }}>Naik jadi dikuasai 🎉</div>
                  {mastered.map((r, n) => <div className="mast-i" key={n}><span className="mast-gm">{r.gm}</span><span className="mast-arrow">streak <b>{r.streak}×</b> → dikuasai</span></div>)}
                </div>
              )}
              <div className="scard">
                <div className="scard-h">Jadwal ulang berikutnya</div>
                {[...lastByGm.values()].map((r, n) => {
                  let when = "3 hari", col = "var(--warning)";
                  if (!r.correct) { when = "besok"; col = "var(--danger2)"; }
                  else if (r.streak >= 3) { when = "21 hari"; col = "var(--success2)"; }
                  else if (r.streak === 2) { when = "7 hari"; col = "var(--warning)"; }
                  return <div className="srs-i" key={n}><span className="srs-d" style={{ background: col }} /><b>{r.gm}</b><span className="srs-when">{when}</span></div>;
                })}
              </div>
            </div>
          </div>
          <div className="sum-act">
            {wrongPats.length > 0
              ? <button className="btn btn-p" onClick={() => { const it = deck.patterns.find(p => p.pattern === wrongPats[0]); router.push(`/latihan/kilat?level=${level}${it ? `&item=${it.id}` : ""}&count=${Math.max(5, wrongPats.length)}`); }}>⚡ Drill {wrongPats.length} pola yang salah</button>
              : <button className="btn btn-p" onClick={() => router.push(`/latihan/kilat?level=${level}`)}>⚡ Sesi lagi</button>}
            <button className="btn btn-g" onClick={() => router.push("/materi/bunpou")}>Kembali ke Bunpou</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="latihan-kilat">
      <div className="top">
        <div className="top-in">
          <div className="tt"><span className="tt-jp">文法</span><span className="tt-l">Latihan Kilat</span><span className="tt-lv">{level}</span></div>
          <div className="dots">
            {Array.from({ length: qs.length }, (_, n) => {
              let c = "dt";
              if (n < results.length) c += results[n] ? " ok" : " no";
              else if (n === idx) c += " now";
              return <span className={c} key={n} />;
            })}
          </div>
          <div className="top-right">
            <span className="tcount">{idx + 1} <span className="s">/ {qs.length}</span></span>
            <span className="tstreak">🔥 {streak} benar berturut</span>
            <button className="tx" title="Keluar" onClick={() => router.push("/materi/bunpou")}>✕</button>
          </div>
        </div>
      </div>

      {q && (
        <div className="stage">
          <div className="qmeta">
            {q.status === "wrong" && <span className="qtag qt-weak">⚠️ SERING SALAH</span>}
            <span className="qtag qt-fn">{q.groupJp} · {q.groupName.toUpperCase()}</span>
            <span className="why" dangerouslySetInnerHTML={{ __html: q.why }} />
          </div>

          <div className="qcard">
            <div className="qask">{q.ask}</div>
            <div className="sent">
              {q.pre}
              <span className={`blank${sel !== null && !locked ? " filled" : ""}${locked ? (sel === q.ans ? " ok" : " no") : ""}`}>
                {sel !== null ? q.opts[sel].gm : "＿＿"}
              </span>
              {q.post}
            </div>
            <div className={`sent-tr${locked ? " show" : ""}`}>{q.tr}</div>

            <div className="opts">
              {q.opts.map((o, n) => {
                let cls = "opt";
                if (!locked && sel === n) cls += " sel";
                if (locked) { cls += " locked"; if (n === q.ans) cls += " correct"; else if (n === sel) cls += " wrong"; else cls += " dim"; }
                return (
                  <button className={cls} key={n} onClick={() => pick(n)}>
                    <span className="opt-k">{KEYS[n]}</span>
                    <span className="opt-b"><span className="opt-gm">{o.gm}</span><span className="opt-st">{o.st.map(s => <span className="schip" key={s}>{s}</span>)}</span></span>
                    <span className="opt-mark">{locked ? (n === q.ans ? "✓" : n === sel ? "✕" : "") : ""}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {locked && (
            <div className={`fb on ${sel === q.ans ? "good" : "bad"}`}>
              <div className="fb-head">
                <span className="fb-ic">{sel === q.ans ? "✓" : "✕"}</span>
                <span className="fb-t">{sel === q.ans ? "Tepat" : "Belum tepat"}</span>
                <span className="fb-xp">{sel === q.ans ? `+8 XP · streak ${streak}×` : "+2 XP · streak reset"}</span>
              </div>
              <div className="fb-body">
                <div className="cue">
                  <span className="lbl">{sel === q.ans ? "Kenapa benar" : "Kenapa salah"}</span>
                  {sel === q.ans
                    ? <>Betul. <span className="pk-ok">{q.opts[q.ans].gm}</span> — {q.correctDisc}</>
                    : <>Kamu pilih <span className="pk">{q.opts[sel!].gm}</span> ({q.opts[sel!].d.toLowerCase()}). Jawabannya <span className="pk-ok">{q.opts[q.ans].gm}</span> — {q.correctDisc}</>}
                </div>
                {q.tip && <div className="tip"><span className="lbl2">Cara cepat inget</span>{q.tip}</div>}
                {q.mini && (
                  <div className="mini">
                    {q.mini.map((m, n) => {
                      const cls = m.self ? "self" : (sel !== q.ans && m.gm === q.opts[sel!].gm ? "picked" : "");
                      return <div className={`mini-i ${cls}`} key={n}><div className="mini-gm">{m.gm}{m.self ? <span className="mini-tag">JAWABAN</span> : cls === "picked" ? <span className="mini-tag">PILIHANMU</span> : null}</div><div className="mini-d">{m.d}</div></div>;
                    })}
                  </div>
                )}
                <div className="fb-act">
                  <button className="btn btn-p" onClick={next}>{idx + 1 >= qs.length ? "Lihat hasil →" : "Lanjut →"}</button>
                  <button className={`btn-star${starred ? " on" : ""}`} onClick={() => setStarred(s => !s)}>{starred ? "★ Ditandai" : "☆ Tandai pola ini"}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!locked && (
        <div className="subbar">
          <div className="subbar-in">
            <div className="kbd-hint">
              <span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> Pilih</span>
              <span><kbd>Enter</kbd> Jawab</span>
              <span><kbd>Esc</kbd> Keluar</span>
            </div>
            <button className="btn btn-p" onClick={submit} disabled={sel === null}>Jawab</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="lk-load">Memuat…</div>}><KilatPlayer /></Suspense>;
}
