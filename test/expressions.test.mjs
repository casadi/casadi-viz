import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readCasadi,toGraphBundle} from '../src/casadi-import.js';
for(const type of ['mx','sx'])test('Serialized '+type+' expressions retain sharing and nested calls',async()=>{
 const envelope=JSON.parse(readFileSync(new URL('./fixtures/casadi/'+type+'_expression.casadi_viz',import.meta.url),'utf8'));
 const graph=toGraphBundle(await readCasadi(envelope.source));
 assert.equal(graph.view,'expression');assert.equal(graph.outputs.length,2);
 const calls=graph.nodes.filter(n=>n.kind==='call');assert.equal(calls.length,1);
 assert.equal(graph.functions[calls[0].callee-1].name,'nested');
 assert.equal(graph.nodes.filter(n=>n.kind==='input').length,type==='mx'?1:2);
 if(type==='mx'){
   const cat=graph.nodes.find(n=>n.label==='vertcat');assert(cat);
   assert.equal(graph.edges.filter(e=>e.to===cat.id).length,3);
   assert.equal(calls[0].outputs.length,2);
 }
});

test('split expressions keep the second output and its sparsity',async()=>{
 const envelope=JSON.parse(readFileSync(new URL('./fixtures/casadi/split_outputs.casadi_viz',import.meta.url),'utf8'));
 const graph=toGraphBundle(await readCasadi(envelope.source));
 for(const [label,shape] of [['horzsplit',[4,3]],['vertsplit',[3,1]],['diagsplit',[3,3]]]){
  const split=graph.nodes.find(n=>n.label===label);assert(split,label);
  assert.equal(split.outputs.length,2);
  assert.deepEqual(split.outputs[1].shape,shape);
  const edges=graph.edges.filter(e=>e.from===split.id);
  assert.equal(edges.length,1);assert.equal(edges[0].output,1);
  const target=graph.nodes[edges[0].to];assert.equal(target.label,'neg');
  assert.deepEqual(target.inputs[0],split.outputs[1]);
 }
});

test('mtimes ports identify accumulator and the two factors',async()=>{
 const envelope=JSON.parse(readFileSync(new URL('./fixtures/casadi/mtimes.casadi_viz',import.meta.url),'utf8'));
 const graph=toGraphBundle(await readCasadi(envelope.source));
 const node=graph.nodes.find(n=>n.label==='mtimes');assert(node);
 assert.deepEqual(node.input_names,['accumulator','left','right']);
 assert.deepEqual(node.inputs.map(sp=>sp.shape),[[2,4],[2,3],[3,4]]);
 assert.deepEqual(graph.edges.filter(e=>e.to===node.id).map(e=>graph.nodes[e.from].symbol),['z','x','y']);
});
