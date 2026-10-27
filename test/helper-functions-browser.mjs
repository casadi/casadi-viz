import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.VIZ_TEST_URL||'http://127.0.0.1:8766')+'/examples/casadi-files.html');
 await page.locator('#message').filter({hasText:'decoded without CasADi'}).waitFor();
 const crumbs=()=>page.locator('#breadcrumbs').textContent();
 const show=async(name,text)=>{await page.selectOption('#case',name);
  await page.waitForFunction(t=>document.querySelector('#graph').shadowRoot.textContent.includes(t),text);};
 const call=name=>page.locator('#graph svg g.node',{hasText:name}).first();
 const badge=name=>page.locator(`#graph .function-badge[data-call="${name}"]`);
 const popover=page.locator('#functions-popover');
 // Badges sit on the call nodes they belong to: a Map with one helper links straight through.
 await show('helpers_calls','xopt');
 assert.match(await badge('map4_f').locator('text').textContent(),/^ƒ f →$/);
 await badge('map4_f').click();
 await page.waitForFunction(()=>document.querySelector('#graph').shadowRoot.querySelector('#breadcrumbs').textContent==='model/map4_f/f');
 await page.locator('#breadcrumbs button',{hasText:'model'}).click();
 await badge('solver').waitFor();
 // Ipopt and Newton in one graph: each badge lists only its own callee's helpers.
 await show('helpers_mixed','zroot');
 const ipopt=badge('solver'),newton=badge('newton_solver');
 assert.match(await ipopt.locator('text').textContent(),/7 functions/);assert.match(await newton.locator('text').textContent(),/2 functions/);
 await newton.click();
 assert.match(await page.locator('#functions-title').textContent(),/Inside newton_solver/);
 assert.deepEqual(await popover.locator('.function-name').allTextContents(),['rfp','rfp_jac']);
 await ipopt.click();
 assert.match(await page.locator('#functions-title').textContent(),/Inside solver/);
 const names=await popover.locator('.function-name').allTextContents();
 assert.equal(names.length,7);assert(names.every(n=>!/rfp/.test(n)),names.join());
 // The popover hangs off its badge.
 const [b,p]=await Promise.all([ipopt.boundingBox(),popover.boundingBox()]);
 assert(Math.abs(p.y-(b.y+b.height))<12 && Math.abs(p.x-b.x)<16,JSON.stringify({b,p}));
 await page.keyboard.press('Escape');assert(await popover.isHidden());
 await newton.click();await page.mouse.click(30,300);assert(await popover.isHidden());
 // Keyboard navigation, then open through the owning call.
 await ipopt.click();await page.keyboard.press('ArrowUp');
 assert.equal(await page.evaluate(()=>document.querySelector('#graph').shadowRoot.activeElement.querySelector('.function-name').textContent),'nlp_jac_g');
 await popover.locator('.function-row',{hasText:'nlp_hess_l'}).click();
 await page.waitForFunction(()=>document.querySelector('#graph').shadowRoot.querySelector('#meta').textContent.startsWith('MXFunction'));
 assert.equal(await crumbs(),'mixed/solver/nlp_hess_l');
 // The call crumb leads back to the outer graph with the call selected; solvers cannot be stepped into.
 await page.locator('#breadcrumbs button.via',{hasText:'solver'}).click();
 await page.waitForFunction(()=>document.querySelector('#graph').shadowRoot.querySelector('#selection-title').textContent==='solver');
 assert.equal(await crumbs(),'mixed');assert.match(await page.locator('#meta').textContent(),/^MXFunction/);
 assert(await page.locator('#enter-function').count()===0);
 assert.match(await page.locator('#inspector').textContent(),/IpoptInterface has no expression graph/);
 await call('solver').dblclick({position:{x:20,y:40}});
 await popover.waitFor();assert.match(await page.locator('#functions-title').textContent(),/Inside solver/);
 assert.equal(await crumbs(),'mixed');await page.keyboard.press('Escape');
 await page.selectOption('#case','helpers_calls');await badge('map4_f').waitFor();
 await call('map4_f').dblclick({position:{x:20,y:40}});
 await page.waitForFunction(()=>document.querySelector('#graph').shadowRoot.querySelector('#breadcrumbs').textContent==='model/map4_f/f');
 await page.selectOption('#case','helpers_mixed');await badge('newton_solver').waitFor();
 // Details pane of a call lists that callee's helpers only.
 await call('newton_solver').click();
 await page.locator('#inspector .function-row').first().waitFor();
 assert.deepEqual(await page.locator('#inspector .function-name').allTextContents(),['rfp','rfp_jac']);
 await page.locator('#inspector .function-row',{hasText:'rfp_jac'}).click();
 await page.waitForFunction(()=>document.querySelector('#graph').shadowRoot.querySelector('#breadcrumbs').textContent==='mixed/newton_solver/rfp_jac');
 // A solver exported on its own still opens on its call node, badge included.
 await page.selectOption('#case','helpers_nlpsol');
 await page.locator('#meta').filter({hasText:/no expression graph · 7 functions inside/}).waitFor();
 await badge('solver').click();
 assert.equal(await popover.locator('.function-row').count(),7);
 await popover.locator('.function-row',{hasText:'nlp_grad_f'}).click();
 await page.waitForFunction(()=>document.querySelector('#graph').shadowRoot.querySelector('#breadcrumbs').textContent==='solver/nlp_grad_f');
 // nlp_grad: the operands of f = (x0-p)^2 + x1^2 trade in-ports, one through the last piece of a two-rank edge.
 await page.locator('#breadcrumbs button',{hasText:'solver'}).click();
 await badge('solver').click();await popover.locator('.function-row').filter({has:page.locator('.function-name',{hasText:/^nlp_grad$/})}).click();
 await page.waitForFunction(()=>document.querySelector('#graph').shadowRoot.querySelector('#breadcrumbs').textContent==='solver/nlp_grad');
 await page.locator('#graph svg[data-rerouted-edges]').waitFor();
 assert.equal(await page.locator('#graph svg').getAttribute('data-rerouted-edges'),'2');
 // An empty 0-by-0 constant renders with matrix contents shown.
 await page.selectOption('#case','empty_constant');await call('qp').waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: per-call helper badges, Ipopt/Newton separation, anchored popover, details-pane helpers, no stepping into solvers');
}finally{await browser.close();}
