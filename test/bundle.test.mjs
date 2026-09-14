import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateBundle} from '../src/validate.js';
const bundle=JSON.parse(await readFile(new URL('../examples/graphs/example_17.casadi_viz',import.meta.url),'utf8'));
test('Native nested bundle retains identity and callee links',()=>assert.equal(validateBundle(bundle),bundle));
test('Unsupported bundle version is rejected',()=>assert.throws(()=>validateBundle({...bundle,version:2}),/version 1/));
test('Dangling callee is rejected',()=>{
 const bad=structuredClone(bundle);bad.nodes.find(n=>n.callee!==undefined).callee=999;
 assert.throws(()=>validateBundle(bad),/callee/);
});
test('Invalid edges are rejected before replacing an existing viewer',()=>{
 const bad=structuredClone(bundle);bad.edges[0].output=999;
 assert.throws(()=>validateBundle(bad),/dependency/);
});
