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
/** Interpret serialized MX layouts for visualization, independently of the reader. */
export function toMXDocument(document){
  if(document.format!=='casadi_serialization'||document.version!==1)throw Error('Expected casadi_serialization version 1');
  if(!Array.isArray(document.objects)||!Array.isArray(document.roots)||document.roots.length!==1||!Number.isInteger(document.root))
    throw Error('Visualization requires one shared Function root; serialized structure remains available');
  const objects=document.objects.map(object=>{
    if(object.type==='Sparsity'){
      const v=field(object,'SparsityInternal::compressed');
      return v.length?{kind:'sparsity',shape:v.slice(0,2),colind:v.slice(2,3+v[1]),row:v.slice(3+v[1])}:null;
    }
    if(object.type==='Function'){
      if(field(object,'Function::null'))return null;
      const type=field(object,'FunctionInternal::base_function');
      if(type!=='MXFunction')return {kind:'function',type,name:field(object,'ProtoFunction::name')};
      const all=name=>object.fields.filter(f=>f.name===name).map(f=>f.value);
      const nodes=all('MXFunction::alg::data'),args=all('MXFunction::alg::arg'),res=all('MXFunction::alg::res');
      return {kind:'function',name:field(object,'ProtoFunction::name'),type,
        ins:field(object,'FunctionInternal::sp_in').map(ref),outs:field(object,'FunctionInternal::sp_out').map(ref),
        inputNames:field(object,'FunctionInternal::name_in'),outputNames:field(object,'FunctionInternal::name_out'),
        inputNodes:field(object,'XFunction::in').map(ref),
        instructions:nodes.map((node,i)=>({node:ref(node),arg:args[i],res:res[i]}))};
    }
    if(object.type!=='MX')return null;
    const op=field(object,'MXNode::op'),info={},node={kind:'mx',op,operation:names.get(op),
      deps:field(object,'MXNode::deps').map(ref),sp:ref(field(object,'MXNode::sp')),info};
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
  for(const node of objects)if(node?.kind==='mx'){
    if(objects[node.sp]===null)node.sp=null;
    if(node.scalarConstant!==undefined){node.constants=Array(objects[node.sp].row.length).fill(node.scalarConstant);delete node.scalarConstant;}
  }
  const root=objects[document.root];
  if(root?.type!=='MXFunction')throw Error('Visualization currently requires MXFunction; serialized structure remains available');
  return {format:'casadi_json',version:1,root:document.root,objects};
}
