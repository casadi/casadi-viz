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

/** Show matrix slicing only when it exactly explains the nonzero mapping. */
export function indexingLabel(node) {
  if(!node.mapping_kind||!node.mapping?.length)return null;
  const extract=node.mapping_kind==='extract',large=extract?node.inputs[0]:node.outputs[0],small=extract?node.outputs[0]:node.inputs[1];
  if(!large||!small)return null;
  const column=(sp,index)=>{
    let low=0,high=sp.shape[1];
    while(low<high){const mid=Math.floor((low+high)/2);if(sp.colind[mid+1]<=index)low=mid+1;else high=mid;}
    return low;
  };
  const rows=new Array(small.shape[0]),cols=new Array(small.shape[1]);
  let valid=node.mapping.length===small.row.length;
  for(let k=0;valid&&k<node.mapping.length;k++){
    const mapped=node.mapping[k];
    if(!Number.isInteger(mapped)||mapped<0||mapped>=large.row.length){valid=false;break;}
    const r=small.row[k],c=column(small,k),br=large.row[mapped],bc=column(large,mapped);
    if((rows[r]!==undefined&&rows[r]!==br)||(cols[c]!==undefined&&cols[c]!==bc))valid=false;
    rows[r]=br;cols[c]=bc;
  }
  // Empty rows/columns do not identify a slice; an identity axis is safe to try
  // when dimensions agree, provided the complete sparsity/mapping check passes.
  for(const [axis,size] of [[rows,large.shape[0]],[cols,large.shape[1]]]){
    for(let i=0;i<axis.length;i++)if(axis[i]===undefined){if(axis.length===size)axis[i]=i;else valid=false;}
  }
  if(valid){
    const inverse=new Map();rows.forEach((r,i)=>{if(!inverse.has(r))inverse.set(r,[]);inverse.get(r).push(i);});
    for(let c=0;valid&&c<cols.length;c++){
      const expected=[];
      for(let k=large.colind[cols[c]];k<large.colind[cols[c]+1];k++)for(const r of inverse.get(large.row[k])||[])expected.push([r,k]);
      expected.sort((a,b)=>a[0]-b[0]);
      if(expected.length!==small.colind[c+1]-small.colind[c]){valid=false;break;}
      for(let i=0;i<expected.length;i++){const k=small.colind[c]+i;if(expected[i][0]!==small.row[k]||expected[i][1]!==node.mapping[k]){valid=false;break;}}
    }
  }
  const axis=(values,size)=>{
    if(values.length===size&&values.every((v,i)=>v===i))return ':';
    if(values.length===1)return String(values[0]);
    const step=values[1]-values[0];
    if(step!==0&&values.every((v,i)=>v===values[0]+step*i)){
      const end=values.at(-1),stop=step>0?end+1:end===0?'':end-1;
      return `${values[0]}:${stop}${step===1?'':':'+step}`;
    }
    return '['+values.join(',')+']';
  };
  const slice=valid?`.[${axis(rows,large.shape[0])},${axis(cols,large.shape[1])}]`:null;
  if(!slice||slice.length>64)return null;
  return slice+(extract?'':node.mapping_kind==='add'?' += .':' = .');
}
