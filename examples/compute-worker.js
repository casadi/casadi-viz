import {loadCasadi} from './load-casadi.js';
self.onmessage=async({data})=>{
  try {
    const {ca,fs}=await loadCasadi('./runtime/');
    const {x,f,g}=new Function('ca',data.code)(ca);
    if(!x || !f)throw Error('Return {x, f}, with an optional g for equality constraints.');
    const input=ca.DM(data.point);
    const outputs=g?[f,g]:[f],names=g?['objective','constraints']:['objective'];
    const model=ca.Function('model',[x],outputs,['x'],names,{dump_trace:data.trace,dump_dir:'/'});
    const graph=JSON.parse(model.export_graph({include_functions:true}));
    self.postMessage({event:'graph',graph});
    let point=input;
    if(data.solve) {
      await ca.load_nlpsol('sqpmethod');
      const nlp=g?{x,f,g}:{x,f};
      const solver=ca.nlpsol('solver','sqpmethod',nlp,{
        qpsol:'qrqp',print_header:false,print_iteration:false,print_status:false,print_time:false,
        qpsol_options:{print_header:false,print_iter:false}
      });
      const solution=solver.call(g?{x0:input,lbg:ca.DM(0),ubg:ca.DM(0)}:{x0:input});
      if(!solver.stats().success)throw Error('Optimization did not converge: '+solver.stats().return_status);
      point=solution.x;
    }
    const values=model.call([point]);
    const tracePath=fs.readdir('/').find(name=>/^model\..*\.trace\.jsonl$/.test(name));
    if(data.trace && !tracePath)throw Error('Trace missing: '+fs.readdir('/').join(', '));
    const trace=data.trace?fs.readFile('/'+tracePath,{encoding:'utf8'}):null;
    self.postMessage({event:'result',point:point.nonzeros(),values:values.map(v=>v.nonzeros()),trace});
  }catch(error){self.postMessage({event:'error',message:error.message||String(error)});}
};
