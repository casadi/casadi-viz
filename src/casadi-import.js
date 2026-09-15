import {decode, open} from '@casadi/casadi-reader';
export {decode, decodeCasadi, open} from '@casadi/casadi-reader';
export {toGraphBundle} from './casadi-adapter.js';

/** Accept native .casadi data or the structural JSON emitted by any language reader. */
export async function readCasadi(source, options={}) {
  if(source && typeof source==='object' && source.format) {
    if(source.format!=='casadi_serialization'||source.version!==1)
      throw Error('Expected casadi_serialization version 1');
    return source;
  }
  if(source && typeof source.text==='function') {
    if(source.name?.toLowerCase().endsWith('.json') || source.type==='application/json')source=await source.text();
    else return open(source,options);
  }
  if(typeof source!=='string')throw Error('Expected .casadi text, structural JSON, or a File/Blob');
  const text=source.trimStart();
  if(text.startsWith('{')) {
    const document=JSON.parse(text);
    if(document.format!=='casadi_serialization'||document.version!==1)
      throw Error('Expected casadi_serialization version 1');
    return document;
  }
  return decode(source,options);
}
