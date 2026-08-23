"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import kotobaN1 from "@/data/kotoba/N1.json";
import kotobaN2 from "@/data/kotoba/N2.json";
import kotobaN3 from "@/data/kotoba/N3.json";
import kotobaN4 from "@/data/kotoba/N4.json";
import kotobaN5 from "@/data/kotoba/N5.json";

interface Word { word: string; reading: string; meaning: string; group: string; example?: string; example_id?: string; pos?: string; jlpt_level?: string; }
interface Deck { level: string; vocabulary: Word[]; }
const DECKS: Record<string, Deck> = { N5: kotobaN5 as Deck, N4: kotobaN4 as Deck, N3: kotobaN3 as Deck, N2: kotobaN2 as Deck, N1: kotobaN1 as Deck };

type Prog = { benar: number; salah: number };
type State = "known" | "seen" | "wrong" | "new";
function statOf(word: string, progres: Map<string, Prog>): State {
  const p = progres.get(word);
  if (!p || p.benar + p.salah === 0) return "new";
  if (p.salah >= 2 && p.salah > p.benar) return "wrong";
  if (p.benar >= 3 && p.benar > p.salah) return "known";
  return "seen";
}
function shuffle<T>(a: T[]): T[] { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* romaji ringkas (hiragana → latin) */
const KR: Record<string, string> = { あ:"a",い:"i",う:"u",え:"e",お:"o",か:"ka",き:"ki",く:"ku",け:"ke",こ:"ko",が:"ga",ぎ:"gi",ぐ:"gu",げ:"ge",ご:"go",さ:"sa",し:"shi",す:"su",せ:"se",そ:"so",ざ:"za",じ:"ji",ず:"zu",ぜ:"ze",ぞ:"zo",た:"ta",ち:"chi",つ:"tsu",て:"te",と:"to",だ:"da",ぢ:"ji",づ:"zu",で:"de",ど:"do",な:"na",に:"ni",ぬ:"nu",ね:"ne",の:"no",は:"ha",ひ:"hi",ふ:"fu",へ:"he",ほ:"ho",ば:"ba",び:"bi",ぶ:"bu",べ:"be",ぼ:"bo",ぱ:"pa",ぴ:"pi",ぷ:"pu",ぺ:"pe",ぽ:"po",ま:"ma",み:"mi",む:"mu",め:"me",も:"mo",や:"ya",ゆ:"yu",よ:"yo",ら:"ra",り:"ri",る:"ru",れ:"re",ろ:"ro",わ:"wa",を:"o",ん:"n",ー:"" };
const KY: Record<string, string> = { きゃ:"kya",きゅ:"kyu",きょ:"kyo",しゃ:"sha",しゅ:"shu",しょ:"sho",ちゃ:"cha",ちゅ:"chu",ちょ:"cho",にゃ:"nya",にゅ:"nyu",にょ:"nyo",ひゃ:"hya",ひゅ:"hyu",ひょ:"hyo",みゃ:"mya",みゅ:"myu",みょ:"myo",りゃ:"rya",りゅ:"ryu",りょ:"ryo",ぎゃ:"gya",ぎゅ:"gyu",ぎょ:"gyo",じゃ:"ja",じゅ:"ju",じょ:"jo",びゃ:"bya",びゅ:"byu",びょ:"byo",ぴゃ:"pya",ぴゅ:"pyu",ぴょ:"pyo" };
function romaji(k: string): string { let o = "", i = 0; while (i < k.length) { const t = k.slice(i, i + 2); if (KY[t]) { o += KY[t]; i += 2; continue; } const c = k[i]; if (c === "っ") { const r = KY[k.slice(i + 1, i + 3)] || KR[k[i + 1]] || ""; if (r) o += r[0]; i++; continue; } o += KR[c] ?? c; i++; } return o; }
const hasKanji = (s: string) => /[一-龿]/.test(s);

type QType = "jp2id" | "reading" | "id2jp";
interface KOpt { m: string; s: string; }
interface KQ {
  type: QType; word: string; groupTag: string; status: State; why: string; ask: string;
  jp: string; read: string; rom: string; id: string; jpOpt: boolean;
  opts: KOpt[]; ans: number; cue: string; cueWrongPrefix: string; correctMeaning: string;
  exJp?: string; exTr?: string; exHl?: string;
}

const ASK: Record<QType, string> = { jp2id: "Apa arti kata ini?", reading: "Gimana cara baca kata ini?", id2jp: "Kata mana yang artinya seperti ini?" };

function buildQuestions(pool: Word[], all: Word[], progres: Map<string, Prog>, count: number): KQ[] {
  const rank = (w: Word) => { const s = statOf(w.word, progres); return s === "wrong" ? 0 : s === "seen" ? 1 : s === "new" ? 2 : 3; };
  const usable = pool.filter(w => w.word && w.meaning && w.reading);
  const ordered = shuffle(usable).sort((a, b) => rank(a) - rank(b));
  const out: KQ[] = [];
  let ti = 0;
  for (const w of ordered) {
    if (out.length >= count) break;
    // tipe: rotasi; reading cuma buat kata ber-kanji
    let type: QType = (["jp2id", "reading", "id2jp"] as QType[])[ti % 3];
    if (type === "reading" && !hasKanji(w.word)) type = "jp2id";
    ti++;
    // distraktor: grup sama dulu, lalu acak
    const others = shuffle(all.filter(o => o.word !== w.word && o.meaning && o.reading));
    const sameGrp = others.filter(o => o.group === w.group);
    const distractPool = [...sameGrp, ...others];
    const seen = new Set([w.word]);
    const distract: Word[] = [];
    for (const o of distractPool) { if (distract.length >= 3) break; if (seen.has(o.word)) continue; if (type === "reading" && o.reading === w.reading) continue; seen.add(o.word); distract.push(o); }
    if (distract.length < 3) continue;
    const status = statOf(w.word, progres);
    const pg = progres.get(w.word);
    const why = status === "wrong" ? `Muncul karena kamu <b>salah ${pg?.salah ?? 0}×</b>` : status === "seen" ? "Pernah muncul — mantapin" : status === "known" ? "Udah dikuasai — jaga" : "Kata baru buat kamu";
    let opts: KOpt[], ans: number, cue: string, jpOpt: boolean;
    if (type === "jp2id") {
      const pack = shuffle([w, ...distract]);
      opts = pack.map(o => ({ m: o.meaning, s: o.word }));
      ans = pack.findIndex(o => o.word === w.word);
      cue = `Betul. <span class="pk-ok">${w.word}</span> = ${w.meaning}.`;
      jpOpt = false;
    } else if (type === "reading") {
      const pack = shuffle([w, ...distract]);
      opts = pack.map(o => ({ m: o.reading, s: romaji(o.reading) }));
      ans = pack.findIndex(o => o.word === w.word);
      cue = `Betul. <span class="pk-ok">${w.word}</span> dibaca <b>${w.reading}</b>.`;
      jpOpt = true;
    } else {
      const pack = shuffle([w, ...distract]);
      opts = pack.map(o => ({ m: o.word, s: o.reading }));
      ans = pack.findIndex(o => o.word === w.word);
      cue = `Betul. "${w.meaning}" = <span class="pk-ok">${w.word}</span> (${w.reading}).`;
      jpOpt = true;
    }
    out.push({
      type, word: w.word, groupTag: w.group, status, why, ask: ASK[type],
      jp: w.word, read: w.reading, rom: romaji(w.reading), id: w.meaning, jpOpt,
      opts, ans, cue, cueWrongPrefix: "Kamu pilih kata lain.", correctMeaning: w.meaning,
      exJp: w.example, exTr: w.example_id, exHl: w.word,
    });
  }
  return out;
}

function KotobaPlayer() {
  const params = useSearchParams();
  const router = useRouter();
  const level = (params.get("level") || "N2").toUpperCase();
  const group = params.get("group");
  const count = Math.min(20, Math.max(1, Number(params.get("count")) || 10));
  const deck = DECKS[level] ?? DECKS.N2;

  const [qs, setQs] = useState<KQ[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [streak, setStreak] = useState(0);
  const [ok, setOk] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [xp, setXp] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [log, setLog] = useState<{ word: string; correct: boolean; note: string; streak: number }[]>([]);
  const [starred, setStarred] = useState(false);
  const [done, setDone] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      let progres = new Map<string, Prog>();
      if (user) {
        const { data } = await supabase.from("kotoba_progress").select("word, benar, salah").eq("user_id", user.id);
        if (data) progres = new Map(data.map(r => [r.word, { benar: r.benar ?? 0, salah: r.salah ?? 0 }]));
      }
      let pool = deck.vocabulary;
      if (group) pool = pool.filter(w => w.group === group);
      setQs(buildQuestions(pool, deck.vocabulary, progres, count));
    }
    init();
  }, [level, group, count, deck]);

  const q = qs && !done ? qs[idx] : null;
  const pick = useCallback((n: number) => { if (locked || !q || n >= q.opts.length) return; setSel(n); }, [locked, q]);
  const submit = useCallback(() => {
    if (locked || sel === null || !q) return;
    setLocked(true);
    const correct = sel === q.ans;
    setResults(r => [...r, correct]);
    if (correct) { setOk(o => o + 1); setStreak(s => s + 1); setXp(x => x + 8); } else { setWrong(w => w + 1); setStreak(0); setXp(x => x + 2); }
    setLog(l => {
      const prevStreak = l.filter(e => e.word === q.word && e.correct).length;
      const s = correct ? prevStreak + 1 : 0;
      const note = correct ? (s >= 3 ? `Benar — streak ${s}×, naik jadi dikuasai` : s === 1 ? "Benar — pertama kali di sesi ini" : `Benar — ${s}× berturut`) : `Belum tepat — arti/baca ketuker`;
      return [...l, { word: q.word, correct, note, streak: s }];
    });
    (async () => { try { await createClient().rpc("catat_kotoba", { p_word: q.word, p_benar: correct }); } catch { /* nyusul */ } })();
  }, [locked, sel, q]);
  const next = useCallback(() => { if (!qs) return; if (idx + 1 >= qs.length) { setDone(true); return; } setIdx(i => i + 1); setSel(null); setLocked(false); setStarred(false); window.scrollTo({ top: 0, behavior: "smooth" }); }, [qs, idx]);

  useEffect(() => {
    if (!done || saved || !qs) return; setSaved(true);
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: prof } = await supabase.from("profiles").select("xp").eq("id", user.id).single();
        await supabase.from("profiles").update({ xp: (prof?.xp ?? 0) + xp }).eq("id", user.id);
        await supabase.from("sessions").insert({ user_id: user.id, level, category: "Drill 語彙", title: `Drill Kotoba ${level} — ${qs.length} kata`, total: qs.length, score: ok });
      } catch { /* biarin */ }
    })();
  }, [done, saved, qs, xp, ok, level]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (done) return; if (["1", "2", "3", "4"].includes(e.key)) pick(+e.key - 1); if (e.key === "Enter") { locked ? next() : submit(); } if (e.key === "Escape") router.push("/materi/kotoba"); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [done, locked, pick, next, submit, router]);

  const KEYS = ["A", "B", "C", "D"];
  const pct = qs && qs.length ? Math.round((ok / qs.length) * 100) : 0;

  if (!qs) return <div className="lk-load">Menyiapkan soal…</div>;
  if (!qs.length) return <div className="lk-load"><p>Belum cukup kata buat bikin soal.</p><button className="btn btn-g" onClick={() => router.push("/materi/kotoba")}>← Kembali ke Kotoba</button></div>;

  if (done) {
    const wrongWords = [...new Set(log.filter(r => !r.correct).map(r => r.word))];
    const lastByW = new Map<string, { word: string; correct: boolean; streak: number }>();
    log.forEach(r => lastByW.set(r.word, r));
    const mastered = [...lastByW.values()].filter(r => r.correct && r.streak >= 3);
    return (
      <div className="latihan-kilat">
        <div className="sum on">
          <div className="sum-hero"><div className="sum-jp">お疲れ様</div><h1 className="sum-h">{wrongWords.length ? "Latihan kilat selesai" : "Semua benar 🎉"}</h1><p className="sum-p">{qs.length} kata · Kotoba {level}</p></div>
          <div className="sum-stats">
            <div className="sst"><div className="sst-n" style={{ color: "var(--success2)" }}>{ok}</div><div className="sst-l">Benar</div></div>
            <div className="sst"><div className="sst-n" style={{ color: "var(--danger2)" }}>{wrong}</div><div className="sst-l">Salah</div></div>
            <div className="sst"><div className="sst-n" style={{ color: "var(--warning)" }}>+{xp}</div><div className="sst-l">XP</div></div>
            <div className="sst"><div className="sst-n">{pct}%</div><div className="sst-l">Akurasi</div></div>
          </div>
          <div className="sum-grid">
            <div className="scard">
              <div className="scard-h">Rekap jawaban <span className="r" style={{ color: wrongWords.length ? "var(--danger2)" : "var(--success2)" }}>{wrongWords.length ? `${wrongWords.length} kata perlu diulang` : "Semua benar 🎉"}</span></div>
              {log.map((r, n) => (<div className="rrow" key={n}><span className={`rmark ${r.correct ? "rm-ok" : "rm-no"}`}>{r.correct ? "✓" : "✕"}</span><span className="rgm">{r.word}</span><span className="rnote">{r.note}</span></div>))}
            </div>
            <div>
              {mastered.length > 0 && (<div className="scard mast" style={{ marginBottom: 16 }}><div className="scard-h" style={{ color: "var(--success2)" }}>Naik jadi dikuasai 🎉</div>{mastered.map((r, n) => <div className="mast-i" key={n}><span className="mast-gm">{r.word}</span><span className="mast-arrow">streak <b>{r.streak}×</b> → dikuasai</span></div>)}</div>)}
              <div className="scard"><div className="scard-h">Jadwal ulang berikutnya</div>{[...lastByW.values()].map((r, n) => { let when = "3 hari", col = "var(--warning)"; if (!r.correct) { when = "besok"; col = "var(--danger2)"; } else if (r.streak >= 3) { when = "21 hari"; col = "var(--success2)"; } else if (r.streak === 2) { when = "7 hari"; col = "var(--warning)"; } return <div className="srs-i" key={n}><span className="srs-d" style={{ background: col }} /><b>{r.word}</b><span className="srs-when">{when}</span></div>; })}</div>
            </div>
          </div>
          <div className="sum-act">
            {wrongWords.length > 0 ? <button className="btn btn-p" onClick={() => router.push(`/latihan/kotoba?level=${level}&count=${Math.max(5, wrongWords.length)}`)}>⚡ Ulangi sesi</button> : <button className="btn btn-p" onClick={() => router.push(`/latihan/kotoba?level=${level}`)}>⚡ Sesi lagi</button>}
            <button className="btn btn-g" onClick={() => router.push("/materi/kotoba")}>Kembali ke Kotoba</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="latihan-kilat">
      <div className="top">
        <div className="top-in">
          <div className="tt"><span className="tt-jp">語彙</span><span className="tt-l">Latihan Kilat</span><span className="tt-lv">{level}</span></div>
          <div className="dots">{Array.from({ length: qs.length }, (_, n) => { let c = "dt"; if (n < results.length) c += results[n] ? " ok" : " no"; else if (n === idx) c += " now"; return <span className={c} key={n} />; })}</div>
          <div className="top-right"><span className="tcount">{idx + 1} <span className="s">/ {qs.length}</span></span><span className="tstreak">🔥 {streak} benar berturut</span><button className="tx" title="Keluar" onClick={() => router.push("/materi/kotoba")}>✕</button></div>
        </div>
      </div>

      {q && (
        <div className="stage">
          <div className="qmeta">
            {q.status === "wrong" && <span className="qtag qt-weak">⚠️ SERING SALAH</span>}
            <span className="qtag qt-fn">{q.groupTag}</span>
            <span className="why" dangerouslySetInnerHTML={{ __html: q.why }} />
          </div>
          <div className="qcard">
            <div className="qask">{q.ask}</div>
            <div className="prompt">
              {q.type === "id2jp"
                ? <div className="pr-id">{q.id}</div>
                : <>
                    <div className="pr-jp">{q.jp}</div>
                    {q.type === "jp2id" && <div className={`pr-read${locked ? " show" : ""}`}>{q.read}<span className="rom">{q.rom}</span></div>}
                  </>}
            </div>
            <div className="opts">
              {q.opts.map((o, n) => {
                let cls = "opt";
                if (!locked && sel === n) cls += " sel";
                if (locked) { cls += " locked"; if (n === q.ans) cls += " correct"; else if (n === sel) cls += " wrong"; else cls += " dim"; }
                return (<button className={cls} key={n} onClick={() => pick(n)}>
                  <span className="opt-k">{KEYS[n]}</span>
                  <span className="opt-b"><span className={`opt-main${q.jpOpt ? " jp" : ""}`}>{o.m}</span><span className="opt-sub">{o.s}</span></span>
                  <span className="opt-mark">{locked ? (n === q.ans ? "✓" : n === sel ? "✕" : "") : ""}</span>
                </button>);
              })}
            </div>
          </div>

          {locked && (
            <div className={`fb on ${sel === q.ans ? "good" : "bad"}`}>
              <div className="fb-head"><span className="fb-ic">{sel === q.ans ? "✓" : "✕"}</span><span className="fb-t">{sel === q.ans ? "Tepat" : "Belum tepat"}</span><span className="fb-xp">{sel === q.ans ? `+8 XP · streak ${streak}×` : "+2 XP · streak reset"}</span></div>
              <div className="fb-body">
                <div className="cue"><span className="lbl">{sel === q.ans ? "Kenapa benar" : "Kenapa salah"}</span>
                  {sel === q.ans ? <span dangerouslySetInnerHTML={{ __html: q.cue }} /> : <>Kamu pilih kata lain. Jawabannya <span className="pk-ok">{q.word}</span> — {q.correctMeaning} ({q.read}).</>}
                </div>
                {q.exJp && <div className="ex"><span className="lbl2">Contoh kalimat</span>{q.exHl && q.exJp.includes(q.exHl) ? <>{q.exJp.split(q.exHl)[0]}<span className="hl">{q.exHl}</span>{q.exJp.split(q.exHl).slice(1).join(q.exHl)}</> : q.exJp}{q.exTr && <span className="tr">{q.exTr}</span>}</div>}
                <div className="fb-act"><button className="btn btn-p" onClick={next}>{idx + 1 >= qs.length ? "Lihat hasil →" : "Lanjut →"}</button><button className={`btn-star${starred ? " on" : ""}`} onClick={() => setStarred(s => !s)}>{starred ? "★ Ditandai" : "☆ Tandai kata ini"}</button></div>
              </div>
            </div>
          )}
        </div>
      )}

      {!locked && (
        <div className="subbar"><div className="subbar-in"><div className="kbd-hint"><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> Pilih</span><span><kbd>Enter</kbd> Jawab</span><span><kbd>Esc</kbd> Keluar</span></div><button className="btn btn-p" onClick={submit} disabled={sel === null}>Jawab</button></div></div>
      )}
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="lk-load">Memuat…</div>}><KotobaPlayer /></Suspense>;
}
