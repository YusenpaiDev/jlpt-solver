import test from 'node:test';
import assert from 'node:assert/strict';
import { tingkatPace, rencanaMisi, langkahBerikut, statusBolong, urlLangkah, urlPenyelamat } from '../src/lib/misi-harian.ts';

const hari = (...xs) => new Map(xs.map(([t, menit, aktif = menit > 0]) => [t, { tanggal: t, menit, aktif, sumber: [] }]));

test('any saved pace maps onto the three onboarding levels', () => {
  assert.deepEqual([5, 10, 15, 20, 30, 40, 90].map(tingkatPace), ['santai', 'santai', 'santai', 'rutin', 'rutin', 'serius', 'serius']);
});

test('steps follow the handoff table per pace', () => {
  const r = rencanaMisi('rutin', { adaSalah: true });
  assert.deepEqual(r.map(l => [l.n, l.menit, l.jumlah]), [[1, 6, 12], [2, 7, 8], [3, 7, 10]]);
  assert.equal(r.reduce((n, l) => n + l.menit, 0), 20);
  assert.equal(r[0].dilewati, false);
});

test('nothing to review: step 1 is crossed out and its minutes move to steps 2 and 3', () => {
  const r = rencanaMisi('santai', { adaSalah: false });
  assert.equal(r[0].dilewati, true);
  assert.equal(r[0].isi, 'Semua kata & pola lagi aman');
  assert.deepEqual(r.map(l => l.menit), [0, 6, 4]); // 3 → ceil(1.5)=2 ke langkah 2, 1 ke langkah 3
});

test('"materinya susah" week: more review, fewer new words', () => {
  const r = rencanaMisi('serius', { adaSalah: true, lebihUlang: true });
  assert.equal(r[0].jumlah, 30);
  assert.equal(r[1].jumlah, 6);
});

test('next step skips a crossed-out step and stops after step 3', () => {
  const ada = rencanaMisi('rutin', { adaSalah: true });
  const gak = rencanaMisi('rutin', { adaSalah: false });
  assert.equal(langkahBerikut(ada, 0).n, 1);
  assert.equal(langkahBerikut(gak, 0).n, 2);
  assert.equal(langkahBerikut(ada, 2).n, 3);
  assert.equal(langkahBerikut(ada, 3), null);
});

test('missed days: one day → rescue, two or more → Honix asks', () => {
  const T = '2026-11-08';
  assert.deepEqual(statusBolong(hari(['2026-11-07', 20]), T), { jenis: null, terakhirAktif: '2026-11-07' });
  assert.deepEqual(statusBolong(hari(['2026-11-06', 20]), T), { jenis: 'p1', terakhirAktif: '2026-11-06' });
  assert.deepEqual(statusBolong(hari(['2026-11-03', 20]), T), { jenis: 'p2', terakhirAktif: '2026-11-03' });
  // udah belajar hari ini → gak ada misi penyelamat lagi
  assert.equal(statusBolong(hari(['2026-11-03', 20], [T, 5]), T).jenis, null);
  // aktivitas lama tanpa menit tetap dihitung belajar
  assert.equal(statusBolong(hari(['2026-11-07', 0, true]), T).jenis, null);
  // akun baru (belum pernah belajar) gak dianggap bolong
  assert.deepEqual(statusBolong(new Map(), T), { jenis: null, terakhirAktif: null });
  // tanggal setelah hari ini (jam beda zona) diabaikan
  assert.equal(statusBolong(hari(['2026-11-06', 20], ['2026-11-09', 10]), T).jenis, 'p1');
});

test('step links open the right player with the mission flag', () => {
  const r = rencanaMisi('rutin', { adaSalah: true });
  assert.equal(urlLangkah(r[0], { kata: 3, pola: 1 }), '/latihan/kotoba?mode=ulang&count=12&misi=1');
  assert.equal(urlLangkah(r[0], { kata: 0, pola: 4 }), '/latihan/kilat?mode=ulang&count=12&misi=1&teknik=lewat');
  assert.equal(urlLangkah(r[1], { kata: 0, pola: 0 }), '/latihan/kotoba?mode=baru&count=8&misi=2');
  assert.equal(urlLangkah(r[2], { kata: 0, pola: 0 }), '/latihan/kilat?count=10&misi=3');
  // jumlah soal dibatasi 20 (batas player)
  const banyak = rencanaMisi('serius', { adaSalah: true, lebihUlang: true });
  assert.match(urlLangkah(banyak[0], { kata: 9, pola: 0 }), /count=20&/);
});

test('rescue mission: 6 wrong words, else wrong patterns, else 6 words', () => {
  assert.equal(urlPenyelamat({ kata: 2, pola: 0 }), '/latihan/kotoba?mode=ulang&count=6&misi=penyelamat');
  assert.equal(urlPenyelamat({ kata: 0, pola: 2 }), '/latihan/kilat?mode=ulang&count=6&misi=penyelamat&teknik=lewat');
  assert.equal(urlPenyelamat({ kata: 0, pola: 0 }), '/latihan/kotoba?count=6&misi=penyelamat');
});
