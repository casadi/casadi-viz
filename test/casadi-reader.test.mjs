import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodeCasadi} from '@casadi/casadi-reader';
import {toGraphBundle} from '../src/casadi-adapter.js';
const sp=s=>s&&({shape:s.shape,colind:s.colind,row:s.row});
const semantic=g=>({inputs:g.inputs.map(p=>({...p,sparsity:sp(p.sparsity)})),outputs:g.outputs.map(p=>({...p,sparsity:sp(p.sparsity)})),
 edges:g.edges,nodes:g.nodes.map(n=>({id:n.id,op:n.op,kind:n.kind,inputs:n.inputs.map(sp),outputs:n.outputs.map(sp),
 io_index:n.io_index,io_offset:n.io_offset,mapping:n.mapping,mapping_kind:n.mapping_kind,constants:n.constants}))});
for(const name of ['arithmetic','mapping','slice','assignment','sparse'])test('direct .casadi reader matches native graph: '+name,async()=>{
 const path=new URL(`./fixtures/casadi/${name}`,import.meta.url);
 const ir=decodeCasadi(await readFile(new URL(path+'.casadi'),'utf8'));
 const graph=toGraphBundle(JSON.parse(JSON.stringify(ir)));
 const expected=JSON.parse(await readFile(new URL(path+'.json'),'utf8'));
 assert.deepEqual(semantic(graph),semantic(expected));
});

test('structural JSON import preserves the reader contract',async()=>{
 const {readCasadi}=await import('../src/casadi-import.js');
 const text=await readFile(new URL('./fixtures/casadi/mapping.casadi',import.meta.url),'utf8');
 const document=await readCasadi(text);
 assert.deepEqual(await readCasadi(JSON.stringify(document)),document);
 assert.deepEqual(semantic(toGraphBundle(document)),semantic(toGraphBundle(await readCasadi(JSON.stringify(document)))));
 assert.deepEqual(await readCasadi(new Blob([JSON.stringify(document)],{type:'application/json'})),document);
 await assert.rejects(readCasadi({format:'unknown',version:1}),/casadi_serialization/);
 await assert.rejects(readCasadi('{"format":"unknown","version":1}'),/casadi_serialization/);
 assert.throws(()=>toGraphBundle({...document,roots:[...document.roots,...document.roots]}),/one shared Function root/);
});
