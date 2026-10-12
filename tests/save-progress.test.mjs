import test from 'node:test';
import assert from 'node:assert/strict';
import { assertProgressSaved } from '../src/lib/save-progress.ts';
test('a successful response must confirm the requested session was saved',()=>{
 assert.doesNotThrow(()=>assertProgressSaved('session-1',{data:{id:'session-1'},error:null}));
});
test('silent RLS denial, request failure and wrong row cannot count as saved',()=>{
 for(const result of [{data:null,error:null},{data:{id:'wrong'},error:null},{data:null,error:{message:'offline'}}]) assert.throws(()=>assertProgressSaved('session-1',result),/tersimpan/);
});
test('final save waits for older autosave and survives previous failure',async()=>{
 const {createSaveQueue}=await import('../src/lib/save-progress.ts');
 const enqueue=createSaveQueue(); const writes=[]; let release;
 const gate=new Promise(resolve=>{release=resolve});
 const first=enqueue(async()=>{await gate;writes.push('autosave')});
 const last=enqueue(async()=>{writes.push('exit')});
 await Promise.resolve(); assert.deepEqual(writes,[]);release();await Promise.all([first,last]);
 assert.deepEqual(writes,['autosave','exit']);
 await assert.rejects(enqueue(async()=>{throw Error('offline')}));
 await enqueue(async()=>{writes.push('retry')});assert.equal(writes.at(-1),'retry');
});
