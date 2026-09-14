// Browser adapter for the current CommonJS CasADi WASM distribution.
export async function loadCasadi(base) {
  base=new URL(base,import.meta.url);
  async function commonJS(name,require) {
    const url=new URL(name,base),response=await fetch(url);
    if(!response.ok)throw Error('Cannot load '+url+' ('+response.status+'). Run the runtime setup script.');
    const module={exports:{}};
    new Function('module','exports','require','__dirname','__filename',await response.text())(
      module,module.exports,require,base.href.replace(/\/$/,''),url.href);
    return module.exports;
  }
  const createWasm=await commonJS('casadi_wasm.js',name=>{throw Error('Unexpected dependency '+name);});
  let wasm;
  const create=await commonJS('casadi.js',name=>{
    if(name.endsWith('casadi_wasm.js'))return async options=>{wasm=await createWasm(options);return wasm;};
    if(name==='path')return {join:(base,name)=>new URL(name,base.replace(/\/$/,'')+'/').href};
    throw Error('Unexpected dependency '+name);
  });
  // This loader runs in a dedicated computation worker; plugin fetches use its runtime directory.
  const originalFetch=globalThis.fetch.bind(globalThis);
  globalThis.fetch=(url,options)=>originalFetch(typeof url==='string' && /^libcasadi_[\w]+\.so$/.test(url)?new URL(url,base):url,options);
  return {ca:await create(),get fs(){return wasm.FS;}};
}
