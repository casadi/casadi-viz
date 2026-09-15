import type {GraphBundle} from './index.js';
export interface StructuralDocument {
  format:'casadi_serialization';version:1;serializationProtocol:number;
  root:number|null;roots:unknown[];objects:Array<{
    type:string;fields:Array<{name:string;type:string;value:unknown;offset:number;byteLength:number}>;
    layouts:string[];offset:number;byteLength:number;
  }>;
}
export interface ReaderOptions {lazy?:boolean;type?:string;maxItems?:number;lazyThreshold?:number;}
export function readCasadi(source:string|File|Blob|StructuralDocument,options?:ReaderOptions):Promise<StructuralDocument>;
export function decode(text:string,options?:ReaderOptions):StructuralDocument;
export const decodeCasadi:typeof decode;
export function open(file:Blob,options?:ReaderOptions):Promise<StructuralDocument>;
export function toGraphBundle(document:StructuralDocument):GraphBundle;
