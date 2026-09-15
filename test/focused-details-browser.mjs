import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.VIZ_TEST_URL||'http://127.0.0.1:8766')+'/examples/casadi-files.html');
 await page.evaluate(async()=>{
  const {readCasadi,toGraphBundle}=await import('../dist/casadi-import.js');
  const {createGraphViewer}=await import('../dist/index.js');
  const doc=await readCasadi(await(await fetch('../test/fixtures/casadi/settings_mx.casadi')).text());
  // Model an opaque plugin Function: metadata exists, but there is no instruction graph.
  const callee=doc.objects.find(o=>o.fields?.some(f=>f.name==='ProtoFunction::name'&&f.value==='settings_inner'));
  callee.fields.find(f=>f.name==='FunctionInternal::base_function').value='Onnx';
  callee.fields.find(f=>f.name==='ProtoFunction::name').value='vib';
  callee.layouts=['OnnxFunction::serialize_body'];
  callee.fields.push({name:'OnnxFunction::model_path',type:'std::string',value:'/models/vib.onnx'});
  window.focusBundle=toGraphBundle(doc);
  const host=document.createElement('div');host.id='focus';host.style.height='800px';document.body.append(host);
  window.focusViewer=createGraphViewer(host);await window.focusViewer.setGraph(window.focusBundle);
 });
 const call=page.locator('#focus .node').filter({hasText:'vib [vib.onnx]'});
 await call.click();
 await page.locator('#focus #selection-title').filter({hasText:'vib'}).waitFor();
 await page.locator('#focus #function-details').click();
 await page.locator('#focus .settings-search').fill('model_path');
 assert.match(await page.locator('#focus #inspector').textContent(),/\/models\/vib\.onnx/);
 assert.match(await page.locator('#focus #selection-title').textContent(),/^vib/);
 assert.match(await page.locator('#focus #breadcrumbs').textContent(),/settings_outer/);
 // Expression roots may have no Function metadata of their own.
 await page.evaluate(async()=>{delete window.focusBundle.serialized_ref;await window.focusViewer.setGraph(window.focusBundle);});
 assert(await page.locator('#focus #function-details').isDisabled());
 await call.click();await page.locator('#focus #selection-title').filter({hasText:'vib'}).waitFor();
 assert(await page.locator('#focus #function-details').isEnabled());
 // Missing callee metadata must never silently select the parent Function.
 await page.evaluate(async()=>{
  window.focusBundle.serialized_ref=window.focusBundle.serialization.root;
  delete window.focusBundle.nodes.find(n=>n.kind==='call').callee_serialized_ref;
  await window.focusViewer.setGraph(window.focusBundle);
 });
 assert(await page.locator('#focus #function-details').isEnabled());
 await call.click();await page.locator('#focus #selection-title').filter({hasText:'vib'}).waitFor();
 assert(await page.locator('#focus #function-details').isDisabled());
 assert.deepEqual(errors,[]);console.log('PASS: focused opaque Function metadata, expression roots, and no parent fallback');
}finally{await browser.close();}
