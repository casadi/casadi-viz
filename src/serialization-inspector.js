/** Generic inspection of typed reader records. No option-name catalogue. */
export function serializationInspector(document, reference, formatNumber=String) {
  const updates=[];
  const host=element('div','serialization-inspector');
  const note=element('p','hint','Serialized values include option settings and internal state.');
  const search=element('input','settings-search');search.type='search';search.placeholder='Search fields';search.setAttribute('aria-label','Search Function fields');
  const results=element('div');host.append(note,search,results);
  const record=document.objects[reference];
  function element(tag,className='',text) {const node=window.document.createElement(tag);node.className=className;if(text!==undefined)node.textContent=text;return node;}
  const primitive=v=>v===null?'null':typeof v==='string'?JSON.stringify(v):typeof v==='number'?formatNumber(v):String(v);
  function entries(value,seen) {
    if(value && typeof value==='object' && '$ref' in value){
      const index=value.$ref,target=document.objects[index];
      if(!target)return {label:'Unavailable shared reference'};
      if(seen.has(index))return {label:target.type+' (reference already shown)'};
      return {label:target.type,values:()=>fields(target.fields,new Set([...seen,index]))};
    }
    if(value?.kind==='deferred_bytes')return {label:'Deferred bytes'};
    if(value && typeof value==='object' && ('$integer' in value || '$float' in value))return {label:value.$integer??value.$float};
    if(Array.isArray(value))return {label:`${value.length} entries`,values:()=>paged(value,(v,i)=>row(String(i),v,seen))};
    if(value?.$map)return {label:`${value.$map.length} entries`,values:()=>paged(value.$map,([k,v])=>row(typeof k==='string'?k:JSON.stringify(k),v,seen))};
    if(value?.fields)return {label:value.type,values:()=>fields(value.fields,seen)};
    if(value && typeof value==='object')return {label:'Object',values:()=>paged(Object.entries(value),([k,v])=>row(k,v,seen))};
    return {label:primitive(value)};
  }
  function row(name,value,seen,type) {
    const container=element('div','setting-row');
    const label=element('div','setting-name',name);if(type)label.title=type;
    const item=entries(value,seen);
    if(item.values){
      const detail=element('details','setting-value'),summary=element('summary','',item.label);detail.append(summary);
      detail.addEventListener('toggle',()=>{if(detail.open&&!detail.dataset.loaded){detail.dataset.loaded='true';detail.append(item.values());}});
      container.append(label,detail);
    }else {
      const display=element('div','setting-value',item.label);
      if(typeof value==='number')updates.push(()=>{display.textContent=formatNumber(value);});
      container.append(label,display);
    }
    return container;
  }
  function paged(values,render) {
    const box=element('div'),more=element('button','settings-more','Show more');let count=0;
    function add(){more.remove();const end=Math.min(count+50,values.length);for(;count<end;count++)box.append(render(values[count],count));if(count<values.length)box.append(more);}
    more.onclick=add;add();return box;
  }
  function fields(values,seen){return paged(values,f=>row(f.name,f.value,seen,f.type));}
  function refresh(){
    updates.length=0;results.replaceChildren();const query=search.value.trim().toLowerCase(),groups=new Map();
    for(const f of record.fields){
      if(query&&!`${f.name} ${f.type} ${typeof f.value==='object'?'':f.value}`.toLowerCase().includes(query))continue;
      const owner=f.name.includes('::')?f.name.split('::')[0]:record.type;
      if(!groups.has(owner))groups.set(owner,[]);groups.get(owner).push(f);
    }
    if(!groups.size)results.append(element('p','hint','No matching fields.'));
    for(const [owner,values] of groups){
      const group=element('details','settings-group'),summary=element('summary','',`${owner} (${values.length})`);group.append(summary);
      let loaded=false;const populate=()=>{if(group.open&&!loaded){loaded=true;group.append(fields(values,new Set([reference])));}};
      group.addEventListener('toggle',populate);group.open=!!query||values.length<=80;populate();results.append(group);
    }
  }
  host.updateNumbers=()=>updates.forEach(update=>update());
  search.oninput=refresh;refresh();return host;
}
