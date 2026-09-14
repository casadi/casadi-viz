// Derived from CasADi's graph viewer. LGPL-3.0-or-later.
import css from './viewer.css';
import template from './template.html';
import {validateBundle} from './validate.js';
import {entryMapping} from './mapping.js';

/** Mount a viewer. Graphs are plain casadi_viz bundles; no CasADi runtime is required. */
export function createGraphViewer(host, options={}) {
  if(!host || typeof host.attachShadow!=='function')throw new TypeError('Expected a host element');
  const container=host.shadowRoot || host.attachShadow({mode:'open'});
  const runtime=options.runtime || {url:new URL('./viz-global.js', import.meta.url).href};
  let session=null, destroyed=false;
  return {
    async setGraph(bundle) {
      if(destroyed)throw Error('Viewer has been destroyed');
      const root=validateBundle(typeof bundle==='string'?JSON.parse(bundle):bundle);
      session?.destroy();
      container.innerHTML='<style>'+css+'</style>'+template;
      session=mount(container,root,runtime);
      return session.ready;
    },
    async loadTrace(trace) {
      if(!session || destroyed)throw Error('Load a graph before loading a trace');
      return session.loadTrace(trace);
    },
    setView(view) {
      if(!session || destroyed)throw Error('Load a graph before selecting a view');
      session.setView(view);
    },
    destroy() {session?.destroy();session=null;destroyed=true;container.replaceChildren();}
  };
}

