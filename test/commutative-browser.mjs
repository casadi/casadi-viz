import {chromium} from 'playwright';
import assert from 'node:assert/strict';
// r*c+2*r with r=a+b/c (CasADi export_graph): dot places 2*r left of r*c, so the operands of the
// final + arrive crossed unless edge-nudge.js lets them trade in-ports.
const browser=await chromium.launch();
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.VIZ_TEST_URL||'http://127.0.0.1:8766')+'/examples/casadi-files.html');
 await page.evaluate(async()=>{
  const {createGraphViewer}=await import('../dist/index.js');
  const bundle=await(await fetch('../test/fixtures/commutative-crossing.json')).json();
  const host=document.createElement('div');host.id='comm';host.style.height='800px';document.body.append(host);
  await createGraphViewer(host).setGraph({...bundle,format:'casadi_viz',view:'expression',functions:[]});
 });
 await page.locator('#comm #layout-controls>summary').click();
 for(const flow of ['TB','LR','BT','RL']){
  await page.locator('#comm #layout-direction').selectOption(flow);
  await page.locator('#comm svg').waitFor();
  const r=await page.locator('#comm svg').evaluate(svg=>{
   const tip=e=>{const p=e.querySelector('polygon').points;return [p.getItem(1).x,p.getItem(1).y];};
   const centre=id=>{const el=svg.querySelector('#instruction-'+id+' ellipse, #instruction-'+id+' polygon');const b=el.getBBox();return [b.x+b.width/2,b.y+b.height/2];};
   const crossed=[];
   for(const e0 of svg.querySelectorAll('g.edge[id^="operand-"][id$="-0"]')){
    const head=e0.id.split('-')[1], e1=svg.getElementById('operand-'+head+'-1');if(!e1)continue;
    const tails=[e0,e1].map(e=>e.querySelector('title').textContent.split('->')[0].split(':')[0].slice(1));
    const t0=centre(tails[0]),t1=centre(tails[1]),p0=tip(e0),p1=tip(e1);
    if((t0[0]-t1[0])*(p0[0]-p1[0])+(t0[1]-t1[1])*(p0[1]-p1[1])<0)crossed.push(head);
   }
   return {rerouted:+svg.dataset.reroutedEdges,crossed};
  });
  if(flow==='TB'){assert(r.rerouted>=2,'TB: nothing re-routed '+JSON.stringify(r));assert.deepEqual(r.crossed,[],'TB: '+JSON.stringify(r));}
  console.log(flow,JSON.stringify(r));
 }
 assert.deepEqual(errors,[]);console.log('PASS: crossed operands of commutative operations trade in-ports (top-to-bottom flow)');
}finally{await browser.close();}
