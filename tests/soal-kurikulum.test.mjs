import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { susunUnit } from '../src/lib/kurikulum.ts';
import { susunPenempatan, susunUlangan, soalDariKatalog, acak } from '../src/lib/soal-kurikulum.ts';

const baca = p => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const dek = lv => ({ k: baca(`../src/data/kotoba/${lv}.json`).vocabulary, b: baca(`../src/data/bunpou/${lv}.json`).patterns });
const sehat = s => {
  assert.ok(s.opsi.length >= 2, s.id);
  assert.equal(new Set(s.opsi).size, s.opsi.length, `opsi dobel ${s.id}`);
  assert.ok(s.benar >= 0 && s.benar < s.opsi.length, s.id);
};

for (const lv of ['N5', 'N3', 'N1']) {
  test(`placement test from real ${lv} data: 16 + 12 + 読解`, () => {
    const { k, b } = dek(lv);
    const unit = susunUnit(k, b);
    const dokkai = Array.from({ length: 12 }, (_, i) => ({ question: `q${i}`, options: ['a', 'b', 'c', 'd'], correct: 'c', passage: 'p' }));
    const s = susunPenempatan(unit, k, b, dokkai, 42);
    const n = g => s.filter(x => x.grup === g).length;
    assert.equal(n('文字・語彙'), 16);
    assert.equal(n('文法'), 12);
    assert.equal(n('読解'), 12);
    s.forEach(sehat);
    assert.ok(s.filter(x => x.grup !== '読解').every(x => x.unit >= 1 && x.unit <= 26));
    assert.deepEqual(susunPenempatan(unit, k, b, dokkai, 42).map(x => x.id), s.map(x => x.id)); // seed sama → soal sama
  });

  test(`weekly review from real ${lv} data: 12 kata · 6 pola · 6 jenis`, () => {
    const { k, b } = dek(lv);
    const unit = susunUnit(k, b);
    const u = unit[10];
    const s = susunUlangan(u, k, b, [u.kata[5]], { kata: 12, pola: 6, jenis: 6 }, 7);
    const n = x => s.filter(q => q.bagian === x).length;
    assert.equal(n('Kata'), 12);
    assert.equal(n('Jenis soal'), 6);
    assert.ok(n('Pola') >= 1 && n('Pola') <= 6);
    assert.equal(s[0].item.kunci, u.kata[5]); // yang lupa didahuluin
    s.forEach(sehat);
    assert.equal(new Set(s.map(x => x.id)).size, s.length);
  });
}

test('catalog question without the right answer in options is dropped', () => {
  assert.equal(soalDariKatalog({ question: 'q', options: ['a', 'b'], correct: 'z' }, 0, acak(1)), null);
  const s = soalDariKatalog({ question: 'q', options: ['a', 'b', 'c'], correct: 'b', passage: null }, 3, acak(1));
  assert.equal(s.opsi[s.benar], 'b');
  assert.equal(s.unit, null);
});
