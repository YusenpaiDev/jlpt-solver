import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soalHarian } from '../src/lib/kilat-harian.ts';

const dek = l => JSON.parse(readFileSync(new URL(`../src/data/bunpou/${l}.json`, import.meta.url), 'utf8')).patterns;

test('same question all day, different across days', () => {
  const p = dek('N3');
  assert.deepEqual(soalHarian(p, '2026-11-12', 'N3'), soalHarian(p, '2026-11-12', 'N3'));
  const minggu = new Set(['10', '11', '12', '13', '14', '15', '16'].map(d => soalHarian(p, `2026-11-${d}`, 'N3').pola));
  assert.ok(minggu.size >= 5, `cuma ${minggu.size} pola beda dalam seminggu`);
});

test('every level: 4 distinct options, exactly one rebuilds the sentence', () => {
  for (const l of ['N1', 'N2', 'N3', 'N4', 'N5']) {
    const p = dek(l);
    for (let d = 1; d <= 30; d++) {
      const s = soalHarian(p, `2026-12-${String(d).padStart(2, '0')}`, l);
      assert.ok(s, `${l} hari ${d}`);
      assert.equal(new Set(s.opsi).size, 4);
      const ex = p.find(x => x.pattern === s.pola).examples.map(e => e.jp);
      assert.ok(ex.includes(s.kalimat[0] + s.opsi[s.benar] + s.kalimat[1]));
      for (const o of s.opsi) if (o !== s.opsi[s.benar]) assert.ok(!o.includes(s.opsi[s.benar]) && !s.opsi[s.benar].includes(o));
      // pengecoh bukan pola mirip / sekelompok fungsi (biar gak ada dua jawaban bener)
      const jaw = p.find(x => x.pattern === s.pola);
      for (const o of s.opsi.filter((_, i) => i !== s.benar)) {
        const asal = p.filter(x => (x.examples ?? []).some(e => e.highlight === o));
        assert.ok(asal.some(x => x.functionGroup !== jaw.functionGroup && !(jaw.confusableWith ?? []).includes(x.id)), `${l} ${d}: ${o}`);
      }
    }
  }
});
