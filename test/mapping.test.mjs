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
