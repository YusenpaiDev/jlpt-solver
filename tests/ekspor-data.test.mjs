import test from 'node:test';
import assert from 'node:assert/strict';
import { csvKamus, mdCatatan } from '../src/lib/ekspor-data.ts';

test('kamus CSV: BOM, header, quoting, formula guard', () => {
  const s = csvKamus([
    { kanji: '影響', reading: 'えいきょう', meaning: 'pengaruh, dampak', level: 'N3', favorite: true, created_at: '2026-11-12T03:00:00Z' },
    { kanji: '=SUM(1)', reading: null, meaning: 'kata "aneh"', level: null },
  ]);
  assert.ok(s.startsWith('﻿kanji,cara_baca,arti,level,favorit,disimpan\r\n'));
  assert.ok(s.includes('影響,えいきょう,"pengaruh, dampak",N3,ya,2026-11-12\r\n'));
  assert.ok(s.includes(`'=SUM(1),,"kata ""aneh""",,,`));
});

test('notes Markdown', () => {
  const s = mdCatatan([{ judul: 'に対して', isi: 'terhadap', source: 'soal', created_at: '2026-11-10T00:00:00Z' }, { judul: '', isi: 'x' }]);
  assert.ok(s.startsWith('# Catatan Honix\n\n## に対して\n_2026-11-10 · sumber: soal_\n\nterhadap'));
  assert.ok(s.includes('---\n\n## Tanpa judul\n\nx'));
});