function mount(container, root, runtime) {
  let resolveReady,rejectReady;
  const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  const models=[root,...(root.functions||[])];
  let model=root;
  const $ = id => container.querySelector('#'+id);
  const setStatus = (text, kind='') => { $('status').textContent=text; $('status').className=kind; };
  let svg=null, initialView=null, trace=null, cursor=0, selected=null, timer=null, traceEnabled=false, showContents=true, showSizes=true;
  let viewMode=root.view||'function';
  let trail=[{model,viewMode,trace:null,cursor:0,selected:null,traceName:''}];
  const elements=new Map(), valueElements=new Map();
  let selectionTimer=null;
  const formatNumber = n => typeof n==='number' ? (Object.is(n,-0) ? '-0' : Number(n.toPrecision(7)).toString()) : n;
  const shortValues = values => values.map(v => v===null ? 'unused' : '['+v.slice(0,3).map(formatNumber).join(', ')+(v.length>3 ? ', \u2026' : '')+']').join(' ; ');
  function stop() { clearInterval(timer); timer=null; $('play').textContent='Play'; }
  function controls() {
    const count=trace ? trace.count : 0;
    $('start').disabled=$('back').disabled=!trace || cursor===0;
    $('next').disabled=$('end').disabled=!trace || cursor===count;
    $('play').disabled=!trace || count===0;
    $('timeline').disabled=!trace;
    $('timeline').max=count; $('timeline').value=cursor;
    $('step-label').textContent=trace ? `${cursor.toLocaleString()} / ${count.toLocaleString()}` : 'No trace loaded';
  }
  function portList(title, shapes, values, names, constant=false) {
    const section=document.createElement('section'), heading=document.createElement('h3');
    heading.textContent=title; section.append(heading);
    if (!shapes.length) { const p=document.createElement('div'); p.className='hint'; p.textContent='None'; section.append(p); }
    shapes.forEach((sp,i) => {
      const port=document.createElement('div'); port.className='port';
      const label=document.createElement('div'); label.className='port-title';
      label.textContent=`${names[i]}${showSizes?' \u00b7 '+sp.shape.join('-by-'):''} \u00b7 ${sp.row.length} nonzeros`;
      const value=document.createElement('div'); value.className='port-value';
      value.textContent=values===undefined ? (traceEnabled ? 'Not evaluated' : '') : values[i]===null ? 'Unused / absent buffer' : '['+values[i].map(n=>Object.is(n,-0)?'-0':String(n)).join(', ')+']';
      port.append(label,value);
      if (showContents && sp.shape[0]*sp.shape[1]!==1) port.append(matrix(sp,values?.[i],constant));
      if (sp.row.length!==sp.shape[0]*sp.shape[1]) {
        const detail=document.createElement('details'), summary=document.createElement('summary'), pattern=document.createElement('pre');
        summary.textContent='Sparsity'; pattern.textContent='colind: '+JSON.stringify(sp.colind)+'\nrow: '+JSON.stringify(sp.row);
        detail.append(summary,pattern); port.append(detail);
      }
      section.append(port);
    });
    return section;
  }
  function matrix(sp, values, constant) {
    const wrap=document.createElement('div'); wrap.className='matrix-wrap';
    const table=document.createElement('table'); table.className='matrix';
    const lookup=new Map();
    for(let c=0;c<Math.min(8,sp.shape[1]);c++)for(let k=sp.colind[c];k<sp.colind[c+1];k++){
      if(sp.row[k]<8)lookup.set(sp.row[k]+','+c,k);
    }
    for(let r=0;r<Math.min(8,sp.shape[0]);r++){
      const row=table.insertRow();
      for(let c=0;c<Math.min(8,sp.shape[1]);c++){
        const cell=row.insertCell(), k=lookup.get(r+','+c);cell.className=k===undefined?'zero':'nz';
        if(!constant)cell.classList.add('spy');
        cell.textContent=constant?(k===undefined?'.':String(values[k])):'';
        if(k!==undefined)cell.dataset.nonzero=k;
        cell.title=k===undefined?'Structural zero':`Row ${r}, column ${c}, nonzero ${k}`;
      }
    }
    wrap.append(table);
    if(sp.shape.some(n=>n>8)) {const note=document.createElement('div');note.className='hint';note.textContent='Showing the first 8 rows / columns. Full sparsity below.';wrap.append(note);}
    return wrap;
  }
  function mappingView(mapping,node) {
    const section=document.createElement('section');section.className='entry-mapping';
    const heading=document.createElement('h3');heading.textContent='Entry mapping';
    const note=document.createElement('p');note.className='hint';
    note.textContent=(mapping.kind==='extract'?'Selected source entries become the output.':
      mapping.kind==='assign'?'Values replace the highlighted entries; other base entries are retained.':
      'Values are added to the highlighted base entries; other entries are retained.')+' Coordinates are zero-based.';
    section.append(heading,note);
    const grids=document.createElement('div');grids.className='mapping-grids';
    const edge=model.edges.find(e=>e.to===node.id && e.input===mapping.input);
    const producer=edge && model.nodes[edge.from];
    const source=matrix(mapping.source,producer?.constants,producer?.kind==='constant');
    const target=matrix(mapping.target,undefined,false);
    for(const [name,grid] of [[node.input_names[mapping.input],source],['output',target]]) {
      const group=document.createElement('div'),label=document.createElement('div');
      label.className='port-title';label.textContent=name;group.append(label,grid);grids.append(group);
    }
    if(showContents)section.append(grids);
    const table=document.createElement('table');table.className='mapping-table';
    const header=table.createTHead().insertRow();
    for(const label of [node.input_names[mapping.input],mapping.kind==='add'?'+= output':'→ output']) {
      const cell=document.createElement('th');cell.textContent=label;header.append(cell);
    }
    const coordinate=p=>p?'['+p.join(', ')+']':'—';
    const highlight=rows=>{
      grids.querySelectorAll('.mapped').forEach(cell=>cell.classList.remove('mapped'));
      for(const row of rows)for(const [grid,index] of [[source,row.from],[target,row.to]]) {
        grid.querySelector(`[data-nonzero="${index}"]`)?.classList.add('mapped');
      }
    };
    for(const entry of mapping.rows.slice(0,128)) {
      const row=table.insertRow();row.tabIndex=0;
      row.insertCell().textContent=entry.source?coordinate(entry.source):'0 (structural zero)';
      row.insertCell().textContent=entry.target?coordinate(entry.target):'ignored';
      row.onmouseenter=row.onfocus=()=>highlight([entry]);
      row.onmouseleave=row.onblur=()=>highlight(mapping.rows);
    }
    highlight(mapping.rows);section.append(table);
    if(mapping.rows.length>128){const more=document.createElement('p');more.className='hint';more.textContent='Showing the first 128 mappings.';section.append(more);}
    return section;
  }
  function inspect() {
    if (selected===null) return;
    const node=model.nodes[selected], shown=traceEnabled && trace && selected<cursor;
    $('selection-title').textContent=viewMode==='expression' && node.kind==='input' ? node.symbol : viewMode==='function' && ['input','output'].includes(node.kind) ? model[node.kind+'s'][node.io_index].name : node.display;
    const panel=$('inspector'); panel.replaceChildren();
    if(traceEnabled){
      const state=document.createElement('div');state.className='state';
      state.textContent=shown ? trace.after[selected]===undefined ? 'Interrupted' : 'Evaluated' : 'Not evaluated';panel.append(state);
    }
    const expression=document.createElement('pre'); expression.textContent=node.formula;
    if(node.callee!==undefined){
      const enter=document.createElement('button');enter.id='enter-function';enter.textContent='Step into '+node.display;enter.onclick=()=>enterFunction(node.id);panel.append(enter);
    } else if(node.kind==='call'){
      const note=document.createElement('p');note.className='hint';note.textContent='No internal graph was included for this '+node.callee_type+'.';panel.append(note);
    }
    panel.append(expression,portList('Inputs',node.inputs,shown?trace.before[selected]:undefined,node.input_names),portList('Outputs',node.outputs,shown?trace.after[selected]:node.kind==='constant'?[node.constants]:undefined,node.output_names,node.kind==='constant'));
    const mapping=entryMapping(node);
    if(mapping)panel.prepend(mappingView(mapping,node));
    else if(node.mapping){
      const heading=document.createElement('h3'),detail=document.createElement('pre');
      heading.textContent='Nonzero mapping';detail.textContent=node.mapping.map((v,i)=>`${i}: ${v}`).join(', ');
      panel.append(heading,detail);
    }
    const detail=document.createElement('details'),summary=document.createElement('summary'),instruction=document.createElement('pre');
    summary.textContent='Evaluator expression';instruction.textContent=node.expression;detail.append(summary,instruction);panel.append(detail);
  }
  function select(id) {
    if (selected!==null) {
      elements.get(selected)?.classList.remove('active');
      for(const v of valueElements.get(selected)||[])v.element.classList.remove('active');
    }
    selected=id; elements.get(id)?.classList.add('active');
    for(const v of valueElements.get(id)||[])v.element.classList.add('active');
    $('details').hidden=false;inspect();
  }
  $('close-inspector').onclick=()=>{
    elements.get(selected)?.classList.remove('active');
    for(const v of valueElements.get(selected)||[])v.element.classList.remove('active');
    selected=null;$('details').hidden=true;
  };
  function paint(id) {
    const element=elements.get(id);
    const shown=traceEnabled && trace && id<cursor, complete=shown && trace.after[id]!==undefined;
    element?.classList.toggle('executed',!!complete);
    element?.classList.toggle('failed',!!shown && !complete);
    let label=element?.querySelector('.trace-value');
    if (element && !label) {
      label=document.createElementNS('http://www.w3.org/2000/svg','text'); label.classList.add('trace-value');
      const box=element.getBBox(); label.setAttribute('x',box.x+box.width/2); label.setAttribute('y',box.y+box.height+14); label.setAttribute('text-anchor','middle'); element.append(label);
    }
    const values=shown ? (model.nodes[id].kind==='output' ? trace.before[id] : trace.after[id]) : undefined;
    const text=values===undefined ? '' : shortValues(values);
    if(label)label.textContent=text.length>36 ? text.slice(0,35)+'\u2026' : text;
    for(const v of valueElements.get(id)||[]){
      if(v.boundary){paintBoundary(v.boundary);continue;}
      const data=values?.[v.port];
      for(const cell of v.cells)cell.element.textContent=showContents && data ? formatNumber(data[cell.index]) : cell.label;
    }
  }
  function paintBoundary(value) {
    const prefix=Array(Math.min(4,value.sp.row.length)).fill('?');let shown=false;
    for(const owner of value.owners){
      if(!traceEnabled || !trace || owner.node>=cursor)continue;
      const values=(value.boundaryKind==='input'?trace.after[owner.node]:trace.before[owner.node])?.[0];
      if(!values)continue;shown=true;
      for(let i=0;i<values.length && owner.offset+i<prefix.length;i++)prefix[owner.offset+i]=values[i];
    }
    value.traceLabel.textContent=shown?shortValues([prefix]):'';
    value.traceLabel.parentNode.classList.toggle('executed',!!shown && value.owners.every(o=>o.node<cursor && trace.after[o.node]!==undefined));
  }
  $('trace-toggle').onclick=()=>{
    traceEnabled=!traceEnabled;stop();$('trace-toggle').setAttribute('aria-pressed',String(traceEnabled));
    $('toolbar').hidden=!traceEnabled;$('trace-name').hidden=!traceEnabled;
    for(let k=0;k<cursor;k++)paint(k);
    inspect();setStatus(traceEnabled ? (trace?'Trace loaded. Step through the evaluation.':'Load a trace file to replay an evaluation. Files stay in your browser.') : 'Select a node to inspect it. Scroll to zoom; drag to pan.');
  };
  function seek(position, follow=true) {
    const old=cursor; cursor=Math.max(0,Math.min(trace?trace.count:0,position));
    for (let k=Math.min(old,cursor); k<Math.max(old,cursor); k++) paint(k);
    if (follow && cursor>0) {
      let id=cursor-1;
      if(viewMode==='expression' && model.nodes[id].kind==='output')id=model.edges.find(e=>e.to===id)?.from??id;
      select(id);
    } else inspect();
    controls();
    if (trace && cursor===trace.count) stop();
  }
  $('start').onclick=()=>{stop();seek(0);}; $('back').onclick=()=>{stop();seek(cursor-1);};
  $('next').onclick=()=>{stop();seek(cursor+1);}; $('end').onclick=()=>{stop();seek(trace.count);};
  $('timeline').oninput=()=>{stop();seek(Number($('timeline').value));};
  $('play').onclick=()=>{
    if (timer) {stop();return;}
    if (cursor===trace.count) seek(0);
    $('play').textContent='Pause'; timer=setInterval(()=>seek(cursor+1),Number($('speed').value));
  };
  $('speed').onchange=()=>{if(timer){stop();$('play').click();}};

  function validateValues(values, shapes, where) {
    if (!Array.isArray(values) || values.length!==shapes.length) throw Error(where+': wrong number of values');
    values.forEach((v,i)=>{
      if (v===null) return;
      if (!Array.isArray(v) || v.length!==shapes[i].row.length) throw Error(where+': nonzero count does not match the graph');
      for (const n of v) if (!(typeof n==='number' && Number.isFinite(n)) && !['nan','inf','-inf'].includes(n)) throw Error(where+': invalid numerical value');
    });
  }
  async function readTrace(file, graph=model) {
    const parsed={before:[],after:[],count:0,ended:false,status:null};
    let header=false, inputs=false, outputs=false, terminal=false, pending=false, next=0, lineNumber=0;
    function line(text) {
      if (!text.trim()) return;
      lineNumber++;
      const r=JSON.parse(text);
      if (!r || typeof r!=='object' || Array.isArray(r)) throw Error('Expected a trace record');
      if (terminal) throw Error('Unexpected data after trace end');
      if (!header) {
        if (r.event!=='header' || r.format!=='casadi_trace' || r.version!==1) throw Error('Expected a dump_trace JSONL file (version 1)');
        if (r.function!==graph.name || r.type!==graph.type) throw Error('This trace belongs to a different function');
        header=true; return;
      }
      if (!inputs) {
        if (r.event!=='inputs') throw Error('Missing function inputs');
        validateValues(r.values,graph.inputs.map(p=>p.sparsity),'Function inputs'); inputs=true; return;
      }
      if (r.event==='error') {terminal=true;parsed.status='error';return;}
      if (r.event==='outputs') {
        if (pending || next!==graph.nodes.length || outputs) throw Error('Unexpected function outputs');
        validateValues(r.values,graph.outputs.map(p=>p.sparsity),'Function outputs'); outputs=true; return;
      }
      if (r.event==='end') {
        if (!Number.isInteger(r.status)) throw Error('Invalid evaluation status');
        if (r.status===0 && (!outputs || pending || next!==graph.nodes.length)) throw Error('Successful trace is missing instructions');
        parsed.ended=true;parsed.status=r.status;terminal=true;return;
      }
      const k=r.instruction;
      if (outputs || !Number.isInteger(k) || k!==next || k>=graph.nodes.length || r.op!==graph.nodes[k].op) throw Error('Instruction sequence does not match this graph');
      if (r.phase==='inputs' && !pending) {
        validateValues(r.values,graph.nodes[k].inputs,'Instruction '+k+' inputs');
        parsed.before[k]=r.values;parsed.count=k+1;pending=true;
      } else if (r.phase==='outputs' && pending) {
        validateValues(r.values,graph.nodes[k].outputs,'Instruction '+k+' outputs');
        parsed.after[k]=r.values;pending=false;next++;
      } else throw Error('Unexpected instruction phase');
    }
    const reader=file.stream().getReader(), decoder=new TextDecoder(); let remainder='';
    try {
      while (true) {
        const {done,value}=await reader.read(); if (done) break;
        remainder+=decoder.decode(value,{stream:true});
        let start=0, end;
        while ((end=remainder.indexOf('\n',start))!==-1) {line(remainder.slice(start,end));start=end+1;}
        remainder=remainder.slice(start);
      }
      remainder+=decoder.decode(); if(remainder.trim()) line(remainder);
      if (!header || !inputs) throw Error('Incomplete trace header');
    } catch(error) {await reader.cancel();throw Error(`Line ${lineNumber}: ${error.message}`);}
    finally {reader.releaseLock();}
    return parsed;
  }
  let loadNumber=0;
  async function loadTrace(file) {
    if(typeof file==='string')file=new File([file], 'evaluation.trace.jsonl');
    if(!file)return;
    const load=++loadNumber;stop();setStatus('Reading trace\u2026');
    try {
      const parsed=await readTrace(file);if(load!==loadNumber)return;
      const old=cursor;trace=parsed;cursor=0;for(let k=0;k<old;k++)paint(k);
      controls();inspect();$('trace-name').textContent=file.name;
      setStatus(parsed.ended && parsed.status===0 ? 'Trace loaded. Step through the evaluation.' : 'Partial or failed evaluation. Recorded instructions are available.',''+(parsed.ended && parsed.status===0?'':'warning'));
    } catch(error) {if(load===loadNumber)setStatus(error.message,'error');throw error;}
    $('trace-file').value='';
  }
  $('trace-file').onchange=()=>loadTrace($('trace-file').files[0]).catch(()=>{});

  function header() {
    $('view-mode').value=viewMode;
    const nav=$('breadcrumbs');nav.replaceChildren();
    trail.forEach((frame,i)=>{
      if(i){const separator=document.createElement('span');separator.textContent='/';nav.append(separator);}
      const button=document.createElement('button');button.textContent=frame.model.name;button.disabled=i===trail.length-1;
      if(button.disabled){button.id='name';button.setAttribute('aria-current','page');}
      button.onclick=()=>navigate(i);nav.append(button);
    });

    $('meta').textContent=`${model.type} \u00b7 ${model.nodes.length.toLocaleString()} instructions \u00b7 ${model.edges.length.toLocaleString()} connections`;
  }
  function saveFrame() {
    Object.assign(trail[trail.length-1],{viewMode,trace,cursor,selected,traceName:$('trace-name').textContent});
  }
  function activateFrame() {
    stop();++loadNumber;
    ({model,viewMode,trace,cursor,selected}=trail[trail.length-1]);
    $('trace-name').textContent=trail[trail.length-1].traceName;
    $('details').hidden=selected===null;header();controls();inspect();layout();
    setStatus(trace?'Trace restored. Step through the evaluation.':'Select a node to inspect it. Double-click a function to step inside.');
  }
  function enterFunction(id) {
    const callee=model.nodes[id].callee;if(callee===undefined)return;
    saveFrame();trail.push({model:models[callee],viewMode:'function',trace:null,cursor:0,selected:null,traceName:''});activateFrame();
  }
  function navigate(index) {
    saveFrame();trail=trail.slice(0,index+1);activateFrame();
  }
  function layoutWorker() {
    self.onmessage=async({data})=>{
      try {
        if(data.url)importScripts(data.url);
        const q=s=>JSON.stringify(s), h=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
        const m=data.model, details=[], sources=new Map(), targets=new Map(), hidden=new Set();
        const isMatrix=sp=>sp.shape[0]*sp.shape[1]!==1;
        const hasTable=(n,sp)=>isMatrix(sp) && (n.kind==='call' || n.mapping || !n.inputs.length || !n.inputs.every(p=>JSON.stringify(p)===JSON.stringify(sp)));
        const record=n=>(n.ordered && !n.binary) || n.kind==='call';
        const functionView=data.viewMode==='function', direction=functionView?'TB':m.direction;
        for(const n of m.nodes)if(n.kind==='output' || (functionView && n.kind==='input'))hidden.add(n.id);
        const dot=['digraph G {','graph [rankdir='+direction+', bgcolor="white", pad="0.4", nodesep="0.55", ranksep="0.65"];','node [shape=ellipse, style=filled, color="#b00000", fillcolor="#b00000", fontcolor="white", fontname="Helvetica", fontsize=14, margin="0.15,0.08", width=0.5, height=0.5];','edge [color="#34658b", penwidth=1.5, arrowsize=0.65];'];
        function table(n,sp,port) {
          const id='value-'+n.id+'-'+port, cells=[], lookup=new Map();
          for(let c=0;c<Math.min(8,sp.shape[1]);c++)for(let k=sp.colind[c];k<sp.colind[c+1];k++){
            if(sp.row[k]<8)lookup.set(sp.row[k]+','+c,k);
          }
          const columns=Math.max(1,Math.min(8,sp.shape[1]));
          let label='<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3" COLOR="#cccccc">';
          const title=[n.boundary?n.display:n.kind==='call'?n.output_names[port]:'',data.showSizes?sp.shape.join('-by-'):''].filter(Boolean).join(' : ');
          if(title)label+='<TR><TD COLSPAN="'+columns+'" BGCOLOR="white"><FONT COLOR="'+(n.role==='input'?'#34658b':n.role==='output'?'#b00000':'#666666')+'">'+h(title)+'</FONT></TD></TR>';
          for(let r=0;r<Math.min(8,sp.shape[0]);r++){
            label+='<TR>';
            for(let c=0;c<Math.min(8,sp.shape[1]);c++){
              const k=lookup.get(r+','+c);
              const text=n.kind==='constant'?(k===undefined?'.':n.constants[k]):'';
              if(k!==undefined)cells.push({label:text,index:k});
              label+='<TD'+(k===undefined?'':' PORT="nz'+k+'"')+' BGCOLOR="white">';
              if(n.kind==='constant')label+=h(text);
              else label+='<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="0"><TR><TD FIXEDSIZE="TRUE" WIDTH="9" HEIGHT="9" BGCOLOR="'+(k===undefined?'white':'#111111')+'"></TD></TR></TABLE>';
              label+='</TD>';
            }
            if(sp.shape[1]===0)label+='<TD>empty</TD>';
            label+='</TR>';
          }
          if(sp.shape.some(n=>n>8))label+='<TR><TD COLSPAN="'+columns+'">...</TD></TR>';
          if(!title && !sp.shape[0])label+='<TR><TD>empty</TD></TR>';
          label+='</TABLE>';
          dot.push('v'+n.id+'_'+port+' [id="'+id+'", shape=plain, fontcolor="#666666", fontsize=10, label=<'+label+'>];');
          if(!n.boundary)dot.push('n'+n.id+(n.kind==='call'?':out'+port:'')+' -> v'+n.id+'_'+port+' [arrowsize=0.5];');
          sources.set(n.id+':'+port,'v'+n.id+'_'+port);details.push({id,node:n.id,port,cells});
          return details[details.length-1];
        }
        for(const original of m.nodes){
          const n=!functionView && original.kind==='input'?{...original,display:original.symbol}:original;
          if(hidden.has(n.id))continue;
          const sp=n.outputs[0]||n.inputs[0];
          const dimension=data.showSizes && sp && isMatrix(sp) && !(data.showContents && n.outputs.some(p=>hasTable(n,p)))?'\n'+sp.shape.join('-by-'):'';
          let label=q(n.display+dimension), shape='ellipse';
          if(record(n)){
            shape='plain';
            const ports=(names,prefix)=>'<TR>'+names.map((name,i)=>'<TD PORT="'+prefix+i+'"><FONT POINT-SIZE="10">'+h(name+(data.showSizes && (prefix==='in'?n.inputs:n.outputs)[i] && isMatrix((prefix==='in'?n.inputs:n.outputs)[i])?' '+(prefix==='in'?n.inputs:n.outputs)[i].shape.join('-by-'):''))+'</FONT></TD>').join('')+'</TR>';
            let html='<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="6" BGCOLOR="#b00000">';
            if(n.input_names.length)html+='<TR><TD><TABLE BORDER="0" CELLBORDER="1" COLOR="#d26666" CELLSPACING="0">'+ports(n.input_names,'in')+'</TABLE></TD></TR>';
            html+='<TR><TD>'+h(n.display)+'</TD></TR>';
            if(n.kind==='call' && n.output_names.length)html+='<TR><TD><TABLE BORDER="0" CELLBORDER="1" COLOR="#d26666" CELLSPACING="0">'+ports(n.output_names,'out')+'</TABLE></TD></TR>';
            label='<'+html+'</TABLE>>';
          }
          const color=n.kind==='input'||n.kind==='symbol'?'#34658b':n.kind==='constant'?'#38754d':'#b00000';
          dot.push('n'+n.id+' [id="instruction-'+n.id+'", shape='+shape+', color='+q(color)+', fillcolor='+q(color)+', label='+label+'];');
          n.outputs.forEach((sp,port)=>{if(data.showContents && hasTable(n,sp))table(n,sp,port);});
        }
        const rows={input:[],output:[]};
        for(const kind of ['input','output'])m[kind+'s'].forEach((io,index)=>{
          const assembly=!functionView && kind==='output' && m.type==='SXFunction' && data.showContents && isMatrix(io.sparsity);
          if(!functionView && !assembly)return;
          const n={id:'boundary_'+kind+'_'+index,kind:'boundary',boundary:true,role:functionView?kind:'',display:functionView?io.name:''};
          const owners=m.nodes.filter(node=>node.kind===kind && node.io_index===index).map(node=>({node:node.id,offset:node.io_offset,count:(kind==='input'?node.outputs:node.inputs)[0].row.length}));
          let detail, graphId;
          if(data.showContents && isMatrix(io.sparsity)){
            detail=table(n,io.sparsity,0);graphId='v'+n.id+'_0';
            detail.cells=detail.cells.flatMap(cell=>{
              const owner=owners.find(o=>cell.index>=o.offset && cell.index<o.offset+o.count);
              return owner?[{...cell,node:owner.node,index:cell.index-owner.offset}]:[];
            });
          } else {
            graphId='b'+kind+'_'+index;
            const color=kind==='input'?'#34658b':'#b00000';
            const label=io.name+(data.showSizes && isMatrix(io.sparsity)?'\n'+io.sparsity.shape.join('-by-'):'');
            dot.push(graphId+' [id="boundary-'+kind+'-'+index+'", label='+q(label)+', color='+q(color)+', fillcolor='+q(color)+'];');
            detail={id:'boundary-'+kind+'-'+index,node:null,port:0,cells:[],render:'io'};details.push(detail);
          }
          Object.assign(detail,{node:null,boundary:true,boundaryKind:kind,sp:io.sparsity,owners});
          for(const owner of owners){
            const cell=detail.cells.some(c=>c.node===owner.node);
            const endpoint=graphId+(m.type==='SXFunction' && cell?':nz'+owner.offset:'');
            if(kind==='input')sources.set(owner.node+':0',endpoint);
            else targets.set(owner.node,endpoint);
          }
          if(functionView)rows[kind].push(graphId);
        });
        if(functionView){
          for(const kind of ['input','output']){
            const ids=rows[kind];if(!ids.length)continue;
            dot.push('{ rank='+(kind==='input'?'source':'sink')+'; '+ids.join('; ')+'; }');
            for(let i=1;i<ids.length;i++)dot.push(ids[i-1]+' -> '+ids[i]+' [style=invis, weight=100];');
          }
        }
        for(const e of m.edges){
          if(hidden.has(e.to) && !targets.has(e.to))continue;
          const source=sources.get(e.from+':'+e.output)||('n'+e.from+(m.nodes[e.from].kind==='call'?':out'+e.output:''));
          const n=m.nodes[e.to];
          let target=targets.get(e.to)||('n'+e.to+(record(n)?':in'+e.input:''));
          if(n.binary)target+=e.input===0?':w':':e';
          dot.push(source+' -> '+target+';');
        }
        dot.push('}');
        const viz=await Viz.instance(), result=viz.render(dot.join('\n'),{engine:'dot',format:'svg'});
        if(result.status!=='success')throw Error(result.errors.map(e=>e.message).join('; '));
        self.postMessage({svg:result.output,details,hidden:Array.from(hidden)});
      }catch(error){self.postMessage({error:error.message||String(error)});}
    };
  }
  const workerSource='('+layoutWorker.toString()+')();';
  let worker=null, workerURL=null;
  function releaseWorker() {
    if(worker)worker.terminate();worker=null;
    if(workerURL)URL.revokeObjectURL(workerURL);workerURL=null;
  }
  function layoutError(message) {
    rejectReady(new Error(message));
    releaseWorker();$('loading-text').textContent=message;$('cancel-layout').hidden=true;setStatus(message,'error');
  }
  function installSVG(text, details, hidden) {
    const doc=new DOMParser().parseFromString(text,'image/svg+xml');
    if(doc.querySelector('parsererror') || doc.documentElement.localName!=='svg')throw Error('Viz.js returned invalid SVG');
    svg=document.importNode(doc.documentElement,true);svg.setAttribute('role','img');svg.setAttribute('aria-label','Function instruction graph');
    svg.removeAttribute('width');svg.removeAttribute('height');$('canvas').prepend(svg);initialView=svg.getAttribute('viewBox');
    for(const value of details){
      const element=svg.getElementById(value.id);element.classList.remove('node');element.classList.add(value.render==='io'?'io-node':'value-node');
      element.onclick=()=>{const id=value.node ?? value.cells[0]?.node ?? value.owners?.[0]?.node;if(id!==undefined)select(id);};
      const texts=Array.from(element.querySelectorAll('text')), groups=new Map();
      if(value.boundary){
        for(const owner of value.owners)groups.set(owner.node,[]);
        const label=document.createElementNS('http://www.w3.org/2000/svg','text'),box=element.getBBox();
        label.classList.add('trace-value');label.setAttribute('x',box.x+box.width/2);label.setAttribute('y',box.y+box.height+14);label.setAttribute('text-anchor','middle');element.append(label);value.traceLabel=label;
      }
      for(const cell of value.cells){
        const index=texts.findIndex(t=>t.textContent===cell.label), id=cell.node ?? value.node;
        if(!groups.has(id))groups.set(id,[]);
        if(index>=0)groups.get(id).push({...cell,element:texts.splice(index,1)[0]});
      }
      if(value.node!==null && !groups.has(value.node))groups.set(value.node,[]);
      for(const [id,cells] of groups){
        if(!valueElements.has(id))valueElements.set(id,[]);
        valueElements.get(id).push({element,port:value.port,cells,boundary:value.boundary?value:null});
      }
    }
    for(const node of model.nodes){
      const el=svg.getElementById('instruction-'+node.id);
      if(!el){if(hidden.includes(node.id)){paint(node.id);continue;}throw Error('Missing graph node '+node.id);}
      elements.set(node.id,el);el.onclick=()=>select(node.id);
      if(node.callee!==undefined){
        el.onclick=()=>{clearTimeout(selectionTimer);selectionTimer=setTimeout(()=>select(node.id),400);};
        el.ondblclick=()=>{clearTimeout(selectionTimer);enterFunction(node.id);};
        el.querySelector('title').textContent='Double-click to step into '+node.display;
      }
      paint(node.id);
    }
    if(selected!==null)select(selected);
    svg.addEventListener('wheel',e=>{
      e.preventDefault();const box=svg.viewBox.baseVal, factor=Math.exp(Math.max(-1,Math.min(1,e.deltaY*.001)));
      const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());
      svg.setAttribute('viewBox',[point.x+(box.x-point.x)*factor,point.y+(box.y-point.y)*factor,box.width*factor,box.height*factor].join(' '));
    },{passive:false});
    let drag=null;
    svg.onpointerdown=e=>{if(e.button!==0 || e.target.closest('.node,.io-node,.value-node'))return;drag={x:e.clientX,y:e.clientY,view:svg.getAttribute('viewBox').split(/\s+/).map(Number)};svg.setPointerCapture(e.pointerId);};
    svg.onpointermove=e=>{
      if(!drag)return;const scale=svg.getScreenCTM();const [x,y,w,h]=drag.view;
      svg.setAttribute('viewBox',[x-(e.clientX-drag.x)/scale.a,y-(e.clientY-drag.y)/scale.d,w,h].join(' '));
    };
    svg.onpointerup=svg.onpointercancel=()=>{drag=null;};
    resolveReady();$('loading').hidden=true;if(!trace)setStatus('Select a node to inspect it. Scroll to zoom; drag to pan.');
  }
  $('fit').onclick=()=>{if(svg)svg.setAttribute('viewBox',initialView);};
  $('cancel-layout').onclick=()=>layoutError('Layout cancelled. Reopen the file to try again.');
  function layout() {
    clearTimeout(selectionTimer);releaseWorker();
    if(svg)svg.remove();svg=null;elements.clear();valueElements.clear();
    $('loading').hidden=false;$('loading-text').textContent='Laying out the graph\u2026';$('cancel-layout').hidden=false;
    try {
    workerURL=URL.createObjectURL(new Blob([runtime.source||'', '\n', workerSource],{type:'text/javascript'}));worker=new Worker(workerURL);
    worker.onmessage=({data})=>{if(data.error){layoutError('Layout failed: '+data.error);return;}releaseWorker();try{installSVG(data.svg,data.details,data.hidden);}catch(error){layoutError(error.message);}};
    worker.onerror=e=>layoutError('Could not load Viz.js. Check connectivity, or export with the viz_js option for offline use.');
    worker.postMessage({url:runtime.url,model,viewMode,showContents,showSizes});
    }catch(error){layoutError(error.message);}
  }
  $('view-mode').onchange=()=>{viewMode=$('view-mode').value;inspect();layout();};
  $('detail-toggle').onchange=()=>{showContents=$('detail-toggle').checked;inspect();layout();};
  $('size-toggle').onchange=()=>{showSizes=$('size-toggle').checked;inspect();layout();};
  header();layout();
  return {
    ready,
    loadTrace,
    destroy() {stop();clearTimeout(selectionTimer);++loadNumber;releaseWorker();
      rejectReady(new DOMException('Viewer replaced or destroyed', 'AbortError'));},
    setView(view) {
      if(!['function','expression'].includes(view))throw Error('Unknown graph view: '+view);
      viewMode=view;header();inspect();layout();
    }
  };
}
