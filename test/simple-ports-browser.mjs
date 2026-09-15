import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.VIZ_TEST_URL||'http://127.0.0.1:8766')+'/examples/casadi-files.html');
 await page.evaluate(async()=>{
  const {createGraphViewer}=await import('../dist/index.js');
  const bundle=await(await fetch('../test/fixtures/casadi/arithmetic.json')).json();
  const host=document.createElement('div');host.id='simple';host.style.height='800px';document.body.append(host);
  await createGraphViewer(host).setGraph({...bundle,format:'casadi_viz',view:'expression',functions:[]});
 });
 await page.locator('#simple #layout-controls>summary').click();
 for(const [flow,sides,out] of [['TB',['nw','ne'],'s'],['LR',['nw','sw'],'e'],['BT',['se','sw'],'n'],['RL',['se','ne'],'w']]){
  await page.locator('#simple #layout-direction').selectOption(flow);
  await page.locator('#simple svg').waitFor();
  for(const id of [1,2,3]){
   assert.equal(await page.locator('#simple #instruction-'+id+' ellipse').count(),1);
   assert.equal(await page.locator('#simple #instruction-'+id+' polygon').count(),0);
  }
  const actual=await page.locator('#simple svg').evaluate((svg,{sides,out})=>{
   const ellipse=svg.querySelector('#instruction-3 ellipse');
   const cx=+ellipse.getAttribute('cx'),cy=+ellipse.getAttribute('cy');
   const rx=+ellipse.getAttribute('rx'),ry=+ellipse.getAttribute('ry');
   return sides.map((side,i)=>{
    const title=`n${i+1}:${out}->n3:${side}`;
    const edge=[...svg.querySelectorAll('.edge')].find(e=>e.querySelector('title').textContent===title);
    if(!edge)return {title,missing:true};
    const tip=edge.querySelector('polygon').points.getItem(1);
    return {title,x:(tip.x-cx)/rx*(side.includes('w')?-1:1),
      y:(tip.y-cy)/ry*(side.includes('n')?-1:1)};
   });
  },{sides,out});
  for(const result of actual){assert(!result.missing,JSON.stringify(result));assert(result.x>0.3 && result.y>0.3,JSON.stringify(result));}
 }
 assert.deepEqual(errors,[]);console.log('PASS: unary/binary nodes have no port boxes; binary arrows rotate geometrically in all four flows');
}finally{await browser.close();}
