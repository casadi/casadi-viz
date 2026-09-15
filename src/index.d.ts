import type {StructuralDocument} from './casadi-import.js';
export interface Sparsity {shape:[number,number];colind:number[];row:number[];}
export interface GraphPort {name:string;sparsity:Sparsity;}
export interface GraphNode {
  id:number;op:number;kind:string;display:string;label:string;expression:string;formula:string;
  binary:boolean;ordered:boolean;inputs:Sparsity[];outputs:Sparsity[];
  input_names:string[];output_names:string[];constants:string[];
  callee?:number;callee_type?:string;callee_serialized_ref?:number;model_path?:string;io_index?:number;io_offset?:number;symbol?:string;mapping?:number[];mapping_kind?:'extract'|'assign'|'add';
}
export interface FunctionGraph {
  serialized_ref?:number;
  version:1;name:string;type:string;direction:'TB'|'BT'|'LR'|'RL';
  inputs:GraphPort[];outputs:GraphPort[];nodes:GraphNode[];
  edges:{from:number;output:number;to:number;input:number}[];
}
export interface GraphBundle extends FunctionGraph {
  serialization?:StructuralDocument;
  casadi_version?:string;
  format:'casadi_viz';view?:'function'|'expression';functions:FunctionGraph[];
}
/** Expression export: native StringSerializer data plus presentation options. */
export interface SerializedGraphBundle {
  format:'casadi_viz';version:1;source:string;
  view?:'function'|'expression';direction:'TB'|'BT'|'LR'|'RL';casadi_version:string;
  include_functions:boolean;show_matrix_contents:boolean;show_matrix_sizes:boolean;
}
export interface Viewer {
  setGraph(bundle:GraphBundle|SerializedGraphBundle|string):Promise<void>;
  loadTrace(trace:Blob|string):Promise<void>;
  destroy():void;
}
export function createGraphViewer(host:HTMLElement,options?:{
  runtime?:{url:string;source?:never}|{source:string;url?:never};
}):Viewer;
