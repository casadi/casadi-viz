import {readdir,copyFile,mkdir,access} from 'node:fs/promises';
import path from 'node:path';
const source=process.argv[2];
if(!source)throw Error('Usage: node scripts/stage-runtime.mjs /path/to/casadi/build/swig/wasm-js');
for(const name of ['casadi.js','casadi_wasm.js','casadi_wasm.wasm','libcasadi_nlpsol_sqpmethod.so','libcasadi_conic_qrqp.so'])await access(path.join(source,name));
await mkdir('examples/runtime',{recursive:true});
for(const name of await readdir(source)) {
  if((name.startsWith('casadi') || name.startsWith('libcasadi')) && /\.(js|wasm|so|data)$/.test(name)) {
    await copyFile(path.join(source,name),path.join('examples/runtime',name));
  }
}
console.log('Staged local CasADi WASM runtime (excluded from Git and npm package)');
