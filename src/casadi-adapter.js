import {OP} from './casadi-ops.js';
import {toMXDocument} from './casadi-structure.js';
import {validateBundle} from './validate.js';
const names=new Map(Object.entries(OP).map(([name,id])=>[id,name]));
const unary=new Set(['neg','exp','log','sqrt','sq','twice','sin','cos','tan','asin','acos','atan',
  'not','floor','ceil','fabs','sign','erf','inv','sinh','cosh','tanh','asinh','acosh','atanh'].map(n=>OP[n]));
const binary=new Set(['add','sub','mul','div','pow','constpow','lt','le','eq','ne','and','or',
  'fmod','copysign','if_else_zero','fmin','fmax','atan2'].map(n=>OP[n]));
const symbols={add:'+',sub:'-',mul:'*',div:'/',neg:'-',sq:'(.)^2',twice:'2*(.)',inv:'1/(.)'};
export function toGraphBundle(document){
  if(document.format==='casadi_serialization')document=toMXDocument(document);
  if(document.format!=='casadi_json'||document.version!==1)throw Error('Expected casadi_json version 1');
  const objects=document.objects.map(o=>({...o}));
  const get=id=>id===null?null:objects[id];
  for(const object of objects){
    if(object.kind==='sparsity')continue;
    if(object.kind==='mx'){object.deps=object.deps.map(get);object.sp=get(object.sp);
      if(object.outputSparsities)object.outputSparsities=object.outputSparsities.map(get);}
    if(object.kind==='function'){
      object.ins=object.ins.map(get);object.outs=object.outs.map(get);object.inputNodes=object.inputNodes.map(get);
      object.instructions=object.instructions.map(i=>({...i,node:get(i.node)}));
    }
  }
  const functions=[],indices=new Map();
  function build(f){
    if(indices.has(f))return indices.get(f);
    const index=functions.length;indices.set(f,index);functions.push(null);
    const scalar={shape:[1,1],colind:[0,1],row:[0]};
    if(f.atoms)f.instructions=f.atoms.map(a=>{
      let arg=[],res=[a.i0],info={},constants=[],callee;
      if(a.op===OP.input)info={ind:a.i1,offset:a.i2};
      else if(a.op===OP.output){info={ind:a.i0,offset:a.i2};arg=[a.i1];res=[];}
      else if(a.op===OP.const){const bits=new DataView(new ArrayBuffer(8));bits.setInt32(0,a.i1,true);bits.setInt32(4,a.i2,true);constants=[String(bits.getFloat64(0,true))];}
      else if(a.op===OP.call){const call=f.sxCalls[a.i1];if(!call)throw Error('Missing serialized SX call');({arg,res,callee}=call);}
      else if(unary.has(a.op)||a.op===OP.assign)arg=[a.i1];
      else if(binary.has(a.op))arg=[a.i1,a.i2];
      else throw Error('Unsupported SX instruction '+names.get(a.op));
      return {node:{op:a.op,info,sp:scalar,deps:arg.map(()=>({sp:scalar})),constants,callee},arg,res};
    });
    const nodes=[],edges=[],producer=new Map();
    for(const [id,{node:n,arg,res}] of f.instructions.entries()){
      const label=names.get(n.op),input=n.op===OP.input,output=n.op===OP.output;
      const kind=n.op===OP.call?'call':input?'input':output?'output':n.op===OP.parameter?'symbol':n.op===OP.const?'constant':'operation';
      const io=n.info.ind,offset=n.info.offset||0;
      const callee=n.callee===undefined?null:get(n.callee);
      const inputs=input?[]:n.deps.map(d=>d.sp),outputs=output?[]:callee?((f.atoms||f.scalarCalls)?res.map(()=>scalar):callee.outs):(n.outputSparsities||[n.sp]);
      const input_names=inputs.map((_,i)=>'arg'+i),output_names=outputs.map((_,i)=>'out'+i);
      if(n.op===OP.mtimes)input_names.splice(0,3,'accumulator','left','right');
      if(n.op===OP.getnonzeros)input_names[0]='source';
      if(n.op===OP.setnonzeros||n.op===OP.addnonzeros)input_names.splice(0,2,'base','values');
      const display=callee?callee.name+(callee.model_path?' ['+callee.model_path.split(/[\\/]/).at(-1)+']':''):input?f.inputNames[io]:output?f.outputNames[io]:symbols[label]||label;
      const node={id,op:n.op,label:input||output?display:label,kind,display,formula:display,expression:display,
        binary:binary.has(n.op),ordered:inputs.length>1&&![OP.add,OP.mul,OP.eq,OP.ne,OP.and,OP.or,OP.fmin,OP.fmax].includes(n.op),
        inputs,outputs,input_names,output_names,constants:(n.constants||[]).map(String),info:n.info};
      if(callee){
        if(['MXFunction','SXFunction'].includes(callee.type))node.callee=build(callee);
        node.callee_type=callee.class_name||callee.type;
        if(Number.isInteger(callee.serialized_ref))node.callee_serialized_ref=callee.serialized_ref;
        if(callee.model_path)node.model_path=callee.model_path;
        node.input_names=f.scalarCalls?input_names:callee.inputNames;
        node.output_names=f.scalarCalls?output_names:callee.outputNames;
      }
      if(input||output){node.io_index=io;node.io_offset=offset;}
      if(input)node.symbol=f.inputSymbols?.[io]?.[offset]||f.inputNodes[io]?.symbol||f.inputNames[io];
      if(kind==='symbol')node.display=node.symbol=n.symbol;
      if(kind==='constant')node.display=node.constants.length===1?node.constants[0]:'constant';
      if(n.mapping){node.mapping=n.mapping;node.mapping_kind=n.op===OP.getnonzeros?'extract':n.op===OP.addnonzeros?'add':'assign';}
      if(!input)for(const [i,slot] of arg.entries()){
        if(slot<0)continue;const from=producer.get(slot);if(!from)throw Error(`Missing producer for instruction ${id}`);
        edges.push({from:from.id,output:from.port,to:id,input:i});
      }
      if(!output)for(const [port,slot] of res.entries())if(slot>=0)producer.set(slot,{id,port});
      nodes.push(node);
    }
    functions[index]={version:1,name:f.name,type:f.type,direction:'TB',serialized_ref:f.serialized_ref,
      inputs:f.ins.map((sparsity,i)=>({name:f.inputNames[i],sparsity})),
      outputs:f.outs.map((sparsity,i)=>({name:f.outputNames[i],sparsity})),nodes,edges};
    return index;
  }
  build(get(document.root));
  return validateBundle({...functions[0],format:'casadi_viz',view:get(document.root).expression?'expression':'function',functions:functions.slice(1),
    ...(document.serialization?{serialization:document.serialization}:{})});
}
