import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSessionPages } from '../src/lib/session-data.ts';
test('loads older practice beyond the first page of imports',async()=>{
 const rows=Array.from({length:1003},(_,id)=>({id}));
 const result=await loadSessionPages(async(from,to)=>({data:rows.slice(from,to+1),error:null}));
 assert.equal(result.data.length,1003);assert.equal(result.data.at(-1).id,1002);
});
test('does not present incomplete statistics if a later page fails',async()=>{
 const result=await loadSessionPages(async(from)=>from?{data:null,error:{message:'offline'}}:{data:Array(1000).fill({id:1}),error:null});
 assert.equal(result.data,null);assert.ok(result.error);
});
