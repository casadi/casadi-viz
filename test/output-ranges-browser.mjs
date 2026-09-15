import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.VIZ_TEST_URL||'http://127.0.0.1:8766')+'/examples/casadi-files.html');
 for(const type of ['mx','sx']){
  await page.evaluate(async type=>{
   const {createGraphViewer}=await import('../dist/index.js');
   const host=document.createElement('div');host.id='ranges';host.style.height='900px';document.body.replaceChildren(host);
   const bundle=await(await fetch('../test/fixtures/casadi/'+type+'_output_ranges.casadi_viz')).json();
   window.rangeBundle=bundle;await createGraphViewer(host).setGraph(bundle);
  },type);
  const expected=type==='mx'?['[0:2]','[2:12]','[12]']:Array.from({length:13},(_,i)=>'['+i+']');
  await page.locator('#ranges #layout-controls summary').click();
  for(const direction of ['TB','BT','LR','RL']){
   await page.locator('#ranges #layout-direction').selectOption(direction);
  for(const contents of [true,false]){
   await page.locator('#ranges #detail-toggle').setChecked(contents);await page.locator('#ranges #loading').waitFor({state:'hidden'});await page.locator('#ranges svg').waitFor();
   const output=page.locator('#ranges #value-boundary_output_0-0');
   for(const label of expected)await output.locator('text').filter({hasText:label,exact:true}).waitFor();
   const edges=await page.locator('#ranges svg').evaluate(svg=>[...svg.querySelectorAll('.edge')].filter(e=>e.querySelector('title').textContent.includes('->vboundary_output_0_0')).map(e=>({title:e.querySelector('title').textContent,y:e.querySelector('polygon').points.getItem(1).y})));
   assert.equal(edges.length,expected.length);
   assert.equal(new Set(edges.map(e=>e.y.toFixed(1))).size,expected.length);
   assert(edges.every(e=>e.title.endsWith(direction==='RL'?':e':':w')));
   if(type==='mx'&&direction==='TB'&&contents){
    await page.locator('#ranges #layout-controls summary').click();
    await page.screenshot({path:'/tmp/function-output-ranges.png'});
    await page.locator('#ranges #layout-controls summary').click();
   }
  }
  }
  await page.locator('#ranges #value-boundary_output_0-0 text').filter({hasText:'[12]',exact:true}).click();
  await page.locator('#ranges #inspector').getByText('Evaluator expression',{exact:true}).waitFor();
  assert.match(await page.locator('#ranges #inspector').textContent(),/\[12\]/);
 }
 assert.deepEqual(errors,[]);console.log('PASS: MX/SX output ranges have distinct targets, including writes beyond the preview; range selection works');
}finally{await browser.close();}
