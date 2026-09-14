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
