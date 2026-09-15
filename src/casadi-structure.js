import {OP} from './casadi-ops.js';
const names=new Map(Object.entries(OP).map(([name,id])=>[id,name]));
const field=(object,name)=>object.fields.find(f=>f.name===name)?.value;
const ref=value=>value?.$ref??null;
function expand(slice){
  const {start,stop,step}=slice;
  if(!step)throw Error('Zero slice step');
  const n=Math.max(0,Math.ceil((stop-start)/step));
  if(n>1000000)throw Error('Mapping too large to visualize');
  return Array.from({length:n},(_,i)=>start+i*step);
}
function scalar(value){
  if(value && typeof value==='object') {
    if('$integer' in value)return value.$integer;
    if('$float' in value)return value.$float;
    throw Error('Expected a scalar constant in serialized graph');
  }
  return String(value);
}
function slice(value){return Object.fromEntries(value.fields.map(f=>[f.name.split('::').at(-1),f.value]));}
/** Interpret serialized MX/SX layouts for visualization, independently of the reader. */
export function toMXDocument(document){
  if(document.format!=='casadi_serialization'||document.version!==1)throw Error('Expected casadi_serialization version 1');
  if(!Array.isArray(document.objects)||!Array.isArray(document.roots)||document.roots.length!==1)
    throw Error('Visualization requires one shared Function root; serialized structure remains available');
  const objects=document.objects.map((object,serialized_ref)=>{
    if(object.type==='Sparsity'){
      const v=field(object,'SparsityInternal::compressed');
      return v.length?{kind:'sparsity',shape:v.slice(0,2),colind:v.slice(2,3+v[1]),row:v.slice(3+v[1])}:null;
    }
    if(object.type==='Function'){
      if(field(object,'Function::null'))return null;
      const type=field(object,'FunctionInternal::base_function');

      const grouped=new Map();
      for(const f of object.fields){if(!grouped.has(f.name))grouped.set(f.name,[]);grouped.get(f.name).push(f.value);}
      const all=name=>grouped.get(name)||[];
      const atomOp=all('SXFunction::ScalarAtomic::op'),atomI0=all('SXFunction::ScalarAtomic::i0'),atomI1=all('SXFunction::ScalarAtomic::i1'),atomI2=all('SXFunction::ScalarAtomic::i2');
      const nodes=all('MXFunction::alg::data'),args=all('MXFunction::alg::arg'),res=all('MXFunction::alg::res');
      return {kind:'function',name:field(object,'ProtoFunction::name'),type,serialized_ref,
        model_path:field(object,'OnnxFunction::model_path'),
        class_name:object.layouts?.find(layout=>layout.endsWith('::serialize_body'))?.split('::')[0]||type,
        atoms:type==='SXFunction'?atomOp.map((op,i)=>({op,i0:atomI0[i],i1:atomI1[i],i2:atomI2[i]})):undefined,
        sxCalls:all('SXFunction::call_el_f').map((f,i)=>({callee:ref(f),arg:all('SXFunction::call_el_dep')[i],res:all('SXFunction::call_el_res')[i]})),
        inputSymbols:type==='SXFunction'?field(object,'XFunction::in').map(m=>
          field(m,'Matrix::nonzeros').map(r=>field(document.objects[ref(r)],'SymbolicSX::name'))):undefined,
        ins:field(object,'FunctionInternal::sp_in').map(ref),outs:field(object,'FunctionInternal::sp_out').map(ref),
        inputNames:field(object,'FunctionInternal::name_in'),outputNames:field(object,'FunctionInternal::name_out'),
        inputNodes:type==='MXFunction'?field(object,'XFunction::in').map(ref):[],
        instructions:nodes.map((node,i)=>({node:ref(node),arg:args[i],res:res[i]}))};
    }
    if(object.type==='SXElem'){
      const op=field(object,'SXNode::op');
      const node={kind:'mx',op,info:{},sp:document.objects.length,
        deps:op===OP.call?(field(object,'CallSX::dep')||[]).map(ref):
          ['UnarySX::dep','UnarySX::dep0','UnarySX::dep1','OutputSX::dep'].flatMap(key=>{
            const value=field(object,key);return value===undefined?[]:[ref(value)];
          })};
      if(op===OP.parameter)node.symbol=field(object,'SymbolicSX::name');
      const outputSparsities=field(object,'Split::output_sparsity');
    if(outputSparsities)node.outputSparsities=outputSparsities.map(ref);
    if(op===OP.call)node.callee=ref(field(object,'CallSX::f'));
      if(op===-1)node.output_index=field(object,'OutputSX::oind');
      if(op===OP.const){
        const subtype=field(object,'ConstantSX::type');
        const values={48:0,49:1,109:-1,110:'NaN',102:'Infinity',70:'-Infinity'};
        node.constants=[scalar(Object.hasOwn(values,subtype)?values[subtype]:field(object,'ConstantSX::value'))];
      }
      return node;
    }
    if(object.type!=='MX')return null;
    const op=field(object,'MXNode::op'),info={},node={kind:'mx',op,operation:names.get(op),
      deps:field(object,'MXNode::deps').map(ref),sp:ref(field(object,'MXNode::sp')),info};
    const outputSparsities=field(object,'Split::output_sparsity');
    if(outputSparsities)node.outputSparsities=outputSparsities.map(ref);
    if(op===OP.call)node.callee=ref(field(object,'Call::fcn'));
    if(op===-1)node.output_index=field(object,'OutputNode::oind');
    if(op===OP.parameter)node.symbol=field(object,'SymbolicMX::name');
    if(op===OP.input||op===OP.output)for(const key of ['ind','segment','offset'])info[key]=field(object,'IOInstruction::'+key);
    if([OP.getnonzeros,OP.setnonzeros,OP.addnonzeros].includes(op)){
      const stem=op===OP.getnonzeros?'GetNonzeros':'SetNonzeros';
      const subtype=field(object,stem+'::type');
      if(subtype===97){info.nz=field(object,stem+'Vector::nonzeros');node.mapping=info.nz;}
      else if(subtype===98){info.slice=slice(field(object,stem+'Slice::slice'));node.mapping=expand(info.slice);}
      else if(subtype===99){
        info.inner=slice(field(object,stem+'Slice2::inner'));info.outer=slice(field(object,stem+'Slice2::outer'));
        const inner=expand(info.inner),outer=expand(info.outer);
        if(inner.length*outer.length>1000000)throw Error('Mapping too large to visualize');
        node.mapping=outer.flatMap(o=>inner.map(i=>i+o));
      }
      if(op!==OP.getnonzeros)info.add=op===OP.addnonzeros;
    }
    if(op===OP.const){
      const subtype=field(object,'ConstantMX::type');
      if(subtype===97)node.constants=field(object,'ConstantMX::nonzeros').map(scalar);
      else{
        const constants={48:0,49:1,45:-1};
        const value=Object.hasOwn(constants,subtype)?constants[subtype]:field(object,'Constant::value');
        node.scalarConstant=scalar(value);
      }
    }
    return node;
  });
  objects.push({kind:'sparsity',shape:[1,1],colind:[0,1],row:[0]});
  for(const node of objects)if(node?.kind==='mx'){
    if(objects[node.sp]===null)node.sp=null;
    if(node.scalarConstant!==undefined){node.constants=Array(objects[node.sp].row.length).fill(node.scalarConstant);delete node.scalarConstant;}
  }
  let root=document.root;
  if(root===null || objects[root]?.kind!=='function'){
    const roots=Array.isArray(document.roots[0])?document.roots[0]:document.roots;
    const sx=roots.length>0 && roots[0]?.type==='SX';
    const outputs=roots.map(value=>sx?{
      sp:ref(field(value,'Matrix::sparsity')),nodes:field(value,'Matrix::nonzeros').map(ref)
    }:{sp:objects[ref(value)]?.sp,nodes:[ref(value)]});
    if(outputs.some(o=>o.sp===undefined||o.nodes.some(n=>objects[n]?.kind!=='mx')))
      throw Error('Expected MX or SX expressions');
    const instructions=[],slots=new Map(),inputNodes=[],ins=[];
    let nextSlot=0;
    // Iterative postorder preserves sharing without a JavaScript recursion limit.
    for(const output of outputs)for(const start of output.nodes){
      const stack=[[start,false]];
      while(stack.length){
        const [id,ready]=stack.pop();if(slots.has(id))continue;
        const node=objects[id];
        if(!ready){stack.push([id,true]);for(const dep of [...node.deps].reverse())if(!slots.has(dep))stack.push([dep,false]);continue;}
        if(node.op===-1){slots.set(id,[slots.get(node.deps[0])[node.output_index]]);continue;}
        const arg=node.deps.map(dep=>slots.get(dep)[0]);
        const callee=node.callee===undefined?null:objects[node.callee];
        const count=callee?(sx?callee.outs.reduce((sum,sp)=>sum+objects[sp].row.length,0):callee.outs.length):node.outputSparsities?.length??1;
        const res=Array.from({length:count},()=>nextSlot++);slots.set(id,res);
        let instructionNode=id;
        if(node.op===OP.parameter){
          instructionNode=objects.length;
          objects.push({...node,op:OP.input,info:{ind:ins.length,offset:0}});
          ins.push(node.sp);inputNodes.push(id);
        }
        instructions.push({node:instructionNode,arg,res});
      }
    }
    outputs.forEach((output,ind)=>output.nodes.forEach((id,offset)=>{
      const node=objects.length;
      objects.push({kind:'mx',op:OP.output,sp:objects[id].sp,deps:[id],info:{ind,offset}});
      instructions.push({node,arg:[slots.get(id)[0]],res:[]});
    }));
    root=objects.length;
    objects.push({kind:'function',name:'expression',type:sx?'SX':'MX',expression:true,
      scalarCalls:sx,ins,outs:outputs.map(o=>o.sp),inputNodes,
      inputNames:inputNodes.map(id=>objects[id].symbol),outputNames:outputs.map((_,i)=>'o'+i),instructions});
  }
  return {format:'casadi_json',version:1,root,objects,serialization:document};
}
