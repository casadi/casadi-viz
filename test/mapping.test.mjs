import {test} from 'node:test';
import assert from 'node:assert/strict';
import {entryMapping} from '../src/mapping.js';
const sparse={shape:[3,3],colind:[0,3,5,6],row:[0,1,2,1,2,2]};
const vector={shape:[3,1],colind:[0,3],row:[0,1,2]};
test('Extraction maps sparse nonzero indices to row/column coordinates',()=>{
 const m=entryMapping({mapping_kind:'extract',mapping:[4,0,-1],inputs:[sparse],outputs:[vector]});
 assert.deepEqual(m.rows.map(r=>[r.source,r.target]),[[[2,1],[0,0]],[[0,0],[1,0]],[null,[2,0]]]);
});
test('Assignment and addition map values into output sparsity',()=>{
 for(const kind of ['assign','add']) {
  const m=entryMapping({mapping_kind:kind,mapping:[4,0,-1],inputs:[sparse,vector],outputs:[sparse]});
  assert.equal(m.input,1);
  assert.deepEqual(m.rows.map(r=>[r.source,r.target]),[[[0,0],[2,1]],[[1,0],[0,0]],[[2,0],null]]);
 }
});
test('Old bundles without mapping semantics remain supported',()=>{
 assert.equal(entryMapping({mapping:[1,0]}),null);
});

const dense=(r,c)=>({shape:[r,c],colind:Array.from({length:c+1},(_,i)=>i*r),row:Array.from({length:r*c},(_,i)=>i%r)});
const {indexingLabel}=await import('../src/mapping.js');
test('Column, row and strided extraction use matrix slicing',()=>{
 assert.equal(indexingLabel({mapping_kind:'extract',mapping:[6,7],inputs:[dense(2,8)],outputs:[dense(2,1)]}),'.[:,3]');
 assert.equal(indexingLabel({mapping_kind:'extract',mapping:[1,3,5,7,9,11,13,15],inputs:[dense(2,8)],outputs:[dense(1,8)]}),'.[1,:]');
 assert.equal(indexingLabel({mapping_kind:'extract',mapping:[2,3,6,7,10,11],inputs:[dense(2,8)],outputs:[dense(2,3)]}),'.[:,1:6:2]');
 assert.equal(indexingLabel({mapping_kind:'extract',mapping:[7,6],inputs:[dense(2,8)],outputs:[dense(2,1)]}),'.[1::-1,3]');
});
test('Set/add identify the slice in the destination matrix',()=>{
 for(const kind of ['assign','add'])assert.equal(indexingLabel({mapping_kind:kind,mapping:[6,7],inputs:[dense(2,8),dense(2,1)],outputs:[dense(2,8)]}),'.[:,3]'+(kind==='add'?' += .':' = .'));
});
test('Sparse slicing is verified against the full pattern; irregular mappings stay unchanged',()=>{
 assert.equal(indexingLabel({mapping_kind:'extract',mapping:[3,4],inputs:[sparse],outputs:[{shape:[3,1],colind:[0,2],row:[1,2]}]}),'.[:,1]');
 assert.equal(indexingLabel({mapping_kind:'extract',mapping:[0,4],inputs:[dense(2,3)],outputs:[dense(2,1)]}),null);
 assert.equal(indexingLabel({mapping_kind:'extract',mapping:[-1],inputs:[dense(2,3)],outputs:[dense(1,1)]}),null);
});
