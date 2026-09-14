export interface Sparsity {shape:[number,number];colind:number[];row:number[];}
export interface GraphPort {name:string;sparsity:Sparsity;}
export interface GraphNode {
  id:number;op:number;kind:string;display:string;label:string;expression:string;formula:string;
  binary:boolean;ordered:boolean;inputs:Sparsity[];outputs:Sparsity[];
  input_names:string[];output_names:string[];constants:string[];
  callee?:number;callee_type?:string;io_index?:number;io_offset?:number;symbol?:string;mapping?:number[];
}
export interface FunctionGraph {
  version:1;name:string;type:string;direction:'TB'|'BT'|'LR'|'RL';
  inputs:GraphPort[];outputs:GraphPort[];nodes:GraphNode[];
  edges:{from:number;output:number;to:number;input:number}[];
}
export interface GraphBundle extends FunctionGraph {
  casadi_version?:string;
  format:'casadi_viz';view:'function'|'expression';functions:FunctionGraph[];
}
export interface Viewer {
  setGraph(bundle:GraphBundle|string):Promise<void>;
  loadTrace(trace:Blob|string):Promise<void>;
  setView(view:'function'|'expression'):void;
  destroy():void;
}
export function createGraphViewer(host:HTMLElement,options?:{
  runtime?:{url:string;source?:never}|{source:string;url?:never};
}):Viewer;
