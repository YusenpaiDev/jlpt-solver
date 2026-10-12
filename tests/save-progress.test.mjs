import test from 'node:test';
import assert from 'node:assert/strict';
import { assertProgressSaved } from '../src/lib/save-progress.ts';
test('a successful response must confirm the requested session was saved',()=>{
 assert.doesNotThrow(()=>assertProgressSaved('session-1',{data:{id:'session-1'},error:null}));
});
test('silent RLS denial, request failure and wrong row cannot count as saved',()=>{
 for(const result of [{data:null,error:null},{data:{id:'wrong'},error:null},{data:null,error:{message:'offline'}}]) assert.throws(()=>assertProgressSaved('session-1',result),/tersimpan/);
});
