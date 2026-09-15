import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.VIZ_TEST_URL||'http://127.0.0.1:8766')+'/examples/casadi-files.html');
 for(const type of ['mx','sx']){
  await page.evaluate(async type=>{
   const {createGraphViewer}=await import('../dist/index.js');
   document.querySelector('#expression')?.remove();
   const host=document.createElement('div');host.id='expression';host.style.height='800px';document.body.append(host);
   const bundle=await(await fetch('../test/fixtures/casadi/'+type+'_expression.casadi_viz')).json();
   window.expressionViewer=createGraphViewer(host);await window.expressionViewer.setGraph(bundle);
  },type);
  if(type==='mx'){
   await page.locator('#expression svg text').filter({hasText:/^vertcat$/}).waitFor();
   assert.equal(await page.locator('#expression svg text').filter({hasText:/^arg[0-9]+/}).count(),0);
   await page.locator('#expression #layout-controls>summary').click();
   for(const engine of ['neato','fdp','sfdp','circo','twopi','dot']){
    await page.locator('#expression #layout-engine').selectOption(engine);
    await page.locator('#expression svg text').filter({hasText:/^vertcat$/}).waitFor();
   }
  }
  if(type==='mx'){
   await page.locator('#expression #layout-direction').selectOption('LR');
   await page.locator('#expression svg').waitFor();
   for(const direction of ['TB','BT','LR','RL']){
    await page.locator('#expression #layout-direction').selectOption(direction);
    await page.locator('#expression svg').waitFor();
    const geometry=await page.locator('#expression .node').filter({hasText:'vertcat'}).evaluate(node=>{
      const center=[...node.querySelectorAll('text')].find(t=>t.textContent==='vertcat');const b=center.getBBox();
      return {label:{x:b.x+b.width/2,y:b.y+b.height/2},ports:[...node.querySelectorAll('polygon[stroke="#d26666"]')].map(p=>{
       const r=p.getBBox();return {x:r.x+r.width/2,y:r.y+r.height/2};
      })};
    });
    assert.equal(geometry.ports.length,3);
    const horizontal=direction==='LR'||direction==='RL',axis=horizontal?'x':'y',cross=horizontal?'y':'x';
    const sign=direction==='LR'||direction==='TB'?-1:1;
    assert(geometry.ports.every(p=>sign*(p[axis]-geometry.label[axis])>0));
    assert(geometry.ports.every(p=>Math.abs(p[axis]-geometry.ports[0][axis])<0.1));
    assert(geometry.ports.every((p,i)=>!i||p[cross]>geometry.ports[i-1][cross]));
    const call=await page.locator('#expression .node').filter({hasText:'nested'}).evaluate(node=>{
      return Object.fromEntries([...node.querySelectorAll('text')].filter(t=>t.textContent.trim()).map(t=>{
       const b=t.getBBox();return [t.textContent.split(' ')[0],{x:b.x+b.width/2,y:b.y+b.height/2}];
      }));
    });
    assert(sign*(call.i0[axis]-call.nested[axis])>0);
    for(const name of ['o0','o1'])assert(sign*(call[name][axis]-call.nested[axis])<0);
    assert(Math.abs(call.o0[axis]-call.o1[axis])<1);
    assert(call.o0[cross]<call.o1[cross]);

   }
   await page.locator('#expression #layout-direction').selectOption('LR');
   await page.locator('#expression svg').waitFor();
   const before=await page.locator('#expression svg').getAttribute('viewBox');
   for(const id of ['node-spacing','level-spacing']){
    for(const [position,label] of [['-100','0.1×'],['0','1×'],['100','10×'],['200','100×']]){
     await page.locator('#expression #'+id).fill(position);
     await page.locator('#expression #'+id).dispatchEvent('input');
     await page.locator('#expression svg').waitFor();
     assert.equal(await page.locator('#expression #'+id+'-value').textContent(),label);
    }
    assert.notEqual(await page.locator('#expression svg').getAttribute('viewBox'),before);
    await page.locator('#expression #'+id).fill('0');
    await page.locator('#expression #'+id).dispatchEvent('input');
    await page.locator('#expression svg').waitFor();
   }
   for(const id of ['node-spacing','level-spacing']){
    await page.locator('#expression #'+id).fill('100');
    await page.locator('#expression #'+id).dispatchEvent('input');
   }
   await page.locator('#expression #reset-spacing').click();
   await page.locator('#expression svg').waitFor();
   for(const id of ['node-spacing','level-spacing']){
    assert.equal(await page.locator('#expression #'+id).inputValue(),'0');
    assert.equal(await page.locator('#expression #'+id+'-value').textContent(),'1×');
   }
   assert.equal(await page.locator('#expression #layout-direction').inputValue(),'LR');
   assert.equal(await page.locator('#expression svg').getAttribute('viewBox'),before);
   await page.locator('#expression #layout-direction').selectOption('TB');
   await page.locator('#expression #layout-controls>summary').click();
  }
  await page.locator('#expression svg').waitFor();
  assert.equal(await page.locator('#expression #view-mode').count(),0);
  assert.equal(await page.locator('#expression .cluster').count(),0);
  if(type==='mx')assert.equal(await page.locator('#expression svg text').filter({hasText:/^vertcat$/}).count(),1);
  await page.locator('#expression svg .node').filter({hasText:'nested'}).dblclick();
  await page.locator('#expression #breadcrumbs button').filter({hasText:'nested'}).waitFor();
  for(const kind of ['input','output']){
   const group=page.locator('#expression #boundary-group-'+kind);await group.waitFor();
   assert.match(await group.textContent(),kind==='input'?/Inputs/:/Outputs/);
  }

  await page.locator('#expression #breadcrumbs button').first().click();
  await page.locator('#expression #detail-toggle').uncheck();
  await page.locator('#expression svg').waitFor();
  if(type==='mx')await page.locator('#expression svg text').filter({hasText:/^vertcat$/}).waitFor();
  assert.equal(await page.locator('#expression .cluster').count(),0);
 }
 await page.evaluate(async()=>{
  const bundle=await(await fetch('../test/fixtures/casadi/mtimes.casadi_viz')).json();
  await window.expressionViewer.setGraph(bundle);
 });
 const product=page.locator('#expression .node').filter({hasText:'mtimes'});
 for(const label of ['accumulator','left','right'])assert((await product.textContent()).includes(label));
 await product.click();
 for(const label of ['accumulator','left','right'])await page.locator('#expression .port-title').filter({hasText:label}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: serialized expression render, vertcat, Function view, contents toggle and nested calls');
}finally{await browser.close();}
