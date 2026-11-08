import test from 'node:test';
import assert from 'node:assert/strict';
import { grupBanding, pisahContoh, soalBanding, salahDiGrup } from '../src/lib/banding-pola.ts';

const p = (id, pattern, jp, hl, mirip = []) => ({
  id, pattern, meaning: `arti ${id}`, discriminator: `beda ${id}`, quickTip: `tip ${id}`,
  examples: jp ? [{ jp, highlight: hl, id: `terjemah ${id}` }] : [], confusableWith: mirip,
});
const A = p('a', '〜あげく', '悩んだあげく、辞めた。', 'あげく', ['b', 'c', 'd', 'hilang']);
const B = p('b', '〜末に', '話し合った末に、決めた。', '末に', ['a']);
const C = p('c', '〜結果', '練習した結果、勝てた。', '結果', ['a']);
const D = p('d', '〜挙句の果て', null, null, ['a']);
const byId = new Map([A, B, C, D].map(x => [x.id, x]));

test('group = the pattern plus up to two lookalikes that exist', () => {
  assert.deepEqual(grupBanding(A, byId).map(x => x.id), ['a', 'b', 'c']);
  assert.deepEqual(grupBanding(B, byId).map(x => x.id), ['b', 'a']);
  assert.deepEqual(grupBanding(p('x', 'x', 'x', 'x', ['hilang']), byId).map(x => x.id), ['x']);
});

test('example sentence is split around the highlighted pattern', () => {
  assert.deepEqual(pisahContoh('悩んだあげく、辞めた。', 'あげく'), ['悩んだ', 'あげく', '、辞めた。']);
  assert.equal(pisahContoh('悩んだ、辞めた。', 'あげく'), null);
  assert.equal(pisahContoh('悩んだ', ''), null);
});

test('drill makes one blank question per usable example, answers point into the group', () => {
  const grup = grupBanding(A, byId);
  const soal = soalBanding([...grup, D], () => 0.99); // rng tinggi → urutan tetap
  assert.equal(soal.length, 3); // D gak punya contoh
  for (const s of soal) {
    assert.equal(s.isi, [A, B, C][s.jawab].examples[0].highlight);
    assert.ok(s.sebelum.length > 0);
  }
  assert.deepEqual(soal.map(s => s.jawab).sort(), [0, 1, 2]);
});

test('mistakes are summed over the group from progress rows', () => {
  const progres = new Map([['〜あげく', { benar: 1, salah: 3 }], ['〜末に', { benar: 4, salah: 1 }], ['lain', { benar: 0, salah: 9 }]]);
  assert.equal(salahDiGrup(grupBanding(A, byId), progres), 4);
  assert.equal(salahDiGrup(grupBanding(A, byId), new Map()), 0);
});
