/** Convert evaluator nonzero indices to zero-based matrix coordinates. */
export function entryMapping(node) {
  if(!node.mapping_kind || !node.mapping)return null;
  const extract=node.mapping_kind==='extract',input=extract?0:1;
  const source=node.inputs[input],target=node.outputs[0];
  const coordinate=(sp,index)=>{
    if(index<0)return null;
    let col=0;
    while(col+1<sp.colind.length && sp.colind[col+1]<=index)col++;
    return [sp.row[index],col];
  };
  return {input,source,target,kind:node.mapping_kind,rows:node.mapping.map((mapped,i)=>{
    const from=extract?mapped:i,to=extract?i:mapped;
    return {from,to,source:coordinate(source,from),target:coordinate(target,to)};
  })};
}
