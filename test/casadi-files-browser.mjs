import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),requests=[],errors=[];
 page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.VIZ_TEST_URL||'http://127.0.0.1:8774')+'/examples/casadi-files.html');
 await page.locator('#message').filter({hasText:'decoded without CasADi'}).waitFor();
 await page.locator('#graph svg').waitFor();
 assert.match(await page.locator('#metadata').innerText(),/getnonzeros/);
 for(const name of ['arithmetic','assignment','sparse','slice','mapping']){
  await page.selectOption('#case',name);
  await page.waitForFunction(name=>document.querySelector('#graph').shadowRoot.textContent.includes(name),name);
  await page.locator('#message').filter({hasText:'decoded without CasADi'}).waitFor();
 }
 await page.setInputFiles('#file',fileURLToPath(new URL('./fixtures/casadi/assignment.casadi',import.meta.url)));
 await page.waitForFunction(()=>document.querySelector('#metadata').textContent.includes('setnonzeros'));
 await page.setInputFiles('#file',{name:'bad.casadi',mimeType:'text/plain',buffer:Buffer.from('invalid')});
 await page.locator('#message').filter({hasText:'Invalid .casadi encoding'}).waitFor();
 assert.equal(await page.locator('#graph svg').count(),1);
 await page.selectOption('#case','mapping');
 await page.locator('#message').filter({hasText:'decoded without CasADi'}).waitFor();
 const pending=page.waitForEvent('download');await page.click('#download');const download=await pending;
 assert.equal(download.suggestedFilename(),'decoded.casadi.json');
 assert(!requests.some(url=>/casadi_wasm|casadi\.wasm|\.casadi_viz/.test(url)),requests.join('\n'));
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'/tmp/casadi-file-reader.png',fullPage:true});
 console.log('PASS: native files rendered, upload/download, invalid-file recovery; no CasADi runtime or graph JSON fetched');
}finally{await browser.close();}
