import test from 'node:test';
import assert from 'node:assert/strict';
import { practiced, answeredCount, correctCount, activityAt, hasPracticeDate, recentPractice } from '../src/lib/session-progress.ts';
const partial={id:'partial',kind:'materi',total:74,score:null,created_at:'2026-09-01T10:00:00Z',stats:{answered:63,correct:45,last_practiced_at:'2026-10-12T10:00:00Z'}};
test('63/74 unfinished bank questions count as practice, without pretending complete',()=>{
 assert.equal(practiced(partial),true);assert.equal(answeredCount(partial),63);assert.equal(correctCount(partial),45);assert.equal(partial.score,null);
});
test('untouched imports are excluded and old completed sessions retain their score',()=>{
 assert.equal(practiced({...partial,stats:null}),false);
 assert.equal(answeredCount({...partial,stats:null,score:60}),74);
 assert.equal(correctCount({...partial,stats:null,score:60}),60);
});
test('recent practice sorts by last practice rather than import date',()=>{
 const untouched={...partial,id:'untouched',created_at:'2026-10-13T00:00:00Z',stats:null};
 const older={...partial,id:'older',stats:{...partial.stats,last_practiced_at:'2026-10-11T10:00:00Z'}};
 assert.deepEqual(recentPractice([older,untouched,partial]).map(s=>s.id),['partial','older']);
 assert.equal(activityAt({...partial,stats:{answered:63}}),partial.created_at);
});
test('invalid or missing practice dates do not override valid timestamps',()=>{
 assert.equal(activityAt({...partial,stats:{last_practiced_at:'invalid'}}),partial.created_at);
});

test('old imported dates are not claimed as practice dates',()=>{
 assert.equal(hasPracticeDate({...partial,stats:{answered:63}}),false);
 assert.equal(hasPracticeDate(partial),true);
});

test('accuracy is weighted by answered questions, not number of sessions', async()=>{
 const { accuracyPercent } = await import('../src/lib/session-progress.ts');
 assert.equal(accuracyPercent([{...partial,total:1,score:1,stats:null},{...partial,total:99,score:0,stats:null}]),1);
 assert.equal(accuracyPercent([]),null);
});

test('daily summaries consistently use recorded activity and exclude undated imports', async()=>{
 const { dailyActivity } = await import('../src/lib/session-progress.ts');
 const old={...partial,created_at:'2026-10-12T10:00:00Z',stats:{answered:63}};
 assert.deepEqual(dailyActivity([old],null),{});
 assert.deepEqual(dailyActivity([partial],[]),{});
 assert.deepEqual(dailyActivity([partial],[{tanggal:'2026-10-11',jumlah:3}]),{'2026-10-11':3});
});
