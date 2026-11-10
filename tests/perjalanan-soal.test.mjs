import test from 'node:test';
import assert from 'node:assert/strict';
import { susunPerjalanan, berikutnya, ringkasan, cocokSaring, POS } from '../src/lib/perjalanan-soal.ts';
import { statusKata, statusPola, hitungEmpat, persenDimulai, persenDikuasai, namaKelompokKata } from '../src/lib/status-materi.ts';

const set = (title, section, o = {}) => ({ id: null, katalogId: 'k-' + title + section, level: 'N3', title, total: section === 'choukai' ? 11 : 75, score: null, section, created_at: null, ready: true, dijawab: 0, terakhir: null, ...o });

test('sets pair up by month, newest = Pos 01, names follow the journey', () => {
  const pos = susunPerjalanan([
    set('JLPT N3 2023年7月', 'hikki'), set('JLPT N3 2024年12月', 'choukai'),
    set('JLPT N3 2024年12月', 'hikki'), set('JLPT N3 2023年7月', 'choukai'),
  ]);
  assert.equal(pos.length, 2);
  assert.deepEqual(pos.map(p => [p.no, p.kj]), [[1, '桜'], [2, '梅']]);
  assert.equal(pos[0].hikki.set.title, 'JLPT N3 2024年12月');
  assert.equal(pos[0].choukai.set.section, 'choukai');
  assert.equal(POS.length, 29);
  assert.equal(POS[28][0], '鳳');
});

test('titles without a date stay separate', () => {
  const pos = susunPerjalanan([set('Set A', 'hikki'), set('Set B', 'hikki')]);
  assert.equal(pos.length, 2);
});

test('status per pos: belum, sebagian, bagus, kurang, segera', () => {
  const [a, b, c, d, e] = susunPerjalanan([
    set('2025年7月', 'hikki'), set('2025年7月', 'choukai'),
    set('2024年12月', 'hikki', { id: 's1', dijawab: 42 }),
    set('2024年7月', 'hikki', { id: 's2', score: 61, dijawab: 75 }), set('2024年7月', 'choukai', { id: 's3', score: 8, total: 11, dijawab: 11 }),
    set('2023年12月', 'hikki', { id: 's4', score: 40, dijawab: 75 }), set('2023年12月', 'choukai', { id: 's5', score: 9, total: 11, dijawab: 11 }),
    set('2023年7月', 'hikki', { ready: false }), set('2023年7月', 'choukai', { ready: false }),
  ]);
  assert.equal(a.status, 'belum');
  assert.equal(b.status, 'sebagian');
  assert.equal(c.status, 'bagus'); // 81% & 73%
  assert.equal(d.status, 'kurang'); // 53% < 60
  assert.equal(e.status, 'segera');
});

test('one part done, other untouched = still in progress', () => {
  const [p] = susunPerjalanan([set('2024年7月', 'hikki', { id: 'x', score: 70, dijawab: 75 }), set('2024年7月', 'choukai')]);
  assert.equal(p.status, 'sebagian');
  assert.ok(cocokSaring(p, 'belum'));
  assert.ok(!cocokSaring(p, 'selesai'));
});

test('next: most recent half-done part first, else first untouched pos, else nothing', () => {
  const pos = susunPerjalanan([
    set('2025年7月', 'hikki'),
    set('2024年12月', 'hikki', { id: 'a', dijawab: 10, terakhir: '2026-11-01T10:00:00Z' }),
    set('2024年7月', 'choukai', { id: 'b', dijawab: 3, terakhir: '2026-11-09T10:00:00Z' }),
  ]);
  const n = berikutnya(pos);
  assert.equal(n.alasan, 'lanjut');
  assert.equal(n.bagian.set.id, 'b');

  const segar = susunPerjalanan([set('2025年7月', 'hikki', { ready: false }), set('2024年12月', 'hikki'), set('2024年12月', 'choukai')]);
  const m = berikutnya(segar);
  assert.equal(m.alasan, 'baru');
  assert.equal(m.pos.no, 2);
  assert.equal(m.bagian.set.section, 'hikki');

  assert.equal(berikutnya(susunPerjalanan([set('2024年7月', 'hikki', { id: 'z', score: 70, dijawab: 75 })])), null);
});

test('summary counts ready sets and averages 筆記 of lit posts', () => {
  const r = ringkasan(susunPerjalanan([
    set('2025年7月', 'hikki', { id: 'a', score: 60, dijawab: 75 }),
    set('2024年12月', 'hikki', { id: 'b', score: 30, dijawab: 75 }),
    set('2024年7月', 'hikki'),
    set('2023年7月', 'hikki', { ready: false }),
  ]));
  assert.deepEqual(r, { siap: 3, selesai: 2, belumLengkap: 1, rataHikki: 60 });
  assert.equal(ringkasan([]).rataHikki, null);
});

test('word & pattern status rules', () => {
  assert.equal(statusKata(undefined), 'new');
  assert.equal(statusKata({ benar: 1, salah: 0 }), 'seen');
  assert.equal(statusKata({ benar: 2, salah: 1 }), 'known');
  assert.equal(statusKata({ benar: 1, salah: 2 }), 'wrong');
  assert.equal(statusPola({ benar: 2, salah: 0 }), 'seen');
  assert.equal(statusPola({ benar: 3, salah: 1 }), 'known');
  assert.equal(statusPola({ benar: 0, salah: 1 }), 'seen');
  assert.equal(statusPola({ benar: 0, salah: 2 }), 'wrong');
});

test('four-way counts and percentages', () => {
  const e = hitungEmpat(['known', 'known', 'seen', 'wrong', 'new'], x => x);
  assert.deepEqual(e, [2, 1, 1, 1]);
  assert.equal(persenDimulai(e), 60);
  assert.equal(persenDikuasai(e), 40);
  assert.equal(persenDimulai([0, 0, 0, 0]), 0);
});

test('kotoba group names', () => {
  assert.deepEqual(namaKelompokKata('か行'), { jp: 'か行', id: 'Kata berawalan か' });
  assert.deepEqual(namaKelompokKata('Unit 8'), { jp: '仕事', id: 'Pekerjaan' });
  assert.equal(namaKelompokKata('その他').id, 'Lainnya');
});

import { navAktif } from '../src/lib/nav-aktif.ts';
test('nav: Materi lights up on curriculum pages, Bank Soal on strategy', () => {
  assert.ok(navAktif('/materi', '/materi'));
  assert.ok(navAktif('/materi', '/materi/kotoba'));
  assert.ok(navAktif('/materi', '/kurikulum/keterampilan'));
  assert.ok(!navAktif('/materi', '/bank-soal'));
  assert.ok(navAktif('/bank-soal', '/bank-soal'));
  assert.ok(navAktif('/bank-soal', '/strategi'));
  assert.ok(!navAktif('/bank-soal', '/materi'));
  assert.ok(navAktif('/', '/'));
  assert.ok(!navAktif('/', '/materi'));
  assert.ok(navAktif('/progres', '/progres/pamer'));
  assert.ok(!navAktif('/kamus', '/kamusku'));
});
