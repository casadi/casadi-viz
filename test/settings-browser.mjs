import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.VIZ_TEST_URL||'http://127.0.0.1:8766')+'/examples/casadi-files.html');
 await page.locator('#graph svg').waitFor();
 await page.selectOption('#case','settings_mx');
 await page.locator('#graph #name').filter({hasText:'settings_outer'}).waitFor();
 await page.locator('#graph svg').waitFor();
 assert(await page.locator('#graph #instruction-1 [fill="#b56324"]').count()>0);
 assert.equal(await page.locator('#graph .edge path').first().evaluate(el=>getComputedStyle(el).stroke),'rgb(0, 0, 0)');
 assert.equal(await page.locator('#graph .edge polygon').first().evaluate(el=>getComputedStyle(el).fill),'rgb(0, 0, 0)');
 assert.match(await page.locator('#graph .node text').first().evaluate(el=>getComputedStyle(el).fontFamily),/Times New Roman/);
 // Check actual browser glyph bounds, not just the requested font name.
 const overflowing=await page.locator('#graph svg').evaluate(svg=>[...svg.querySelectorAll('.node')].flatMap(node=>{
   const shape=node.querySelector('ellipse,polygon,path');if(!shape)return [];
   const box=shape.getBBox();
   return [...node.querySelectorAll('text')].filter(text=>{
     if(!text.textContent)return false;
     const label=text.getBBox();
     return label.x<box.x-0.5 || label.x+label.width>box.x+box.width+0.5;
   }).map(text=>text.textContent);
 }));
 assert.deepEqual(overflowing,[],'Rendered labels must fit their nodes');

 await page.locator('#graph #function-details').click();
 const search=page.locator('#graph .settings-search');
 await search.fill('FunctionInternal::print_in');
 assert.match(await page.locator('#graph #inspector').innerText(),/print_in\s+true/);
 await page.locator('#graph #instruction-1').dblclick();
 await page.locator('#graph #name').filter({hasText:'settings_inner'}).waitFor();
 if(await page.locator('#graph #function-details').getAttribute('aria-pressed')==='false')await page.locator('#graph #function-details').click();
 await search.fill('FunctionInternal::enable_forward');
 assert.match(await page.locator('#graph #inspector').innerText(),/enable_forward\s+false/);
 await page.locator('#graph #breadcrumbs button').first().click();
 await page.locator('#graph #name').filter({hasText:'settings_outer'}).waitFor();
 await search.fill('FunctionInternal::ad_weight');
 assert.match(await page.locator('#graph #inspector').innerText(),/ad_weight\s+0.75/);
 // Unrecognized settings are picked up directly from the reader, and rendered as text.
 await page.evaluate(async()=>{
   const {readCasadi,toGraphBundle}=await import('../dist/casadi-import.js');
   const {createGraphViewer}=await import('../dist/index.js');
   const records=await readCasadi(await (await fetch('../test/fixtures/casadi/settings_sx.casadi')).text());
   records.objects[records.root].fields.push({name:'FutureFunction::new_setting',type:'Dict',value:{$map:[['literal','<img src=x onerror=alert(1)>'],['cycle',{$ref:records.root}]]}});
   const host=document.createElement('div');host.id='future';host.style.height='700px';document.body.append(host);
   await createGraphViewer(host).setGraph(toGraphBundle(records));
 });
 await page.locator('#future #function-details').click();
 await page.locator('#future .settings-search').fill('new_setting');
 await page.locator('#future .setting-row details>summary').click();
 await page.locator('#future .setting-value').filter({hasText:'<img src=x onerror=alert(1)>'}).first().waitFor();
 assert.match(await page.locator('#future #inspector').innerText(),/<img src=x onerror=alert\(1\)>/);
 assert.match(await page.locator('#future #inspector').innerText(),/reference already shown/);
 assert.equal(await page.locator('#future #inspector img').count(),0);
 await search.fill('');
 await page.locator('#future').evaluate(el=>el.remove());
 await page.screenshot({path:'/tmp/casadi-function-settings.png',fullPage:true});
 await page.evaluate(async()=>{
   const {createGraphViewer}=await import('../dist/index.js');
   const bundle=await (await fetch('../test/fixtures/casadi/arithmetic.json')).json();
   const constant={...bundle.nodes.find(n=>n.kind==='input'),id:bundle.nodes.length,kind:'constant',op:44,label:'constant'};
   bundle.nodes.push(constant);
   constant.constants=['0.040000000000000001'];constant.display=constant.constants[0];
   const input=bundle.nodes.find(n=>n.kind==='input');input.symbol='τ';
   bundle.type='MX';
   const host=document.createElement('div');host.id='numbers';host.style.height='700px';document.body.append(host);
   window.numericBundle=bundle;
   await createGraphViewer(host).setGraph(bundle);
 });
 await page.locator('#numbers svg text').filter({hasText:/^τ$/}).first().waitFor();
 await page.locator('#numbers svg text').filter({hasText:/^0\.04$/}).first().waitFor();
 await page.locator('#numbers .number-controls>summary').filter({hasText:'Numbers'}).click();
 await page.locator('#numbers #number-digits').fill('3');
 await page.locator('#numbers #number-digits').dispatchEvent('input');
 await page.locator('#numbers #number-format').selectOption('f');
 await page.locator('#numbers svg text').filter({hasText:/^0\.040$/}).first().waitFor();
 await page.locator('#numbers #number-format').selectOption('e');
 await page.locator('#numbers svg text').filter({hasText:/^4\.000e-2$/}).first().waitFor();
 assert.equal(await page.evaluate(()=>window.numericBundle.nodes.find(n=>n.kind==='constant').constants[0]),'0.040000000000000001');
 await page.locator('#numbers').screenshot({path:'/tmp/casadi-number-style.png'});

 assert.deepEqual(errors,[]);
 console.log('PASS: MX/SX Function settings, navigation, unknown option, nested values and reference cycles');
} finally {await browser.close();}
