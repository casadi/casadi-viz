import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const base=process.env.VIZ_TEST_URL||'http://127.0.0.1:8766';
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/examples/bundles.html');
 await page.locator('#graph svg').waitFor();
 assert.equal(await page.locator('#graph #trace-toggle').getAttribute('aria-pressed'),'false');
 for(const id of ['detail-toggle','size-toggle'])assert.equal(await page.locator('#graph #'+id).isChecked(),true);
 const bundle=await page.evaluate(async()=>JSON.parse(await (await fetch('graphs/example_17.casadi_viz')).text()));
 const call=bundle.nodes.find(n=>n.callee!==undefined);
 await page.locator('#graph #instruction-'+call.id).dblclick();
 await page.waitForFunction(()=>document.querySelector('#graph').shadowRoot.querySelectorAll('#breadcrumbs button').length===2);
 await page.locator('#graph #breadcrumbs button').first().click();
 await page.locator('#graph svg').waitFor();
 await page.locator('#graph #detail-toggle').uncheck();
 await page.waitForFunction(()=>!document.querySelector('#graph').shadowRoot.querySelector('.value-node'));
 await page.selectOption('#case','3');await page.locator('#graph svg').waitFor();
 await page.evaluate(async()=>{
   const {createGraphViewer}=await import('../dist/index.js');
   const bundle=await (await fetch('graphs/example_16.casadi_viz')).json();
   const element=document.createElement('div');element.id='second';element.style.height='400px';document.body.append(element);
   window.second=createGraphViewer(element);await window.second.setGraph(bundle);
   try{await window.second.setGraph({...bundle,version:999});throw Error('Invalid bundle accepted');}catch(e){if(!e.message.includes('version 1'))throw e;}
 });
 assert.equal(await page.locator('#second svg').count(),1);assert.equal(await page.locator('#graph svg').count(),1);
 await page.evaluate(()=>window.second.destroy());assert.equal(await page.locator('#second svg').count(),0);
 console.log('Bundle viewer: nested navigation, toggles, isolated instances and lifecycle passed');
 await page.goto(base+'/examples/indexing.html');
 await page.locator('.mapping-table').waitFor();
 for(const name of ['subref','subassign','sparse_subref']) {
   await page.selectOption('#case',name);
   await page.waitForFunction(name=>document.querySelector('#graph').shadowRoot.querySelector('#breadcrumbs').textContent.includes(name),name);
   await page.locator('.mapping-table tr').nth(1).hover();
   assert.equal(await page.locator('.mapping-grids .mapped').count(),2);
   await page.locator('#detail-toggle').uncheck();
   assert.equal(await page.locator('.mapping-grids').count(),0);
   await page.locator('#detail-toggle').check();
 }
 console.log('Submatrix viewer: extraction, assignment, sparse coordinates and cell highlights passed');
 if(process.env.VIZ_TEST_WASM==='1') {
   await page.goto(base+'/examples/index.html');
   await page.waitForFunction(()=>document.querySelector('#result').textContent.startsWith('Evaluation'),{timeout:30000});
   await page.locator('#graph svg').waitFor();
   assert.match(await page.locator('#result').textContent(),/f = \[5\]/);
   await page.locator('#capture').check();await page.locator('#solve').click();
   await page.waitForFunction(()=>document.querySelector('#result').textContent.startsWith('Solution'),{timeout:30000});
   await page.locator('#graph svg').waitFor();
   assert.match(await page.locator('#result').textContent(),/x = \[2,-1\]/);
   await page.waitForFunction(()=>document.querySelector('#graph').shadowRoot.querySelector('#trace-name').textContent.length>0);
   assert.equal(await page.locator('#graph #toolbar').isVisible(),false);
   await page.locator('#graph #trace-toggle').click();await page.locator('#graph #end').click();
   assert.match(await page.locator('#graph #step-label').textContent(),/\d/);
   const code=await page.locator('#code').inputValue();
   await page.locator('#code').fill(code.replace("ca.SX(2)","ca.SX(3)"));
   await page.locator('#solve').click();
   await page.waitForFunction(()=>document.querySelector('#result').textContent.includes('x = [3,-1]'),{timeout:30000});
   await page.locator('#graph svg').waitFor();
   await page.locator('#code').fill('throw new Error("Example error")');await page.locator('#evaluate').click();
   await page.waitForFunction(()=>document.querySelector('#result').textContent==='Example error');
   await page.locator('#code').fill(code);await page.locator('#solve').click();
   await page.waitForFunction(()=>document.querySelector('#result').textContent.includes('x = [2,-1]'),{timeout:30000});
   await page.locator('#graph svg').waitFor();
   await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/playground.png'});
   console.log('WASM playground: C++ export, solve, trace, expression edits and error recovery passed');
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
