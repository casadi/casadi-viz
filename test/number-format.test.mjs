import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatNumber} from '../src/number-format.js';
test('Numeric formats suppress binary decimal noise without changing input',()=>{
 const value='0.040000000000000001';
 assert.equal(formatNumber(value),'0.04');
 assert.equal(formatNumber(value,'f',3),'0.040');
 assert.equal(formatNumber(value,'e',3),'4.000e-2');
 assert.equal(formatNumber(value,'g',16),'0.04');
 assert.equal(value,'0.040000000000000001');
 assert.equal(formatNumber(12345678,'g',3),'1.23e+7');
 assert.equal(formatNumber(0.000004321,'g',3),'4.32e-6');
 assert.equal(formatNumber(-0,'f',2),'-0.00');
 assert.equal(formatNumber(Infinity),'Infinity');
 assert.equal(formatNumber('9223372036854775807'),'9223372036854775807');
 assert.equal(formatNumber('not a number'),'not a number');
});
