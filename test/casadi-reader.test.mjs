import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodeCasadi} from '@casadi/casadi-reader';
import {toGraphBundle} from '../src/casadi-adapter.js';
const sp=s=>s&&({shape:s.shape,colind:s.colind,row:s.row});
const semantic=g=>({inputs:g.inputs.map(p=>({...p,sparsity:sp(p.sparsity)})),outputs:g.outputs.map(p=>({...p,sparsity:sp(p.sparsity)})),
 edges:g.edges,nodes:g.nodes.map(n=>({id:n.id,op:n.op,kind:n.kind,inputs:n.inputs.map(sp),outputs:n.outputs.map(sp),
 io_index:n.io_index,io_offset:n.io_offset,mapping:n.mapping,mapping_kind:n.mapping_kind,constants:n.constants}))});
for(const name of ['arithmetic','mapping','slice','assignment','sparse','settings_sx','settings_mx'])test('direct .casadi reader matches native graph: '+name,async()=>{
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

test('Function settings retain reader fields without an option catalogue',async()=>{
 const document=decodeCasadi(await readFile(new URL('./fixtures/casadi/settings_mx.casadi',import.meta.url),'utf8'));
 document.objects[document.root].fields.push({name:'FutureFunction::new_setting',type:'bool',value:true});
 const graph=toGraphBundle(document);
 assert.equal(graph.serialization,document);
 assert.equal(graph.serialized_ref,document.root);
 assert.equal(graph.serialization.objects[graph.serialized_ref].fields.at(-1).name,'FutureFunction::new_setting');
 const callee=graph.functions[graph.nodes.find(n=>n.kind==='call').callee-1];
 assert.equal(callee.type,'SXFunction');
 assert.equal(graph.serialization.objects[callee.serialized_ref].fields.find(f=>f.name==='FunctionInternal::enable_forward').value,false);
});

test('helper functions come from Function-typed fields, without a class catalogue',async()=>{
 const read=name=>readFile(new URL(`./fixtures/casadi/${name}.casadi`,import.meta.url),'utf8').then(decodeCasadi);
 const solver=toGraphBundle(await read('helpers_nlpsol')),graphs=[solver,...solver.functions];
 assert.equal(solver.opaque,true);
 assert.deepEqual(solver.helpers.map(h=>h.name),['oracle','nlp_f','nlp_g','nlp_grad','nlp_grad_f','nlp_hess_l','nlp_jac_g']);
 assert.equal(graphs[solver.helpers[0].function].name,'nlp');
 assert.equal(graphs[solver.helpers.find(h=>h.name==='nlp_hess_l').function].type,'MXFunction');
 // One call between the solver's inputs and outputs.
 const call=solver.nodes.find(n=>n.opaque);
 assert.equal(solver.edges.filter(e=>e.to===call.id).length,solver.inputs.length);
 assert.equal(solver.edges.filter(e=>e.from===call.id).length,solver.outputs.length);
 const model=toGraphBundle(await read('helpers_calls')),all=[model,...model.functions];
 const callee=name=>all[model.nodes.find(n=>n.display===name).callee];
 assert.deepEqual(callee('map4_f').helpers.map(h=>[h.name,all[h.function].type]),[['f','SXFunction']]);
 assert.equal(callee('solver').helpers.length,7);
});
