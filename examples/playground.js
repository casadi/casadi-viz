import {createGraphViewer} from '../dist/index.js';
const $=id=>document.getElementById(id),viewer=createGraphViewer($('graph'));
let worker=null,generation=0,bundle=null;
function busy(value){$('evaluate').disabled=$('solve').disabled=value;$('cancel').disabled=!value;}
function cancel(){++generation;worker?.terminate();worker=null;busy(false);}
async function run(solve) {
  cancel();const current=generation;
  try {
    const point=JSON.parse($('point').value);
    if(!Array.isArray(point) || !point.every(Number.isFinite))throw Error('Starting point must be an array of finite numbers.');
    busy(true);$('result').textContent=solve?'Building graph and optimizing…':'Building graph and evaluating…';
    worker=new Worker(new URL('./compute-worker.js',import.meta.url),{type:'module'});
    let graphReady=Promise.resolve();
    worker.onmessage=async({data})=>{
      if(current!==generation)return;
      if(data.event==='graph') {
        bundle=data.graph;$('download').disabled=false;
        graphReady=viewer.setGraph(bundle);
        graphReady.catch(error=>{if(current===generation)$('result').textContent=error.message;});
      } else if(data.event==='result') {
        worker?.terminate();worker=null;busy(false);
        $('result').textContent=(solve?'Solution':'Evaluation')+'\nx = '+JSON.stringify(data.point)+'\nf = '+JSON.stringify(data.values[0])+(data.values[1]?'\ng = '+JSON.stringify(data.values[1]):'');
        try {await graphReady;if(current===generation && data.trace)await viewer.loadTrace(data.trace);}
        catch(error){if(current===generation)$('result').textContent=error.message;}
      } else if(data.event==='error') {cancel();$('result').textContent=data.message;}
    };
    worker.onerror=event=>{cancel();$('result').textContent=event.message;};
    worker.postMessage({code:$('code').value,point,solve,trace:$('capture').checked});
  }catch(error){cancel();$('result').textContent=error.message;}
}
$('evaluate').onclick=()=>run(false);$('solve').onclick=()=>run(true);
$('cancel').onclick=()=>{cancel();$('result').textContent='Cancelled.';};
$('download').onclick=()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(bundle)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='model.casadi_viz';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
window.addEventListener('pagehide',()=>{cancel();viewer.destroy();});
run(false);
